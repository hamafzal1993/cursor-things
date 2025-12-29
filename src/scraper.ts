import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

class ProductHuntScraper {
  private apiUrl = 'https://api.producthunt.com/v2/api/graphql';
  private baseUrl = 'https://www.producthunt.com';
  private products: Product[] = [];
  private delay = parseInt(process.env.DELAY_MS || '1000');
  private apiToken = process.env.PRODUCT_HUNT_API_TOKEN;

  constructor() {
    if (!this.apiToken) {
      console.warn('⚠️  Warning: PRODUCT_HUNT_API_TOKEN not set in environment variables');
      console.warn('⚠️  API requests will likely fail without authentication');
      console.warn('⚠️  Get your API token from: https://www.producthunt.com/v2/oauth/applications\n');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  // Using Product Hunt's public GraphQL API
  private async fetchProductsForDate(date: string): Promise<Product[]> {
    try {
      console.log(`\nFetching products for ${date}...`);

      // GraphQL query to get posts for a specific date
      const query = `
        query {
          posts(order: VOTES, postedAfter: "${date}T00:00:00Z", postedBefore: "${date}T23:59:59Z") {
            edges {
              node {
                id
                name
                tagline
                votesCount
                website
                url
              }
            }
          }
        }
      `;

      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`;
      }

      const response = await axios.post(
        this.apiUrl,
        { query },
        { headers }
      );

      if (response.data && response.data.data && response.data.data.posts) {
        const posts = response.data.data.posts.edges;
        console.log(`Found ${posts.length} products`);

        return posts.map((edge: any) => {
          const node = edge.node;
          return {
            name: node.name,
            tagline: node.tagline || '',
            websiteUrl: node.website || '',
            productHuntUrl: node.url || `${this.baseUrl}/posts/${node.id}`,
            date: date,
            upvotes: node.votesCount,
          };
        });
      }

      return [];
    } catch (error: any) {
      console.error(`Error fetching products for ${date}:`, error.message);

      // If API fails, try scraping the daily page as fallback
      return await this.scrapeProductsForDate(date);
    }
  }

  // Fallback: Scrape the daily page if API fails
  private async scrapeProductsForDate(date: string): Promise<Product[]> {
    try {
      console.log(`Trying fallback scraping for ${date}...`);

      // Try different URL patterns
      const urls = [
        `${this.baseUrl}/?day=${date}`,
        `${this.baseUrl}/posts?day=${date}`,
      ];

      for (const url of urls) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.producthunt.com/',
            },
          });

          const $ = cheerio.load(response.data);
          const products: Product[] = [];

          // Look for product data in script tags (often contains JSON data)
          $('script[type="application/json"]').each((_, element) => {
            try {
              const jsonData = JSON.parse($(element).html() || '{}');
              // Try to extract product data from various JSON structures
              if (jsonData.props && jsonData.props.pageProps) {
                const data = jsonData.props.pageProps;
                if (data.posts || data.items || data.products) {
                  // Extract products from the data structure
                  console.log('Found product data in JSON');
                }
              }
            } catch (e) {
              // Not valid JSON or doesn't contain product data
            }
          });

          if (products.length > 0) {
            return products;
          }
        } catch (e: any) {
          console.log(`Failed to fetch ${url}: ${e.message}`);
        }
      }

      return [];
    } catch (error: any) {
      console.error(`Fallback scraping failed for ${date}:`, error.message);
      return [];
    }
  }

  async scrapeDecember(year: number = 2025): Promise<void> {
    console.log(`\nStarting to scrape Product Hunt for December ${year}...\n`);
    console.log('Note: Product Hunt may block or limit automated requests.');
    console.log('Consider using their official API with authentication for better results.\n');

    const dates = this.getDatesInDecember(year);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const date of dates) {
      // Skip future dates
      if (date > todayStr) {
        console.log(`Skipping future date: ${date}`);
        continue;
      }

      const productsOnDate = await this.fetchProductsForDate(date);

      if (productsOnDate.length > 0) {
        console.log(`Successfully retrieved ${productsOnDate.length} products for ${date}`);
        productsOnDate.forEach(p => {
          console.log(`  - ${p.name}`);
          if (p.websiteUrl) {
            console.log(`    Website: ${p.websiteUrl}`);
          }
        });
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
      const headers = ['Date', 'Product Name', 'Tagline', 'Website URL', 'Product Hunt URL', 'Upvotes'];
      const rows = this.products.map(p => [
        p.date,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.tagline.replace(/"/g, '""')}"`,
        p.websiteUrl,
        p.productHuntUrl,
        p.upvotes || 0,
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
