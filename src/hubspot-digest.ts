import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
    const rawDesc = extractTag(block, 'description');
    const description = rawDesc
      .replace(/&lt;[^&]*&gt;/g, '')   // strip HTML-encoded tags
      .replace(/<[^>]+>/g, '')          // strip any remaining real tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    if (title && link) {
      items.push({ title, link, pubDate, description, category });
    }
  }

  return items;
}

function isRecent(dateStr: string): boolean {
  if (!dateStr) return false;
  const itemDate = new Date(dateStr);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return itemDate >= cutoff;
}

function formatWhatsApp(allItems: NewsItem[]): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (allItems.length === 0) {
    return `📰 *HubSpot Daily Digest — ${today}*\n\nNo new articles in the last 48 hours.`;
  }

  const byCategory: Record<string, NewsItem[]> = {};
  for (const item of allItems) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  let msg = `📰 *HubSpot Daily Digest — ${today}*\n${allItems.length} new article${allItems.length !== 1 ? 's' : ''}\n`;

  for (const [category, items] of Object.entries(byCategory)) {
    msg += `\n*${category} Blog*\n`;
    for (const item of items) {
      msg += `• ${item.title}\n  ${item.link}\n`;
    }
  }

  // WhatsApp messages cap at ~4096 chars; truncate gracefully
  if (msg.length > 3800) {
    msg = msg.slice(0, 3800) + '\n\n_(truncated)_';
  }

  return msg;
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

  const blogCount = Object.keys(byCategory).length;
  digest += `**${allItems.length} new article${allItems.length !== 1 ? 's' : ''} across ${blogCount} blog${blogCount !== 1 ? 's' : ''}**\n\n---\n\n`;

  for (const [category, items] of Object.entries(byCategory)) {
    digest += `## ${category} Blog\n\n`;
    for (const item of items) {
      const date = item.pubDate
        ? new Date(item.pubDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : '';
      digest += `### [${item.title}](${item.link})\n`;
      if (date) digest += `_Published: ${date}_\n\n`;
      if (item.description) digest += `${item.description}...\n\n`;
    }
  }

  digest += `---\n_Digest generated at ${new Date().toISOString()}_\n`;
  return digest;
}

function fetchFeed(url: string, label: string): NewsItem[] {
  try {
    const xml = execSync(
      `curl -s --max-time 20 -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" "${url}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    const items = parseItems(xml, label);
    return items.filter(item => isRecent(item.pubDate));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch ${label} feed: ${msg}`);
    return [];
  }
}

function main() {
  console.log('Fetching HubSpot RSS feeds...');

  const allItems = FEEDS.flatMap(f => fetchFeed(f.url, f.label));
  const digest = formatDigest(allItems);

  // Write to GitHub Actions step summary if available
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, digest);
    console.log('Digest written to GitHub Actions summary.');
  } else {
    console.log('\n' + digest);
  }

  // Save to output file
  const outDir = 'output';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `hubspot-digest-${dateStr}.md`);
  fs.writeFileSync(outPath, digest);
  console.log(`Digest saved to ${outPath}`);

  // Write WhatsApp-friendly summary for the workflow to pick up
  const waPath = path.join(outDir, 'whatsapp-message.txt');
  fs.writeFileSync(waPath, formatWhatsApp(allItems));
  console.log(`WhatsApp summary saved to ${waPath}`);
}

main();
