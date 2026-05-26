// api/sitemap.js
const { SITE_URL, SECTIONS, escapeXml, isoDate, responseHeaders, supabaseSelect } = require("./_seo-utils");

function urlBlock(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

module.exports = async function handler(req, res) {
  const urls = [];
  urls.push(urlBlock(`${SITE_URL}/`, isoDate(), "daily", "1.00"));

  for (const [key, section] of Object.entries(SECTIONS)) {
    urls.push(urlBlock(`${SITE_URL}${section.path}`, isoDate(), section.changefreq, section.priority));
  }

  for (const [key, section] of Object.entries(SECTIONS)) {
    try {
      const filters = {};
      if (section.activeField) filters[section.activeField] = "eq.true";
      const rows = await supabaseSelect(section.table, { filters, order: section.order, limit: 1000 });

      for (const row of rows) {
        if (!row.id) continue;
        const lastmod = row.updated_at || row.created_at || row.event_date || row.activity_date || new Date().toISOString();
        urls.push(urlBlock(`${SITE_URL}${section.path}/${encodeURIComponent(row.id)}`, isoDate(lastmod), section.changefreq, section.priority));
      }
    } catch (error) {
      console.error("Sitemap section error:", key, error.message);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.writeHead(200, responseHeaders("application/xml; charset=utf-8"));
  res.end(xml);
};
