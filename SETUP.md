# Product Hunt Scraper Setup Guide

This guide will help you set up the Product Hunt scraper to successfully collect data.

## Problem: 403 Forbidden Errors

Product Hunt blocks automated scraping requests to protect their service. You'll encounter 403 errors when trying to scrape without proper authentication.

## Solutions

### Option 1: Use Product Hunt's Official API (Recommended)

1. **Create a Product Hunt Account**
   - Go to https://www.producthunt.com/
   - Sign up or log in

2. **Register for API Access**
   - Visit https://www.producthunt.com/v2/oauth/applications
   - Create a new application
   - You'll receive:
     - Client ID
     - Client Secret
     - API Token

3. **Configure the Scraper**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and add your API token:
     ```
     PRODUCT_HUNT_API_TOKEN=your_actual_token_here
     ```

4. **Run the Scraper**
   ```bash
   npm run scrape
   ```

### Option 2: Manual Data Collection

Since automated scraping is blocked, you can:

1. **Manually browse Product Hunt**
   - Visit https://www.producthunt.com/
   - Browse each day in December 2025
   - Manually collect product information

2. **Use Product Hunt's Search**
   - Use filters to find products from December
   - Export data manually

3. **Browser Extensions**
   - Use browser extensions designed for data collection
   - These run in your actual browser and avoid bot detection

### Option 3: Use a Headless Browser with Anti-Detection

If you need to scrape without API access, you can:

1. **Install Puppeteer Extra with Stealth Plugin**
   ```bash
   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
   ```

2. **Modify the scraper** to use Puppeteer with stealth mode
   - This makes the browser appear more human-like
   - Still may be detected and blocked

## Understanding the 403 Error

The 403 Forbidden error means:
- Product Hunt's servers recognize the request as automated
- They're protecting their data from unauthorized scraping
- They require proper authentication for API access

## API Rate Limits

When using the official API:
- Check Product Hunt's API documentation for rate limits
- Respect their terms of service
- Use appropriate delays between requests (configured in `.env`)

## Legal and Ethical Considerations

- Always review and comply with Product Hunt's Terms of Service
- Respect rate limits to avoid overloading their servers
- Consider using the official API for legitimate use cases
- If collecting large amounts of data, consider contacting Product Hunt directly

## Troubleshooting

### Still Getting 403 Errors with API Token

1. Verify your token is correct
2. Check if your token has the necessary permissions
3. Ensure you're using the correct API endpoint
4. Check Product Hunt's API status page

### API Token Not Working

1. Regenerate your API token
2. Check for typos in your `.env` file
3. Ensure `.env` is in the root directory
4. Restart the application after changing `.env`

## Alternative Data Sources

If you cannot access Product Hunt's data:

1. **Product Hunt API Alternatives**
   - Some third-party services aggregate Product Hunt data
   - These may have their own APIs

2. **RSS Feeds**
   - Product Hunt may offer RSS feeds for certain content

3. **Public Datasets**
   - Check Kaggle, GitHub, or other platforms for Product Hunt datasets

## Support

For Product Hunt API support:
- Documentation: https://api.producthunt.com/v2/docs
- Contact: Check Product Hunt's developer support channels

For this scraper:
- Check the README.md
- Review the code comments
- Open an issue if you find bugs
