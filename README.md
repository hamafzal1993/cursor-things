# Product Hunt Scraper

A TypeScript-based web scraper that extracts external website URLs from Product Hunt posts for the month of December.

## Features

- Scrapes Product Hunt posts for all days in December 2025
- Extracts product names, taglines, and external website URLs
- Exports data to both JSON and CSV formats
- Implements respectful scraping with delays between requests
- Handles errors gracefully and provides detailed logging

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cursor-things
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Run the scraper

```bash
npm run scrape
```

This will:
1. Scrape all Product Hunt posts from December 2025 (up to today's date)
2. Extract external website URLs for each product
3. Export the data to `output/producthunt_december_2025.json` and `output/producthunt_december_2025.csv`

### Build the project

```bash
npm run build
```

### Run the compiled version

```bash
npm start
```

## Output Format

### JSON Format

```json
[
  {
    "name": "Product Name",
    "tagline": "Product tagline or description",
    "websiteUrl": "https://example.com",
    "productHuntUrl": "https://www.producthunt.com/posts/product-name",
    "date": "2025-12-01"
  }
]
```

### CSV Format

```csv
Date,Product Name,Tagline,Website URL,Product Hunt URL
2025-12-01,"Product Name","Product tagline or description",https://example.com,https://www.producthunt.com/posts/product-name
```

## Configuration

You can modify the following parameters in `src/scraper.ts`:

- `delay`: Time between requests (default: 2000ms)
- `year`: Year to scrape (default: 2025)
- Output file names in the `main()` function

## Project Structure

```
cursor-things/
├── src/
│   └── scraper.ts          # Main scraper implementation
├── output/                 # Output directory for scraped data
│   ├── *.json              # JSON output files
│   └── *.csv               # CSV output files
├── dist/                   # Compiled JavaScript (generated)
├── package.json            # Project dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## How It Works

1. **Date Generation**: Generates all dates in December 2025
2. **Page Fetching**: Fetches Product Hunt's time-travel pages for each date
3. **Product Parsing**: Extracts product information from the HTML
4. **URL Extraction**: Visits each product page to find the external website URL
5. **Data Export**: Saves the collected data to JSON and CSV files

## Important Notes

- The scraper implements a 2-second delay between requests to be respectful to Product Hunt's servers
- It only scrapes dates up to today (skips future dates)
- The scraper may need updates if Product Hunt changes their HTML structure
- Some products might not have external website URLs

## Limitations

- Web scraping depends on the HTML structure, which may change
- Rate limiting or blocking may occur if used too aggressively
- Not all products may have external website URLs available

## Legal & Ethical Considerations

- This scraper is for educational and research purposes
- Please review Product Hunt's Terms of Service before using
- Use responsibly and respect rate limits
- Consider using Product Hunt's official API if available for your use case

## Troubleshooting

### No products found

- Check if Product Hunt's HTML structure has changed
- Verify your internet connection
- Check the console output for specific errors

### Rate limiting

- Increase the `delay` value in the scraper
- Reduce the number of dates being scraped

## Contributing

Feel free to submit issues or pull requests to improve the scraper.

## License

MIT
