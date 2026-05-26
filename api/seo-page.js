// api/seo-page.js
const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, detailOf, imageOf, parseImages, urlFor,
  responseHeaders, supabaseSelect, htmlLayout, notFoundPage, isoDate
} = require("./_seo-utils");

function schemaFor(sectionKey, section, row, title, description, image, url) {
  const base = {
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
    base["@type"] = "NewsArticle";
    base.datePublished = row.created_at || new Date().toISOString();
    base.dateModified = row.updated_at || row.created_at || new Date().toISOString();
    base.author = { "@type": "Organization", "name": SITE_NAME };
    base.publisher = {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` }
    };
  }

  if (sectionKey === "courses") {
    base["@type"] = "Course";
    base.provider = { "@type": "CollegeOrUniversity", "name": "جامعة العلوم والتكنولوجيا", "sameAs": SITE_URL };
  }

  if (sectionKey === "activities" || sectionKey === "events") {
    base["@type"] = "Event";
    base.startDate = row.event_date || row.activity_date || row.created_at || new Date().toISOString();
    base.eventStatus = "https://schema.org/EventScheduled";
    base.eventAttendanceMode = "https://schema.org/MixedEventAttendanceMode";
    base.location = {
      "@type": "Place",
      "name": row.location || "جامعة العلوم والتكنولوجيا"
    };
    base.organizer = {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL + "/"
    };
  }

  if (sectionKey === "committees") {
    base["@type"] = "Organization";
    base.logo = `${SITE_URL}/logo.png`;
  }

  return base;
}

module.exports = async function handler(req, res) {
  const sectionKey = String(req.query.type || "news");
  const id = String(req.query.id || "");
  const section = SECTIONS[sectionKey];

  if (!section || !id) {
    res.writeHead(404, responseHeaders());
    res.end(notFoundPage());
    return;
  }

  try {
    const filters = { id: `eq.${id}` };
    if (section.activeField) filters[section.activeField] = "eq.true";

    const rows = await supabaseSelect(section.table, {
      filters,
      limit: 1
    });

    const row = rows[0];

    if (!row) {
      res.writeHead(404, responseHeaders());
      res.end(notFoundPage("العنصر غير موجود أو غير منشور"));
      return;
    }

    const title = titleOf(row, section);
    const description = truncate(textOf(row, section) || detailOf(row, section) || section.description, 170);
    const details = detailOf(row, section) || textOf(row, section);
    const image = imageOf(row, sectionKey);
    const url = urlFor(sectionKey, row);
    const images = parseImages(row.gallery_images);
    const schema = schemaFor(sectionKey, section, row, title, description, image, url);

    const meta = [];
    if (row.category) meta.push(`<div class="meta-item"><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</div>`);
    if (row.status) meta.push(`<div class="meta-item"><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</div>`);
    if (row.location) meta.push(`<div class="meta-item"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</div>`);
    if (row.event_date || row.activity_date) meta.push(`<div class="meta-item"><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(row.event_date || row.activity_date)}</div>`);
    if (row.seats_total) meta.push(`<div class="meta-item"><i class="fa-solid fa-users"></i> المقاعد: ${escapeHtml(row.seats_taken || 0)} / ${escapeHtml(row.seats_total)}</div>`);
    if (row.value !== undefined && row.value !== null) meta.push(`<div class="meta-item"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(row.value)}</div>`);
    if (row.created_at) meta.push(`<div class="meta-item"><i class="fa-solid fa-clock"></i> آخر تحديث: ${escapeHtml(isoDate(row.updated_at || row.created_at))}</div>`);

    const gallery = images.length > 1 ? `<div class="gallery">${images.map(src => `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy">`).join("")}</div>` : "";

    const body = `<main>
      <section class="hero-mini">
        <div class="container">
          <div class="hero-card">
            <span class="hero-kicker"><i class="${escapeAttr(row.icon || section.icon)}"></i> ${escapeHtml(section.label)}</span>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(description)}</p>
            <div class="hero-actions">
              <a class="btn btn-light" href="${escapeAttr(section.path)}"><i class="fa-solid fa-arrow-right"></i> كل ${escapeHtml(section.label)}</a>
              <a class="btn btn-soft" href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="container detail-layout">
          <article class="detail-box">
            ${image ? `<img class="detail-image" src="${escapeAttr(image)}" alt="${escapeAttr(title)}">` : ""}
            <h2>${escapeHtml(title)}</h2>
            <div class="detail-text">${escapeHtml(details || description)}</div>
            ${gallery}
          </article>
          <aside class="side-box">
            <div class="section-kicker"><i class="${escapeAttr(section.icon)}"></i> معلومات مختصرة</div>
            <div class="detail-meta">
              ${meta.join("") || `<div class="meta-item"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.singular)}</div>`}
            </div>
          </aside>
        </div>
      </section>
    </main>`;

    const html = htmlLayout({
      title: `${title} | ${section.label} | ${SITE_NAME}`,
      description,
      canonical: url,
      image,
      active: section.path,
      body,
      schema,
      color: section.color
    });

    res.writeHead(200, responseHeaders());
    res.end(html);
  } catch (error) {
    const body = `<main class="hero-mini"><div class="container"><div class="hero-card"><span class="hero-kicker"><i class="fa-solid fa-triangle-exclamation"></i> خطأ</span><h1>تعذر تحميل التفاصيل</h1><p>${escapeHtml(error.message)}</p><div class="hero-actions"><a class="btn btn-light" href="/">العودة للرئيسية</a></div></div></div></main>`;
    res.writeHead(500, responseHeaders());
    res.end(htmlLayout({
      title: "خطأ تحميل التفاصيل",
      description: "تعذر تحميل البيانات من قاعدة البيانات.",
      canonical: SITE_URL + "/",
      active: section.path,
      body,
      color: "#D32F2F"
    }));
  }
};
