import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

// Load environment variables
dotenv.config();

interface Product {
  name: string;
  tagline: string;
  websiteUrl: string;
  productHuntUrl: string;
  date: string;
  upvotes?: number;
}

class ProductHuntStealthScraper {
  private baseUrl = 'https://www.producthunt.com';
  private products: Product[] = [];
  private delay = parseInt(process.env.DELAY_MS || '3000');
  private browser: Browser | null = null;

  constructor() {
    console.log('🕵️  Using Puppeteer with Stealth plugin for anti-detection\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      console.log('🚀 Launching stealth browser...');
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-blink-features=AutomationControlled',
          ],
        });
        console.log('✅ Browser launched successfully\n');
      } catch (error: any) {
        console.error('❌ Failed to launch browser:', error.message);
        throw error;
      }
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('\n🔒 Browser closed');
    }
  }

  private getDatesInDecember(year: number): string[] {
    const dates: string[] = [];
    const daysInDecember = 31;

    for (let day = 1; day <= daysInDecember; day++) {
      const date = new Date(year, 11, day);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
    }

    return dates;
  }

  private async scrapeProductsForDate(date: string): Promise<Product[]> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();

      // Set a realistic viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Additional stealth measures
      await page.evaluateOnNewDocument(() => {
        // @ts-ignore
        // Override the navigator.webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // @ts-ignore
        // Override plugins to make it look real
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // @ts-ignore
        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      const url = `${this.baseUrl}?day=${date}`;
      console.log(`📍 Navigating to: ${url}`);

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });

        // Wait for content to load
        await this.sleep(3000);

        // Take a screenshot for debugging (optional)
        // await page.screenshot({ path: `debug-${date}.png` });

        // Extract product data from the page
        const products = await page.evaluate((baseUrl, date) => {
          const productData: any[] = [];

          // Try to find products in various ways
          // Method 1: Look for links to product posts
          // @ts-ignore
          const postLinks = document.querySelectorAll('a[href^="/posts/"]');

          const seen = new Set<string>();

          postLinks.forEach((link: any) => {
            const href = link.getAttribute('href');
            if (!href || seen.has(href)) return;
            if (href.includes('/topics/') || href.includes('/discussions/')) return;

            seen.add(href);

            // Try to find product name and tagline
            const parent = link.closest('[data-test]') || link.closest('article') || link.closest('div[class*="styles_item"]');

            let name = '';
            let tagline = '';

            // Try to find name
            const nameEl = link.querySelector('h3') || link.querySelector('h2') || link.querySelector('strong') || link;
            if (nameEl) {
              name = nameEl.textContent?.trim() || '';
            }

            // Try to find tagline
            if (parent) {
              const taglineEl = parent.querySelector('p');
              if (taglineEl && !taglineEl.querySelector('a')) {
                tagline = taglineEl.textContent?.trim() || '';
              }
            }

            if (name) {
              productData.push({
                name,
                tagline,
                productHuntUrl: `${baseUrl}${href}`,
                date,
              });
            }
          });

          // Method 2: Look for Next.js data in script tags
          // @ts-ignore
          const scripts = document.querySelectorAll('script[type="application/json"]');
          scripts.forEach((script: any) => {
            try {
              const data = JSON.parse(script.textContent || '{}');
              // Navigate through the Next.js data structure
              if (data.props?.pageProps?.posts) {
                data.props.pageProps.posts.forEach((post: any) => {
                  const slug = post.slug || post.id;
                  if (slug && !seen.has(`/posts/${slug}`)) {
                    productData.push({
                      name: post.name || '',
                      tagline: post.tagline || '',
                      productHuntUrl: `${baseUrl}/posts/${slug}`,
                      date,
                    });
                    seen.add(`/posts/${slug}`);
                  }
                });
              }
            } catch (e) {
              // Not valid JSON or wrong structure
            }
          });

          return productData;
        }, this.baseUrl, date);

        console.log(`✅ Found ${products.length} products for ${date}`);

        // Close the page
        await page.close();

        // For each product, try to get the website URL
        const productsWithWebsites: Product[] = [];

        for (let i = 0; i < Math.min(products.length, 20); i++) {
          // Limit to 20 to avoid too long execution
          const product = products[i];
          console.log(`  📦 ${i + 1}. ${product.name}`);

          const websiteUrl = await this.getProductWebsiteUrl(product.productHuntUrl);

          productsWithWebsites.push({
            ...product,
            websiteUrl,
          });

          if (websiteUrl) {
            console.log(`     🌐 ${websiteUrl}`);
          }

          // Delay between product page visits
          if (i < products.length - 1) {
            await this.sleep(this.delay);
          }
        }

        return productsWithWebsites;
      } catch (error: any) {
        console.error(`❌ Error loading page: ${error.message}`);
        await page.close();
        return [];
      }
    } catch (error: any) {
      console.error(`❌ Error scraping ${date}:`, error.message);
      return [];
    }
  }

  private async getProductWebsiteUrl(productUrl: string): Promise<string> {
    try {
      await this.initBrowser();
      const page = await this.browser!.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(productUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await this.sleep(2000);

      // Extract the website URL
      const websiteUrl = await page.evaluate(() => {
        // @ts-ignore - DOM types
        // Method 1: Look for "Visit" or "Get it" button
        const buttons: any[] = Array.from(document.querySelectorAll('a'));
        for (const button of buttons) {
          const text = button.textContent?.toLowerCase() || '';
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';

          if (
            (text.includes('visit') ||
              text.includes('get it') ||
              text.includes('website') ||
              ariaLabel.includes('visit') ||
              ariaLabel.includes('website')) &&
            button.href &&
            !button.href.includes('producthunt.com')
          ) {
            return button.href;
          }
        }

        // Method 2: Look for the first external link
        const externalLinks = buttons.filter(
          (a: any) =>
            a.href &&
            (a.href.startsWith('http://') || a.href.startsWith('https://')) &&
            !a.href.includes('producthunt.com') &&
            !a.href.includes('twitter.com') &&
            !a.href.includes('facebook.com') &&
            !a.href.includes('linkedin.com') &&
            !a.href.includes('instagram.com') &&
            !a.href.includes('youtube.com')
        );

        if (externalLinks.length > 0) {
          return externalLinks[0].href;
        }

        return '';
      });

      await page.close();
      return websiteUrl;
    } catch (error: any) {
      console.error(`     ⚠️  Could not get website URL: ${error.message}`);
      return '';
    }
  }

  async scrapeDecember(year: number = 2025): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 Starting Product Hunt Scraper for December ${year}`);
    console.log(`${'='.repeat(60)}\n`);

    const dates = this.getDatesInDecember(year);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const date of dates) {
      if (date > todayStr) {
        console.log(`⏭️  Skipping future date: ${date}\n`);
        continue;
      }

      console.log(`\n📅 Processing ${date}...`);
      const productsOnDate = await this.scrapeProductsForDate(date);

      this.products.push(...productsOnDate);

      console.log(`✅ Completed ${date}\n`);

      // Delay between dates
      await this.sleep(this.delay);
    }

    await this.closeBrowser();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 SCRAPING COMPLETED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total products scraped: ${this.products.length}`);
  }

  async exportToJSON(filename: string = 'products.json'): Promise<void> {
    const outputPath = path.join(process.cwd(), 'output', filename);

    try {
      fs.writeFileSync(outputPath, JSON.stringify(this.products, null, 2), 'utf-8');
      console.log(`\n💾 Data exported to ${outputPath}`);
    } catch (error: any) {
      console.error(`❌ Error exporting to JSON:`, error.message);
    }
  }

  async exportToCSV(filename: string = 'products.csv'): Promise<void> {
    const outputPath = path.join(process.cwd(), 'output', filename);

    try {
      const headers = ['Date', 'Product Name', 'Tagline', 'Website URL', 'Product Hunt URL'];
      const rows = this.products.map((p) => [
        p.date,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.tagline.replace(/"/g, '""')}"`,
        p.websiteUrl,
        p.productHuntUrl,
      ]);

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      fs.writeFileSync(outputPath, csv, 'utf-8');
      console.log(`💾 Data exported to ${outputPath}`);
    } catch (error: any) {
      console.error(`❌ Error exporting to CSV:`, error.message);
    }
  }

  getProducts(): Product[] {
    return this.products;
  }
}

// Main execution
async function main() {
  const scraper = new ProductHuntStealthScraper();

  try {
    // Scrape December 2025
    await scraper.scrapeDecember(2025);

    // Export results
    await scraper.exportToJSON('producthunt_december_2025_stealth.json');
    await scraper.exportToCSV('producthunt_december_2025_stealth.csv');

    const products = scraper.getProducts();

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📈 SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total products: ${products.length}`);
    console.log(`Products with website URLs: ${products.filter((p) => p.websiteUrl).length}`);
    console.log(`Products without website URLs: ${products.filter((p) => !p.websiteUrl).length}`);

    if (products.length > 0) {
      console.log(`\n📋 Sample of collected data (first 5):`);
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Date: ${p.date}`);
        console.log(`   Tagline: ${p.tagline || 'N/A'}`);
        console.log(`   Website: ${p.websiteUrl || 'N/A'}`);
        console.log(`   PH URL: ${p.productHuntUrl}`);
      });
    }

    console.log(`\n${'='.repeat(60)}\n`);
  } catch (error: any) {
    console.error('❌ Fatal error during scraping:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { ProductHuntStealthScraper, Product };
