// api/section-page.js
// صفحات الأقسام تستخدم كلاسات الموقع الرئيسي نفسها: section-header, activities-grid, courses-grid, committees-grid...
const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, imageOf,
  responseHeaders, supabaseSelect, htmlLayout, errorPage
} = require("./_seo-utils");

function renderCard(sectionKey, section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const url = `${section.path}/${encodeURIComponent(row.id)}`;

  if (sectionKey === "committees") {
    return `<article class="committee-card reveal show">
      <div class="avatar"><i class="${escapeAttr(row.icon || section.icon)}"></i></div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(truncate(text, 160))}</p>
      <div class="committee-actions">
        <a class="btn btn-soft" href="${escapeAttr(url)}"><i class="fa-solid fa-circle-info"></i> عرض التفاصيل</a>
        <a class="btn btn-dark" href="/#committees"><i class="fa-solid fa-house"></i> داخل الرئيسية</a>
      </div>
    </article>`;
  }

  if (sectionKey === "achievements") {
    return `<article class="achievement-card reveal show">
      <div class="achievement-icon"><i class="${escapeAttr(row.icon || section.icon)}"></i></div>
      <div class="achievement-number">${escapeHtml(row.value || "—")}</div>
      <p>${escapeHtml(title)}</p>
    </article>`;
  }

  if (sectionKey === "events") {
    return `<article class="timeline-card reveal show">
      <div class="date-box">${escapeHtml(row.event_date || "قريبًا")}</div>
      <div class="timeline-content">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(row.location || text || section.description)}</p>
      </div>
      <a class="timeline-status" href="${escapeAttr(url)}"><i class="fa-solid fa-arrow-left"></i> التفاصيل</a>
    </article>`;
  }

  const cardClass = section.cardClass || "activity-card";
  const coverClass = row.is_light ? "cover light-cover" : "cover";
  const meta = [];
  if (row.category) meta.push(`<span><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
  if (row.status) meta.push(`<span><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
  if (row.location) meta.push(`<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);
  if (row.activity_date || row.event_date) meta.push(`<span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(row.activity_date || row.event_date)}</span>`);

  return `<article class="${cardClass} reveal show">
    <div class="${coverClass}">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(row.icon || section.icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      ${meta.length ? `<div class="activity-meta">${meta.join("")}</div>` : ""}
      <p>${escapeHtml(truncate(text, 190))}</p>
      <div class="${sectionKey === "courses" ? "course-actions" : "activity-actions"}">
        <a class="btn btn-dark" href="${escapeAttr(url)}"><i class="fa-solid fa-arrow-left"></i> عرض التفاصيل</a>
        <a class="btn btn-soft" href="${escapeAttr(section.mainAnchor)}"><i class="fa-solid fa-house"></i> داخل الرئيسية</a>
      </div>
    </div>
  </article>`;
}

module.exports = async function handler(req, res) {
  const sectionKey = String(req.query.section || "news");
  const section = SECTIONS[sectionKey];

  if (!section) {
    res.writeHead(404, responseHeaders());
    res.end(errorPage("القسم غير موجود"));
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

    const itemsHtml = rows.length
      ? rows.map(row => renderCard(sectionKey, section, row)).join("\n")
      : `<div class="empty-state"><i class="fa-solid fa-circle-info"></i><br>لا توجد عناصر منشورة حاليًا في قسم ${escapeHtml(section.label)}.</div>`;

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": `${section.label} | ${SITE_NAME}`,
      "description": section.description,
      "url": `${SITE_URL}${section.path}`,
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

    const gridClass = section.gridClass || "activities-grid";
    const body = `<main>
      <section class="hero" style="min-height:auto;padding-bottom:36px">
        <div class="container">
          <div class="hero-content reveal show" style="max-width:900px;margin-inline:auto;text-align:center">
            <div class="hero-badge"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.label)}</div>
            <h1><span class="gradient-text">${escapeHtml(section.label)}</span></h1>
            <p>${escapeHtml(section.description)}</p>
            <div class="hero-actions" style="justify-content:center">
              <a class="btn btn-dark" href="/"><i class="fa-solid fa-house"></i> الصفحة الرئيسية</a>
              <a class="btn btn-light" href="${escapeAttr(section.mainAnchor)}"><i class="fa-solid fa-location-arrow"></i> عرض داخل الموقع الرئيسي</a>
            </div>
          </div>
        </div>
      </section>

      <section id="${escapeAttr(sectionKey)}">
        <div class="container">
          <div class="section-header reveal show">
            <div>
              <div class="section-kicker"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.singular)}</div>
              <h2 class="section-title">كل ${escapeHtml(section.label)}</h2>
            </div>
            <p class="section-desc">نفس تنسيق الموقع الرئيسي، والبيانات تظهر مباشرة من قاعدة البيانات.</p>
          </div>
          <div class="${gridClass}">${itemsHtml}</div>
        </div>
      </section>
    </main>`;

    const html = htmlLayout({
      title: `${section.label} | ${SITE_NAME}`,
      description: section.description,
      canonical: `${SITE_URL}${section.path}`,
      image: `${SITE_URL}/og-image.png`,
      activePath: section.path,
      body,
      schema
    });

    res.writeHead(200, responseHeaders());
    res.end(html);
  } catch (error) {
    res.writeHead(500, responseHeaders());
    res.end(errorPage(`تعذر تحميل ${section.label}: ${error.message}`));
  }
};
