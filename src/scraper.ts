import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

interface Product {
  name: string;
  tagline: string;
  websiteUrl: string;
  productHuntUrl: string;
  date: string;
  upvotes?: number;
}

class ProductHuntScraper {
  private baseUrl = 'https://www.producthunt.com';
  private products: Product[] = [];
  private delay = 2000; // 2 seconds delay between requests to be respectful

  constructor() {}

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchPage(url: string): Promise<string> {
    try {
      console.log(`Fetching: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching ${url}:`, error.message);
      return '';
    }
  }

  private getDatesInDecember(year: number): string[] {
    const dates: string[] = [];
    const daysInDecember = 31;

    for (let day = 1; day <= daysInDecember; day++) {
      const date = new Date(year, 11, day); // 11 = December (0-indexed)
      const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      dates.push(dateStr);
    }

    return dates;
  }

  private parseProductsFromPage(html: string, date: string): Product[] {
    const $ = cheerio.load(html);
    const products: Product[] = [];

    try {
      // Product Hunt structure - looking for product cards
      // The structure may vary, so we'll try multiple selectors

      // Try to find product links
      $('a[href^="/posts/"]').each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href');

        if (href && !href.includes('/topics/') && !href.includes('/discussions/')) {
          const productName = $el.find('h3, h2, strong').first().text().trim();
          const tagline = $el.find('p').first().text().trim();

          if (productName) {
            const productUrl = `${this.baseUrl}${href}`;

            products.push({
              name: productName,
              tagline: tagline || '',
              websiteUrl: '', // Will be filled when visiting product page
              productHuntUrl: productUrl,
              date: date,
            });
          }
        }
      });

      // Alternative: Look for article or div elements containing products
      $('article, div[data-test*="post"], div[class*="post"]').each((_, element) => {
        const $el = $(element);
        const link = $el.find('a[href^="/posts/"]').first();
        const href = link.attr('href');

        if (href && !products.some(p => p.productHuntUrl.includes(href))) {
          const productName = $el.find('h3, h2, strong').first().text().trim();
          const tagline = $el.find('p').first().text().trim();

          if (productName) {
            const productUrl = `${this.baseUrl}${href}`;

            products.push({
              name: productName,
              tagline: tagline || '',
              websiteUrl: '',
              productHuntUrl: productUrl,
              date: date,
            });
          }
        }
      });
    } catch (error: any) {
      console.error(`Error parsing products from page:`, error.message);
    }

    return products;
  }

  private async getProductWebsiteUrl(productUrl: string): Promise<string> {
    try {
      await this.sleep(this.delay);
      const html = await this.fetchPage(productUrl);
      const $ = cheerio.load(html);

      // Try to find the external website link
      // Look for common patterns for external links
      let websiteUrl = '';

      // Method 1: Look for "Visit" or "Get it" links
      $('a').each((_, element) => {
        const $el = $(element);
        const href = $el.attr('href') || '';
        const text = $el.text().toLowerCase();

        if (
          (text.includes('visit') || text.includes('get it') || text.includes('website')) &&
          (href.startsWith('http://') || href.startsWith('https://')) &&
          !href.includes('producthunt.com')
        ) {
          websiteUrl = href;
          return false; // break
        }
      });

      // Method 2: Look for external links in meta tags
      if (!websiteUrl) {
        const ogUrl = $('meta[property="og:url"]').attr('content');
        if (ogUrl && !ogUrl.includes('producthunt.com')) {
          websiteUrl = ogUrl;
        }
      }

      // Method 3: Look for canonical link
      if (!websiteUrl) {
        const canonical = $('link[rel="canonical"]').attr('href');
        if (canonical && !canonical.includes('producthunt.com')) {
          websiteUrl = canonical;
        }
      }

      return websiteUrl;
    } catch (error: any) {
      console.error(`Error fetching website URL for ${productUrl}:`, error.message);
      return '';
    }
  }

  async scrapeDecember(year: number = 2025): Promise<void> {
    console.log(`\nStarting to scrape Product Hunt for December ${year}...\n`);

    const dates = this.getDatesInDecember(year);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const date of dates) {
      // Skip future dates
      if (date > todayStr) {
        console.log(`Skipping future date: ${date}`);
        continue;
      }

      console.log(`\nScraping products from ${date}...`);
      const url = `${this.baseUrl}/time-travel/${date}`;

      const html = await this.fetchPage(url);
      if (!html) {
        console.log(`No data retrieved for ${date}`);
        continue;
      }

      const productsOnDate = this.parseProductsFromPage(html, date);
      console.log(`Found ${productsOnDate.length} products on ${date}`);

      // Fetch website URLs for each product
      for (const product of productsOnDate) {
        console.log(`  - ${product.name}`);
        const websiteUrl = await this.getProductWebsiteUrl(product.productHuntUrl);
        product.websiteUrl = websiteUrl;

        if (websiteUrl) {
          console.log(`    Website: ${websiteUrl}`);
        } else {
          console.log(`    Website: Not found`);
        }
      }

      this.products.push(...productsOnDate);

      // Be respectful with delays
      await this.sleep(this.delay);
    }

    console.log(`\nTotal products scraped: ${this.products.length}`);
  }

  async exportToJSON(filename: string = 'products.json'): Promise<void> {
    const outputPath = path.join(process.cwd(), 'output', filename);

    try {
      fs.writeFileSync(
        outputPath,
        JSON.stringify(this.products, null, 2),
        'utf-8'
      );
      console.log(`\nData exported to ${outputPath}`);
    } catch (error: any) {
      console.error(`Error exporting to JSON:`, error.message);
    }
  }

  async exportToCSV(filename: string = 'products.csv'): Promise<void> {
    const outputPath = path.join(process.cwd(), 'output', filename);

    try {
      const headers = ['Date', 'Product Name', 'Tagline', 'Website URL', 'Product Hunt URL'];
      const rows = this.products.map(p => [
        p.date,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.tagline.replace(/"/g, '""')}"`,
        p.websiteUrl,
        p.productHuntUrl,
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      fs.writeFileSync(outputPath, csv, 'utf-8');
      console.log(`Data exported to ${outputPath}`);
    } catch (error: any) {
      console.error(`Error exporting to CSV:`, error.message);
    }
  }

  getProducts(): Product[] {
    return this.products;
  }
}

// Main execution
async function main() {
  const scraper = new ProductHuntScraper();

  try {
    // Scrape December 2025
    await scraper.scrapeDecember(2025);

    // Export results
    await scraper.exportToJSON('producthunt_december_2025.json');
    await scraper.exportToCSV('producthunt_december_2025.csv');

    const products = scraper.getProducts();

    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total products: ${products.length}`);
    console.log(`Products with website URLs: ${products.filter(p => p.websiteUrl).length}`);
    console.log(`Products without website URLs: ${products.filter(p => !p.websiteUrl).length}`);

  } catch (error: any) {
    console.error('Error during scraping:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { ProductHuntScraper, Product };
