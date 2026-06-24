const cheerio = require('cheerio');

async function crawl(startUrl, maxPages = 20) {
  const visited = new Set();
  const queue = [startUrl];
  const discoveredPages = [];
  const base = new URL(startUrl);

  while (queue.length && visited.size < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const resp = await fetch(url, { timeout: 5000 });
      const html = await resp.text();
      discoveredPages.push({ url, status: resp.status, html });

      await new Promise(r => setTimeout(r, 300));

      const $ = cheerio.load(html);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        try {
          const fullUrl = new URL(href, url);
          fullUrl.hash = '';
          if (fullUrl.hostname === base.hostname && !visited.has(fullUrl.href)) {
            queue.push(fullUrl.href);
          }
        } catch { /* skip */ }
      });
    } catch {
      discoveredPages.push({ url, status: 0, html: '' });
    }
  }

  return discoveredPages;
}

module.exports = { crawl };
