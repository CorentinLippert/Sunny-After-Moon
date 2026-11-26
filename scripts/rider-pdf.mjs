// Turns the printable tech rider pages (dist/<lang>/tech/sheet/) into PDFs in public/downloads/.
// Usage: npm run build && npm run rider:pdf  (needs Playwright with Chromium: npx playwright install chromium)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const dist = new URL('../dist/', import.meta.url).pathname;
const out = new URL('../public/downloads/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(dist, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const lang of ['en', 'nl', 'fr']) {
  const prefix = lang === 'en' ? '' : `/${lang}`;
  await page.goto(`http://localhost:${port}${prefix}/tech/sheet/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const file = join(out, `sunny-after-moon-tech-rider-${lang}.pdf`);
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log('wrote', file);
}
await browser.close();
server.close();
