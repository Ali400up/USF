// api/feed.js
const {
  SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, SECTIONS,
  escapeXml, truncate, titleOf, textOf, urlFor, responseHeaders, supabaseSelect
} = require("./_seo-utils");

module.exports = async function handler(req, res) {
  const section = SECTIONS.news;
  let rows = [];

  try {
    rows = await supabaseSelect(section.table, {
      filters: { is_active: "eq.true" },
      order: "created_at.desc",
      limit: 50
    });
  } catch (error) {
    console.error("RSS error:", error.message);
  }

  const items = rows.map(row => {
    const title = titleOf(row, section);
    const link = urlFor("news", row);
    const description = truncate(textOf(row, section), 240);
    const date = row.created_at ? new Date(row.created_at).toUTCString() : new Date().toUTCString();

    return `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <guid>${escapeXml(link)}</guid>
    <pubDate>${escapeXml(date)}</pubDate>
    <description>${escapeXml(description)}</description>
  </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml("آخر أخبار " + SITE_NAME)}</title>
  <link>${escapeXml(SITE_URL + "/news")}</link>
  <description>${escapeXml(DEFAULT_DESCRIPTION)}</description>
  <language>ar</language>
${items}
</channel>
</rss>`;

  res.writeHead(200, responseHeaders("application/rss+xml; charset=utf-8"));
  res.end(xml);
};
