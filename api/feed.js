const { SITE_URL, SECTIONS, headers, escapeXml, safeText, truncate, urlFor, supabaseSelect } = require('./_seo-utils');

module.exports = async function handler(req, res) {
  const section = SECTIONS.news;
  let rows = [];
  try {
    rows = await supabaseSelect(section.table, { active: true, order: 'created_at.desc', limit: 50 });
  } catch (error) {
    console.error(error.message);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>آخر أخبار ملتقى الطالب الجامعي</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>أحدث أخبار ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا</description>
    <language>ar</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${(rows || []).map(row => `<item>
      <title>${escapeXml(safeText(row.title, 'خبر جديد'))}</title>
      <link>${escapeXml(urlFor('news', row))}</link>
      <guid>${escapeXml(urlFor('news', row))}</guid>
      <pubDate>${new Date(row.created_at || Date.now()).toUTCString()}</pubDate>
      <description>${escapeXml(truncate(row.description || row.ticker || row.title, 300))}</description>
    </item>`).join('\n    ')}
  </channel>
</rss>`;
  res.writeHead(200, headers('application/rss+xml; charset=utf-8'));
  res.end(xml);
};
