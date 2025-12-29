# Stealth Browser Scraper Guide

This guide explains how to use the stealth browser scraper that bypasses Product Hunt's bot detection.

## What is the Stealth Scraper?

The stealth scraper uses **Puppeteer-Extra** with the **Stealth Plugin** to make automated browsing look like a real user:

- Overrides bot detection properties (`navigator.webdriver`)
- Uses realistic browser headers and settings
- Mimics human-like browsing behavior
- Extracts data from both DOM elements and embedded JSON

## Requirements

### System Requirements
- Node.js v16 or higher
- Internet access (to download Chromium during installation)
- ~300MB free disk space (for Chromium)

### Network Requirements
- Access to `storage.googleapis.com` (for Chromium download)
- Access to `producthunt.com` (for scraping)

## Installation

1. **Clone and navigate to the repository**
   ```bash
   git clone <repository-url>
   cd cursor-things
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

   **Note**: This will download Chromium (~200MB). If you see download errors:
   - Check your internet connection
   - Ensure you can access `storage.googleapis.com`
   - Try using a VPN if behind a firewall

3. **Verify installation**
   ```bash
   npx ts-node test-scraper.ts
   ```
   This runs a quick test to ensure Puppeteer is working.

## Usage

### Basic Usage

Run the scraper for all of December 2025:

```bash
npm run scrape:stealth
```

### Output

The scraper will:
1. Launch a headless Chrome browser
2. Visit Product Hunt for each day in December
3. Extract product names, taglines, and external websites
4. Save results to:
   - `output/producthunt_december_2025_stealth.json`
   - `output/producthunt_december_2025_stealth.csv`

### Configuration

Edit `.env` to customize:

```env
# Delay between requests (milliseconds)
DELAY_MS=3000

# Year to scrape
YEAR=2025
```

## How It Works

### 1. Browser Launch
```typescript
await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
  ],
});
```

### 2. Anti-Detection Measures
- Stealth plugin automatically:
  - Masks automation signatures
  - Spoofs Chrome features
  - Prevents WebRTC leaks
  - Passes bot detection tests

- Manual overrides:
  ```typescript
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
  });
  ```

### 3. Data Extraction
- **Method 1**: DOM Scraping
  - Finds product links: `a[href^="/posts/"]`
  - Extracts names and taglines from HTML elements

- **Method 2**: JSON Extraction
  - Parses Next.js data from `<script type="application/json">`
  - More reliable than DOM scraping

### 4. Website URL Extraction
For each product:
1. Visit the product page
2. Look for "Visit" or "Website" buttons
3. Extract the first external link (non-Product Hunt domain)
4. Filter out social media links

## Troubleshooting

### Chromium Download Fails

**Error**: `Failed to download Chromium`

**Solutions**:
- Check internet connection
- Try: `PUPPETEER_SKIP_DOWNLOAD=false npm install`
- Manually specify Chromium path:
  ```typescript
  executablePath: '/path/to/chrome'
  ```

### 403 Errors Still Occur

**Possible causes**:
- IP-based rate limiting
- Product Hunt updated their bot detection

**Solutions**:
- Increase `DELAY_MS` in `.env`
- Add random delays between requests
- Use residential proxies
- Run from different IP address

### Scraper Finds No Products

**Possible causes**:
- Product Hunt changed their HTML structure
- JavaScript-rendered content not loaded

**Solutions**:
- Check `test-screenshot.png` to see what the page looks like
- Increase wait time after page load
- Update selectors in the code

### Out of Memory

**Error**: `JavaScript heap out of memory`

**Solutions**:
- Process fewer days at once
- Increase Node.js memory:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" npm run scrape:stealth
  ```
- Close browser between batches

## Performance

### Speed
- ~5-10 seconds per date (including all products)
- ~29 dates in December = ~5-10 minutes total
- Can be adjusted with `DELAY_MS`

### Resource Usage
- Memory: ~200-500MB
- Disk: ~300MB (Chromium)
- Network: Depends on number of products

## Limitations

### Rate Limiting
- Product Hunt may block excessive requests
- Use delays between requests (`DELAY_MS`)
- Consider scraping during off-peak hours

### Data Accuracy
- HTML structure may change
- Some products may not have external websites
- Website URLs may be affiliate links

### Legal & Ethical
- Review Product Hunt's Terms of Service
- Respect robots.txt
- Don't overload their servers
- Use data responsibly

## Advanced Usage

### Custom Date Range

Edit `src/scraper-stealth.ts`:

```typescript
// Only scrape first week of December
const dates = this.getDatesInDecember(year).slice(0, 7);
```

### Take Screenshots

Uncomment in code:

```typescript
await page.screenshot({ path: `debug-${date}.png` });
```

### Use Proxies

Add to launch options:

```typescript
await puppeteer.launch({
  args: ['--proxy-server=http://proxy:port'],
});
```

### Headful Mode (See Browser)

Change `headless` option:

```typescript
await puppeteer.launch({
  headless: false,  // Will open visible browser
});
```

## Example Output

### JSON Format
```json
[
  {
    "name": "Example Product",
    "tagline": "The best product ever",
    "websiteUrl": "https://example.com",
    "productHuntUrl": "https://www.producthunt.com/posts/example",
    "date": "2025-12-01"
  }
]
```

### CSV Format
```csv
Date,Product Name,Tagline,Website URL,Product Hunt URL
2025-12-01,"Example Product","The best product ever",https://example.com,https://www.producthunt.com/posts/example
```

## Support

For issues:
1. Check this guide
2. Review error messages carefully
3. Try the test script: `npx ts-node test-scraper.ts`
4. Check GitHub issues
5. Ensure you're using the latest code

## Contributing

Found a bug or improvement?
- Update the selectors if Product Hunt changes their structure
- Add better error handling
- Improve anti-detection measures
- Share your findings!
