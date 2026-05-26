// api/section-page.js
const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, imageOf,
  responseHeaders, supabaseSelect, htmlLayout
} = require("./_seo-utils");

function cardHtml(sectionKey, section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row, sectionKey);
  const url = `${section.path}/${encodeURIComponent(row.id)}`;
  const meta = [];

  if (row.category) meta.push(`<span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
  if (row.status) meta.push(`<span class="tag"><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
  if (row.event_date || row.activity_date) meta.push(`<span class="tag"><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(row.event_date || row.activity_date)}</span>`);
  if (row.location) meta.push(`<span class="tag"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);
  if (row.value !== undefined && row.value !== null) meta.push(`<span class="tag"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(row.value)}</span>`);

  return `<article class="content-card">
    <div class="cover">
      ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy">` : ""}
      <h3><i class="${escapeAttr(row.icon || section.icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      <div class="tags">${meta.join("") || `<span class="tag"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.singular)}</span>`}</div>
      <p>${escapeHtml(truncate(text, 180))}</p>
      <div class="card-actions">
        <a class="btn btn-dark" href="${escapeAttr(url)}"><i class="fa-solid fa-arrow-left"></i> عرض التفاصيل</a>
      </div>
    </div>
  </article>`;
}

module.exports = async function handler(req, res) {
  const sectionKey = String(req.query.section || "news");
  const section = SECTIONS[sectionKey];

  if (!section) {
    res.writeHead(404, responseHeaders());
    res.end("Section not found");
    return;
  }

  try {
    const filters = {};
    if (section.activeField) filters[section.activeField] = "eq.true";

    const rows = await supabaseSelect(section.table, {
      filters,
      order: section.order,
      limit: 1000
    });

    const cards = rows.length
      ? rows.map(row => cardHtml(sectionKey, section, row)).join("\n")
      : `<div class="empty-state"><i class="fa-solid fa-circle-info"></i><br>لا توجد عناصر منشورة حاليًا في قسم ${escapeHtml(section.label)}.</div>`;

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${section.label} | ${SITE_NAME}`,
      "description": section.description,
      "url": `${SITE_URL}${section.path}`,
      "isPartOf": {
        "@type": "WebSite",
        "name": SITE_NAME,
        "url": SITE_URL + "/"
      },
      "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": rows.length,
        "itemListElement": rows.map((row, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": titleOf(row, section),
          "url": `${SITE_URL}${section.path}/${row.id}`
        }))
      }
    };

    const body = `<main>
      <section class="hero-mini">
        <div class="container">
          <div class="hero-card">
            <span class="hero-kicker"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.label)}</span>
            <h1>${escapeHtml(section.label)}</h1>
            <p>${escapeHtml(section.description)}</p>
            <div class="hero-actions">
              <a class="btn btn-light" href="/"><i class="fa-solid fa-house"></i> الصفحة الرئيسية</a>
              <a class="btn btn-soft" href="/#${sectionKey === "news" ? "latest-news" : sectionKey}"><i class="fa-solid fa-location-arrow"></i> عرض داخل الموقع الرئيسي</a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="container">
          <div class="section-header">
            <div>
              <span class="section-kicker"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.singular)}</span>
              <h2 class="section-title">كل ${escapeHtml(section.label)}</h2>
            </div>
            <p class="section-desc">هذه الصفحة تعرض بيانات القسم مباشرة من قاعدة البيانات بنفس طابع وتصميم الموقع الرئيسي.</p>
          </div>
          <div class="cards-grid">${cards}</div>
        </div>
      </section>
    </main>`;

    const html = htmlLayout({
      title: `${section.label} | ${SITE_NAME}`,
      description: section.description,
      canonical: `${SITE_URL}${section.path}`,
      image: `${SITE_URL}/og-image.png`,
      active: section.path,
      body,
      schema,
      color: section.color
    });

    res.writeHead(200, responseHeaders());
    res.end(html);
  } catch (error) {
    const body = `<main class="hero-mini"><div class="container"><div class="hero-card"><span class="hero-kicker"><i class="fa-solid fa-triangle-exclamation"></i> خطأ</span><h1>تعذر تحميل ${escapeHtml(section.label)}</h1><p>${escapeHtml(error.message)}</p><div class="hero-actions"><a class="btn btn-light" href="/">العودة للرئيسية</a></div></div></div></main>`;
    res.writeHead(500, responseHeaders());
    res.end(htmlLayout({
      title: `خطأ تحميل ${section.label}`,
      description: "تعذر تحميل البيانات من قاعدة البيانات.",
      canonical: `${SITE_URL}${section.path}`,
      active: section.path,
      body,
      color: "#D32F2F"
    }));
  }
};
