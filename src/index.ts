import { ProductHuntScraper } from './scraper';

async function main() {
  const scraper = new ProductHuntScraper();

  try {
    console.log('Product Hunt Scraper - December 2025');
    console.log('=====================================\n');

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

    if (products.length > 0) {
      console.log('\n=== SAMPLE PRODUCTS ===');
      products.slice(0, 5).forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   Date: ${p.date}`);
        console.log(`   Tagline: ${p.tagline}`);
        console.log(`   Website: ${p.websiteUrl || 'N/A'}`);
        console.log(`   Product Hunt: ${p.productHuntUrl}`);
      });
    }

  } catch (error: any) {
    console.error('Error during scraping:', error.message);
    process.exit(1);
  }
}

main();
