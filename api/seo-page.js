// api/seo-page.js
// صفحة تفاصيل أي عنصر حسب ID
// الهدف: عند فتح /news/:id أو /courses/:id أو /activities/:id أو غيرها
// تظهر صفحة منظمة جدًا، بنفس روح وشكل الموقع الرئيسي، وتعرض كل البيانات المهمة والصور والروابط.

const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, detailOf, imageOf, parseImages, urlFor,
  responseHeaders, supabaseSelect, htmlLayout, errorPage, isoDate
} = require("./_seo-utils");

function safeIcon(value, fallback) {
  return value && String(value).startsWith("fa-") ? value : fallback;
}

function prettyDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat("ar", { year: "numeric", month: "long", day: "2-digit" }).format(date);
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
    return value.split(/\n|،|,/).map(x => x.trim()).filter(Boolean);
  }
  return [];
}

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
    schema.provider = {
      "@type": "CollegeOrUniversity",
      "name": "جامعة العلوم والتكنولوجيا",
      "sameAs": SITE_URL
    };
  }

  if (sectionKey === "activities" || sectionKey === "events") {
    schema["@type"] = "Event";
    schema.startDate = row.event_date || row.activity_date || row.start_date || row.created_at || new Date().toISOString();
    schema.endDate = row.end_date || row.event_date || row.activity_date || row.start_date || undefined;
    schema.eventStatus = "https://schema.org/EventScheduled";
    schema.eventAttendanceMode = "https://schema.org/MixedEventAttendanceMode";
    schema.location = {
      "@type": "Place",
      "name": row.location || "جامعة العلوم والتكنولوجيا"
    };
    schema.organizer = {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL + "/"
    };
  }

  if (sectionKey === "committees") {
    schema["@type"] = "Organization";
    schema.logo = `${SITE_URL}/logo.png`;
  }

  if (sectionKey === "initiatives" || sectionKey === "achievements") {
    schema["@type"] = "Article";
    schema.datePublished = row.initiative_date || row.achievement_date || row.created_at || new Date().toISOString();
    schema.dateModified = row.updated_at || row.created_at || new Date().toISOString();
  }

  return schema;
}

const FIELD_LABELS = {
  title: "العنوان",
  name: "الاسم",
  description: "الوصف المختصر",
  details: "التفاصيل الكاملة",
  ticker: "الشريط المختصر",
  category: "التصنيف",
  status: "الحالة",
  location: "الموقع",
  event_date: "تاريخ الفعالية",
  activity_date: "تاريخ النشاط",
  start_date: "تاريخ البداية",
  end_date: "تاريخ الانتهاء",
  achievement_date: "تاريخ الإنجاز",
  initiative_date: "تاريخ المبادرة",
  organizer: "الجهة المنفذة",
  target_group: "الفئة المستهدفة",
  requirements: "المتطلبات",
  expected_needs: "الاحتياجات المتوقعة",
  beneficiaries: "المستفيدون",
  team: "الفريق",
  suggested_team: "الفريق المقترح",
  seats_total: "إجمالي المقاعد",
  seats_taken: "المقاعد المسجلة",
  capacity: "السعة",
  registered_count: "عدد المسجلين",
  value: "القيمة",
  icon: "الأيقونة",
  link_text: "نص زر الروابط",
  url: "الرابط",
  created_at: "تاريخ الإضافة",
  updated_at: "آخر تحديث"
};

const HIDDEN_FIELDS = new Set([
  "id",
  "is_active",
  "sort_order",
  "image_url",
  "gallery_images",
  "created_by",
  "updated_by"
]);

const PRIORITY_FIELDS = [
  "category",
  "status",
  "location",
  "event_date",
  "activity_date",
  "start_date",
  "end_date",
  "achievement_date",
  "initiative_date",
  "organizer",
  "target_group",
  "seats_taken",
  "seats_total",
  "capacity",
  "registered_count",
  "value",
  "created_at",
  "updated_at"
];

function valueToText(key, value) {
  if (value === null || value === undefined || value === "") return "";
  if (["created_at", "updated_at", "event_date", "activity_date", "start_date", "end_date", "achievement_date", "initiative_date"].includes(key)) {
    return prettyDate(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

function metaIcon(key) {
  const map = {
    category: "fa-solid fa-tag",
    status: "fa-solid fa-signal",
    location: "fa-solid fa-location-dot",
    event_date: "fa-solid fa-calendar-days",
    activity_date: "fa-solid fa-calendar-days",
    start_date: "fa-solid fa-calendar-check",
    end_date: "fa-solid fa-calendar-xmark",
    achievement_date: "fa-solid fa-trophy",
    initiative_date: "fa-solid fa-hand-holding-heart",
    organizer: "fa-solid fa-building",
    target_group: "fa-solid fa-users",
    seats_taken: "fa-solid fa-user-check",
    seats_total: "fa-solid fa-users",
    capacity: "fa-solid fa-users",
    registered_count: "fa-solid fa-user-check",
    value: "fa-solid fa-chart-line",
    created_at: "fa-solid fa-clock",
    updated_at: "fa-solid fa-rotate"
  };
  return map[key] || "fa-solid fa-circle-info";
}

function buildMetaTags(row) {
  const tags = [];

  for (const key of PRIORITY_FIELDS) {
    const value = valueToText(key, row[key]);
    if (!value) continue;
    tags.push(`<span class="tag"><i class="${metaIcon(key)}"></i> ${escapeHtml(FIELD_LABELS[key] || key)}: ${escapeHtml(value)}</span>`);
  }

  return tags.join("");
}

function buildInfoRows(row) {
  const rows = [];

  for (const [key, raw] of Object.entries(row)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (["title", "name", "description", "details", "ticker"].includes(key)) continue;
    if (PRIORITY_FIELDS.includes(key)) continue;

    const value = valueToText(key, raw);
    if (!value) continue;

    rows.push(`<div class="committee-link-card">
      <div class="committee-link-icon"><i class="fa-solid fa-circle-info"></i></div>
      <div>
        <h4>${escapeHtml(FIELD_LABELS[key] || key)}</h4>
        <p style="white-space:pre-line">${escapeHtml(value)}</p>
      </div>
    </div>`);
  }

  return rows.join("");
}

function extractLinksFromText(text = "") {
  const urls = [];
  const regex = /(https?:\/\/[^\s<>"')]+|t\.me\/[^\s<>"')]+|www\.[^\s<>"')]+)/gi;
  let match;
  while ((match = regex.exec(text))) {
    let url = match[0].trim();
    if (url.startsWith("www.")) url = "https://" + url;
    if (url.startsWith("t.me/")) url = "https://" + url;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

function buildExternalLinks(row, details) {
  const links = [];
  if (row.url) links.push(String(row.url));

  extractLinksFromText(`${row.title || row.name || ""}\n${row.description || ""}\n${row.details || ""}\n${row.ticker || ""}\n${details || ""}`).forEach(url => {
    if (!links.includes(url)) links.push(url);
  });

  if (!links.length) return "";

  return `<div class="activity-info-card">
    <h4><i class="fa-solid fa-link"></i> الروابط الموجودة</h4>
    <div class="news-full-links">
      ${links.map((url, index) => `<a class="btn btn-soft" href="${escapeAttr(url)}" target="_blank" rel="noopener">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> رابط ${index + 1}
      </a>`).join("")}
    </div>
  </div>`;
}

function buildGallery(image, images, title) {
  const all = [];
  if (image) all.push(image);
  for (const src of images) {
    if (src && !all.includes(src)) all.push(src);
  }

  if (!all.length) return "";

  return `<div class="activity-details-gallery reveal show">
    ${all.map((src, index) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy" ${index === 0 ? "" : ""}>`).join("")}
  </div>`;
}

function buildTasks(row) {
  const tasks = [
    row.task_one,
    row.task_two,
    row.task_three,
    ...normalizeArray(row.tasks),
    ...normalizeArray(row.responsibilities)
  ].filter(Boolean);

  if (!tasks.length) return "";

  return `<div class="activity-info-card">
    <h4><i class="fa-solid fa-list-check"></i> المهام والمسؤوليات</h4>
    <ul>
      ${tasks.map(task => `<li>${escapeHtml(task)}</li>`).join("")}
    </ul>
  </div>`;
}

async function buildCommitteeLinks(sectionKey, id) {
  if (sectionKey !== "committees") return "";

  try {
    const links = await supabaseSelect("committee_links", {
      filters: {
        committee_id: `eq.${id}`,
        is_active: "eq.true"
      },
      order: "sort_order.asc",
      limit: 100
    });

    if (!links.length) {
      return `<div class="activity-info-card">
        <h4><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h4>
        <p>لا توجد روابط مضافة لهذه اللجنة حاليًا.</p>
      </div>`;
    }

    return `<div class="activity-info-card">
      <h4><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h4>
      <div class="links-list">
        ${links.map(link => {
          const url = link.url || "#";
          const isExternal = String(url).startsWith("http");
          return `<article class="committee-link-card">
            <div class="committee-link-icon"><i class="${escapeAttr(safeIcon(link.icon, "fa-solid fa-link"))}"></i></div>
            <div>
              <h4>${escapeHtml(link.title || "رابط اللجنة")}</h4>
              <p>${escapeHtml(link.description || "رابط خاص بهذه اللجنة.")}</p>
            </div>
            <a class="btn btn-dark" href="${escapeAttr(url)}" ${isExternal ? 'target="_blank" rel="noopener"' : ""}>
              <i class="fa-solid fa-arrow-up-right-from-square"></i> فتح
            </a>
          </article>`;
        }).join("")}
      </div>
    </div>`;
  } catch (error) {
    return `<div class="activity-info-card">
      <h4><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h4>
      <p>تعذر تحميل روابط اللجنة: ${escapeHtml(error.message)}</p>
    </div>`;
  }
}

function sectionSubtitle(sectionKey, row) {
  if (sectionKey === "news") return row.category || "آخر الأخبار";
  if (sectionKey === "courses") return row.category || row.status || "دورة تدريبية";
  if (sectionKey === "activities") return row.location || row.category || "نشاط طلابي";
  if (sectionKey === "events") return row.location || "فعالية قادمة";
  if (sectionKey === "committees") return "لجنة من لجان ملتقى الطالب الجامعي";
  if (sectionKey === "achievements") return row.category || "إنجاز موثق";
  if (sectionKey === "initiatives") return row.category || row.status || "مبادرة طلابية";
  return "";
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
    const images = parseImages(row.gallery_images);
    const url = urlFor(sectionKey, row);
    const schema = schemaFor(sectionKey, section, row, title, description, image, url);
    const metaTags = buildMetaTags(row);
    const infoRows = buildInfoRows(row);
    const linksHtml = buildExternalLinks(row, details);
    const tasksHtml = buildTasks(row);
    const committeeLinksHtml = await buildCommitteeLinks(sectionKey, id);
    const galleryHtml = buildGallery(image, images, title);

    const body = `<main>
      <section class="hero" style="min-height:auto;padding-bottom:36px">
        <div class="container">
          <div class="hero-content reveal show" style="max-width:980px;margin-inline:auto;text-align:center">
            <div class="hero-badge"><i class="${escapeAttr(safeIcon(row.icon, section.icon))}"></i> ${escapeHtml(section.label)}</div>
            <h1><span class="gradient-text">${escapeHtml(title)}</span></h1>
            <p>${escapeHtml(description)}</p>
            <div class="hero-actions" style="justify-content:center">
              <a class="btn btn-dark" href="${escapeAttr(section.path)}"><i class="fa-solid fa-arrow-right"></i> كل ${escapeHtml(section.label)}</a>
              <a class="btn btn-light" href="${escapeAttr(section.mainAnchor || "/")}"><i class="fa-solid fa-location-arrow"></i> داخل الرئيسية</a>
              <a class="btn btn-soft" href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
            </div>
          </div>
        </div>
      </section>

      <section style="padding-top:26px">
        <div class="container activity-details-layout">

          <div class="activity-details-info reveal show">

            <div class="activity-info-card">
              <h4><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.singular)}: ${escapeHtml(title)}</h4>
              <p style="white-space:pre-line">${escapeHtml(details)}</p>
            </div>

            ${metaTags ? `<div class="activity-info-card">
              <h4><i class="fa-solid fa-circle-info"></i> معلومات مختصرة</h4>
              <div class="tags">${metaTags}</div>
            </div>` : ""}

            ${tasksHtml}

            ${committeeLinksHtml}

            ${linksHtml}

            ${infoRows ? `<div class="activity-info-card">
              <h4><i class="fa-solid fa-database"></i> بيانات إضافية</h4>
              <div class="links-list">${infoRows}</div>
            </div>` : ""}

          </div>

          <div class="activity-details-info reveal show">
            <div class="activity-info-card">
              <h4><i class="fa-solid fa-image"></i> الصور والتغطية</h4>
              <p>${escapeHtml(sectionSubtitle(sectionKey, row))}</p>
            </div>
            ${galleryHtml || `<div class="links-empty">لا توجد صور مضافة لهذا العنصر حاليًا.</div>`}
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
