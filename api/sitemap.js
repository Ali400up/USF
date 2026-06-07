// api/sitemap.js
// Sitemap ديناميكي بنفس فكرة الملف السابق:
// يقرأ الأقسام من SECTIONS ويقرأ عناصر كل قسم من Supabase تلقائيًا.
// لا توجد روابط ثابتة داخل الكود غير الصفحة الرئيسية وصفحات الأقسام الموجودة في SECTIONS.

const { SITE_URL, SECTIONS, escapeXml, isoDate, responseHeaders, supabaseSelect } = require("./_seo-utils");

function urlBlock(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

function rowLastmod(row = {}) {
  return row.updated_at ||
    row.created_at ||
    row.event_date ||
    row.activity_date ||
    row.achievement_date ||
    row.initiative_date ||
    new Date().toISOString();
}

function latestLastmod(rows = []) {
  const dates = rows
    .map(rowLastmod)
    .map(value => new Date(value).getTime())
    .filter(value => !Number.isNaN(value));

  if (!dates.length) return new Date().toISOString();
  return new Date(Math.max(...dates)).toISOString();
}

function changefreqFor(key, section = {}) {
  // بدون monthly نهائيًا:
  // الأقسام المتغيرة بسرعة hourly، والباقي daily.
  if (["news", "activities", "courses", "events"].includes(key)) return "hourly";
  return "daily";
}

function priorityFor(key, section = {}) {
  if (section.priority) return section.priority;
  if (key === "news") return "0.90";
  if (key === "courses") return "0.85";
  if (key === "achievements") return "0.80";
  return "0.75";
}

function publicIdFor(key, row = {}) {
  // الأخبار تبقى بنفس نظامك السابق:
  // /news/1 إذا public_id موجود، وباقي الأقسام تستخدم id.
  if (key === "news" && row.public_id) return row.public_id;
  return row.id;
}

const STATIC_SECTION_PAGES = [
  { path: "/join", changefreq: "daily", priority: "0.86" },
  { path: "/issues", changefreq: "daily", priority: "0.82" },
  { path: "/about", changefreq: "weekly", priority: "0.74" },
  { path: "/goals", changefreq: "weekly", priority: "0.74" }
];

module.exports = async function handler(req, res) {
  const urls = [];
  const now = new Date().toISOString();

  // الصفحة الرئيسية
  urls.push(urlBlock(`${SITE_URL}/`, isoDate(now), "hourly", "1.00"));

  // صفحات ثابتة مهمة لمحركات البحث مثل /join
  for (const page of STATIC_SECTION_PAGES) {
    urls.push(urlBlock(`${SITE_URL}${page.path}`, isoDate(now), page.changefreq, page.priority));
  }

  // الأقسام + عناصر قاعدة البيانات
  for (const [key, section] of Object.entries(SECTIONS)) {
    const freq = changefreqFor(key, section);
    const priority = priorityFor(key, section);

    try {
      const filters = {};
      if (section.activeField) filters[section.activeField] = "eq.true";

      const rows = await supabaseSelect(section.table, {
        filters,
        order: section.order,
        limit: 1000
      });

      const sectionLastmod = rows && rows.length ? latestLastmod(rows) : now;

      // صفحة القسم مثل /achievements
      urls.push(urlBlock(
        `${SITE_URL}${section.path}`,
        isoDate(sectionLastmod),
        freq,
        priority
      ));

      // صفحات العناصر مثل /achievements/id
      for (const row of rows || []) {
        if (!row || !row.id) continue;

        const publicId = publicIdFor(key, row);
        urls.push(urlBlock(
          `${SITE_URL}${section.path}/${encodeURIComponent(publicId)}`,
          isoDate(rowLastmod(row)),
          freq,
          priority
        ));
      }
    } catch (error) {
      console.error("Sitemap section error:", key, error.message);

      // حتى لو فشل جدول معين، تبقى صفحة القسم موجودة في الخريطة
      urls.push(urlBlock(
        `${SITE_URL}${section.path}`,
        isoDate(now),
        freq,
        priority
      ));
    }
  }

  // إزالة التكرار
  const seen = new Set();
  const uniqueUrls = urls.filter(block => {
    const match = block.match(/<loc>(.*?)<\/loc>/);
    const loc = match ? match[1] : block;
    if (seen.has(loc)) return false;
    seen.add(loc);
    return true;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls.join("\n")}
</urlset>`;

  res.writeHead(200, {
    ...responseHeaders("application/xml; charset=utf-8"),
    "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=30"
  });

  res.end(xml);
};
