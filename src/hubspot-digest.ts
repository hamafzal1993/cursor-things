import axios from 'axios';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  category: string;
}

const FEEDS = [
  { url: 'https://blog.hubspot.com/marketing/rss.xml', label: 'Marketing' },
  { url: 'https://blog.hubspot.com/sales/rss.xml', label: 'Sales' },
  { url: 'https://blog.hubspot.com/service/rss.xml', label: 'Service' },
  { url: 'https://blog.hubspot.com/website/rss.xml', label: 'Website' },
];

function extractTag(xml: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return match ? match[1].trim() : '';
}

function parseItems(xml: string, category: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description')
      .replace(/<[^>]+>/g, '')
      .slice(0, 200)
      .trim();

    if (title && link) {
      items.push({ title, link, pubDate, description, category });
    }
  }

  return items;
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const itemDate = new Date(dateStr);
  const now = new Date();
  // Include items from last 24 hours, fallback to last 48h if feed has stale data
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  return itemDate >= cutoff;
}

function formatDigest(allItems: NewsItem[]): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const byCategory: Record<string, NewsItem[]> = {};
  for (const item of allItems) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  let digest = `# HubSpot Daily Digest — ${today}\n\n`;

  if (allItems.length === 0) {
    digest += '_No new articles published in the last 48 hours._\n';
    return digest;
  }

  digest += `**${allItems.length} new article${allItems.length !== 1 ? 's' : ''} across ${Object.keys(byCategory).length} blog${Object.keys(byCategory).length !== 1 ? 's' : ''}**\n\n---\n\n`;

  for (const [category, items] of Object.entries(byCategory)) {
    digest += `## ${category} Blog\n\n`;
    for (const item of items) {
      const date = item.pubDate ? new Date(item.pubDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      digest += `### [${item.title}](${item.link})\n`;
      if (date) digest += `_Published: ${date}_\n\n`;
      if (item.description) digest += `${item.description}...\n\n`;
    }
  }

  digest += `---\n_Digest generated at ${new Date().toISOString()}_\n`;
  return digest;
}

async function fetchFeed(url: string, label: string): Promise<NewsItem[]> {
  try {
    const response = await axios.get<string>(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'HubSpot-Daily-Digest/1.0' },
      responseType: 'text',
    });
    const items = parseItems(response.data, label);
    return items.filter(item => isToday(item.pubDate));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch ${label} feed: ${msg}`);
    return [];
  }
}

async function main() {
  console.log('Fetching HubSpot RSS feeds...');

  const results = await Promise.all(FEEDS.map(f => fetchFeed(f.url, f.label)));
  const allItems = results.flat();

  const digest = formatDigest(allItems);

  // Write to GitHub Actions step summary if available
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const fs = await import('fs');
    fs.appendFileSync(summaryPath, digest);
    console.log('Digest written to GitHub Actions summary.');
  } else {
    console.log('\n' + digest);
  }

  // Save to output file
  const fs = await import('fs');
  const outDir = 'output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = `${outDir}/hubspot-digest-${dateStr}.md`;
  fs.writeFileSync(outPath, digest);
  console.log(`Digest saved to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
