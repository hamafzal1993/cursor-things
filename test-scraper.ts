// Quick test script to verify the stealth scraper works
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function test() {
  console.log('Testing Puppeteer with Stealth plugin...\n');

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    console.log('✅ Browser launched successfully!');

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📍 Navigating to Product Hunt...');
    await page.goto('https://www.producthunt.com', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const title = await page.title();
    console.log(`✅ Page loaded: ${title}`);

    const screenshot = await page.screenshot({ path: 'test-screenshot.png' });
    console.log('✅ Screenshot saved to test-screenshot.png');

    await browser.close();
    console.log('✅ Test passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
