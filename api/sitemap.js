const { SITE_URL, SECTIONS, STATIC_PAGES, headers, escapeXml, urlFor, supabaseSelect } = require('./_seo-utils');

module.exports = async function handler(req, res) {
  const now = new Date().toISOString();
  const urls = STATIC_PAGES.map(p => ({ loc: `${SITE_URL}${p.loc}`, lastmod: now, priority: p.priority || '0.7' }));

  for (const [key, section] of Object.entries(SECTIONS)) {
    try {
      const rows = await supabaseSelect(section.table, { active: section.active, order: section.order, limit: 500 });
      for (const row of rows || []) {
        const rawDate = row.updated_at || row.created_at || row.event_date || row.activity_date || now;
        const date = rawDate ? new Date(rawDate).toISOString() : now;
        urls.push({ loc: urlFor(key, row), lastmod: date, priority: key === 'news' ? '0.9' : '0.8' });
      }
    } catch (error) {
      console.error(`sitemap ${section.table}`, error.message);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${escapeXml(u.priority)}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.writeHead(200, headers('application/xml; charset=utf-8'));
  res.end(xml);
};
