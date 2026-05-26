// api/seo-page.js
// صفحة التفاصيل تستخدم كلاسات المودال/التفاصيل الموجودة في الموقع الرئيسي قدر الإمكان.
const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, detailOf, imageOf, parseImages, urlFor,
  responseHeaders, supabaseSelect, htmlLayout, errorPage, isoDate
} = require("./_seo-utils");

function schemaFor(sectionKey, section, row, title, description, image, url) {
  const schema = {
    "@context": "https://schema.org",
    "@type": section.schema || "Article",
    "name": title,
    "headline": title,
    "description": description,
    "url": url,
    "image": image,
    "isPartOf": {
      "@type": "WebSite",
      "name": SITE_NAME,
      "url": SITE_URL + "/"
    }
  };

  if (sectionKey === "news") {
    schema["@type"] = "NewsArticle";
    schema.datePublished = row.created_at || new Date().toISOString();
    schema.dateModified = row.updated_at || row.created_at || new Date().toISOString();
    schema.author = { "@type": "Organization", "name": SITE_NAME };
    schema.publisher = {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` }
    };
  }

  if (sectionKey === "courses") {
    schema["@type"] = "Course";
    schema.provider = { "@type": "CollegeOrUniversity", "name": "جامعة العلوم والتكنولوجيا", "sameAs": SITE_URL };
  }

  if (sectionKey === "activities" || sectionKey === "events") {
    schema["@type"] = "Event";
    schema.startDate = row.event_date || row.activity_date || row.created_at || new Date().toISOString();
    schema.eventStatus = "https://schema.org/EventScheduled";
    schema.eventAttendanceMode = "https://schema.org/MixedEventAttendanceMode";
    schema.location = { "@type": "Place", "name": row.location || "جامعة العلوم والتكنولوجيا" };
    schema.organizer = { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL + "/" };
  }

  if (sectionKey === "committees") {
    schema["@type"] = "Organization";
    schema.logo = `${SITE_URL}/logo.png`;
  }

  return schema;
}

module.exports = async function handler(req, res) {
  const sectionKey = String(req.query.type || "news");
  const id = String(req.query.id || "");
  const section = SECTIONS[sectionKey];

  if (!section || !id) {
    res.writeHead(404, responseHeaders());
    res.end(errorPage());
    return;
  }

  try {
    const filters = { id: `eq.${id}` };
    if (section.activeField) filters[section.activeField] = "eq.true";

    const rows = await supabaseSelect(section.table, { filters, limit: 1 });
    const row = rows[0];

    if (!row) {
      res.writeHead(404, responseHeaders());
      res.end(errorPage("العنصر غير موجود أو غير منشور"));
      return;
    }

    const title = titleOf(row, section);
    const description = truncate(textOf(row, section) || detailOf(row, section) || section.description, 170);
    const details = detailOf(row, section) || textOf(row, section) || description;
    const image = imageOf(row);
    const url = urlFor(sectionKey, row);
    const images = parseImages(row.gallery_images);
    const schema = schemaFor(sectionKey, section, row, title, description, image, url);

    const meta = [];
    if (row.category) meta.push(`<span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
    if (row.status) meta.push(`<span class="tag"><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
    if (row.location) meta.push(`<span class="tag"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);
    if (row.event_date || row.activity_date) meta.push(`<span class="tag"><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(row.event_date || row.activity_date)}</span>`);
    if (row.seats_total) meta.push(`<span class="tag"><i class="fa-solid fa-users"></i> ${escapeHtml(row.seats_taken || 0)} / ${escapeHtml(row.seats_total)}</span>`);
    if (row.value !== undefined && row.value !== null) meta.push(`<span class="tag"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(row.value)}</span>`);
    if (row.created_at) meta.push(`<span class="tag"><i class="fa-solid fa-clock"></i> ${escapeHtml(isoDate(row.updated_at || row.created_at))}</span>`);

    const gallery = images.length > 1
      ? `<div class="activity-details-gallery">${images.map(src => `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy">`).join("")}</div>`
      : "";

    const body = `<main>
      <section class="hero" style="min-height:auto;padding-bottom:36px">
        <div class="container">
          <div class="hero-content reveal show" style="max-width:900px;margin-inline:auto;text-align:center">
            <div class="hero-badge"><i class="${escapeAttr(row.icon || section.icon)}"></i> ${escapeHtml(section.label)}</div>
            <h1><span class="gradient-text">${escapeHtml(title)}</span></h1>
            <p>${escapeHtml(description)}</p>
            <div class="hero-actions" style="justify-content:center">
              <a class="btn btn-dark" href="${escapeAttr(section.path)}"><i class="fa-solid fa-arrow-right"></i> كل ${escapeHtml(section.label)}</a>
              <a class="btn btn-light" href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="container activity-details-layout">
          <div class="activity-details-info reveal show">
            <div class="activity-info-card">
              <h4><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(title)}</h4>
              <p style="white-space:pre-line">${escapeHtml(details)}</p>
            </div>
            ${meta.length ? `<div class="activity-info-card"><h4><i class="fa-solid fa-circle-info"></i> معلومات مختصرة</h4><div class="tags">${meta.join("")}</div></div>` : ""}
          </div>
          <div class="activity-details-gallery reveal show">
            ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy">` : ""}
            ${gallery ? images.slice(1).map(src => `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy">`).join("") : ""}
          </div>
        </div>
      </section>
    </main>`;

    const html = htmlLayout({
      title: `${title} | ${section.label} | ${SITE_NAME}`,
      description,
      canonical: url,
      image,
      activePath: section.path,
      body,
      schema
    });

    res.writeHead(200, responseHeaders());
    res.end(html);
  } catch (error) {
    res.writeHead(500, responseHeaders());
    res.end(errorPage(`تعذر تحميل التفاصيل: ${error.message}`));
  }
};
