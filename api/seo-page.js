// api/seo-page.js
// تصميم صفحات التفاصيل بنفس روح وشكل الموقع الرئيسي تمامًا.
// استخدمت نفس كلاسات الموقع الرئيسي الموجودة في assets/usf-main-style.css
// بدون تصميم مختلف أو ألوان غريبة.

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
    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "long",
      day: "2-digit"
    }).format(date);
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
  link_text: "نص الرابط",
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

const PRIMARY_FIELDS = [
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
  for (const key of PRIMARY_FIELDS) {
    const value = valueToText(key, row[key]);
    if (!value) continue;
    tags.push(`<span class="tag"><i class="${metaIcon(key)}"></i> ${escapeHtml(FIELD_LABELS[key] || key)}: ${escapeHtml(value)}</span>`);
  }
  return tags.join("");
}

function buildExtraData(row) {
  const rows = [];

  for (const [key, raw] of Object.entries(row)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (["title", "name", "description", "details", "ticker"].includes(key)) continue;
    if (PRIMARY_FIELDS.includes(key)) continue;

    const value = valueToText(key, raw);
    if (!value) continue;

    rows.push(`<article class="committee-link-card">
      <div class="committee-link-icon"><i class="fa-solid fa-database"></i></div>
      <div>
        <h4>${escapeHtml(FIELD_LABELS[key] || key)}</h4>
        <p style="white-space:pre-line">${escapeHtml(value)}</p>
      </div>
    </article>`);
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

  return `<div class="activity-info-card reveal show">
    <h4><i class="fa-solid fa-link"></i> الروابط المهمة</h4>
    <div class="links-list">
      ${links.map((url, index) => `<article class="committee-link-card">
        <div class="committee-link-icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
        <div>
          <h4>رابط ${index + 1}</h4>
          <p>${escapeHtml(url)}</p>
        </div>
        <a class="btn btn-dark" href="${escapeAttr(url)}" target="_blank" rel="noopener">فتح</a>
      </article>`).join("")}
    </div>
  </div>`;
}

function buildGallery(image, images, title) {
  const all = [];
  if (image) all.push(image);
  for (const src of images) {
    if (src && !all.includes(src)) all.push(src);
  }

  if (!all.length) {
    return `<div class="links-empty">لا توجد صور مضافة لهذا العنصر حاليًا.</div>`;
  }

  return `<div class="activity-details-gallery reveal show">
    ${all.map((src, index) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy" onclick="openSeoImage('${escapeAttr(src)}')">`).join("")}
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

  return `<div class="activity-info-card reveal show">
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
      return `<div class="activity-info-card reveal show">
        <h4><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h4>
        <div class="links-empty">لا توجد روابط مضافة لهذه اللجنة حاليًا.</div>
      </div>`;
    }

    return `<div class="activity-info-card reveal show">
      <h4><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h4>
      <div class="links-list">
        ${links.map(link => {
          const linkUrl = link.url || "#";
          const isExternal = String(linkUrl).startsWith("http");
          return `<article class="committee-link-card">
            <div class="committee-link-icon"><i class="${escapeAttr(safeIcon(link.icon, "fa-solid fa-link"))}"></i></div>
            <div>
              <h4>${escapeHtml(link.title || "رابط اللجنة")}</h4>
              <p>${escapeHtml(link.description || "رابط خاص بهذه اللجنة.")}</p>
            </div>
            <a class="btn btn-dark" href="${escapeAttr(linkUrl)}" ${isExternal ? 'target="_blank" rel="noopener"' : ""}>فتح</a>
          </article>`;
        }).join("")}
      </div>
    </div>`;
  } catch (error) {
    return `<div class="activity-info-card reveal show">
      <h4><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h4>
      <div class="links-empty">تعذر تحميل روابط اللجنة: ${escapeHtml(error.message)}</div>
    </div>`;
  }
}

function sectionWrapperId(sectionKey) {
  if (sectionKey === "news") return "latest-news";
  if (sectionKey === "events") return "timeline";
  return sectionKey;
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
    const icon = safeIcon(row.icon, section.icon);
    const schema = schemaFor(sectionKey, section, row, title, description, image, url);
    const metaTags = buildMetaTags(row);
    const extraData = buildExtraData(row);
    const tasksHtml = buildTasks(row);
    const linksHtml = buildExternalLinks(row, details);
    const committeeLinksHtml = await buildCommitteeLinks(sectionKey, id);
    const galleryHtml = buildGallery(image, images, title);
    const wrapperId = sectionWrapperId(sectionKey);

    const detailsCss = `
      <style>
        .seo-detail-page{padding-top:112px}
        .seo-detail-page .activity-details-box{
          width:100%;
          max-height:none;
          overflow:visible;
          border-radius:38px;
        }
        .seo-detail-page .activity-details-head{
          margin-bottom:20px;
        }
        .seo-detail-page .activity-details-head p{
          max-width:900px;
        }
        .seo-detail-page .activity-details-gallery img{
          cursor:pointer;
        }
        .seo-detail-page .activity-info-card{
          position:relative;
          overflow:hidden;
        }
        .seo-detail-page .activity-info-card:before{
          content:"";
          position:absolute;
          top:0;
          right:0;
          left:0;
          height:3px;
          background:linear-gradient(90deg,var(--section-color,var(--primary)),var(--primary-light));
        }
        .seo-detail-hero-image{
          width:100%;
          height:360px;
          object-fit:cover;
          border-radius:28px;
          border:1px solid var(--border);
          box-shadow:0 22px 58px rgba(11,94,215,.16);
          margin-bottom:12px;
          cursor:pointer;
        }
        .seo-detail-actions{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:14px;
        }
        .seo-detail-actions .btn{
          min-height:48px;
        }
        .seo-image-viewer{
          position:fixed;
          inset:0;
          z-index:6000;
          display:none;
          place-items:center;
          padding:18px;
          background:rgba(3,12,22,.82);
          backdrop-filter:blur(12px);
        }
        .seo-image-viewer.show{display:grid}
        .seo-image-viewer img{
          max-width:min(1120px,100%);
          max-height:86vh;
          border-radius:24px;
          box-shadow:0 30px 90px rgba(0,0,0,.45);
        }
        .seo-image-viewer button{
          position:absolute;
          top:18px;
          left:18px;
          width:46px;
          height:46px;
          border:1px solid rgba(255,255,255,.28);
          border-radius:17px;
          color:white;
          background:rgba(255,255,255,.12);
          cursor:pointer;
        }
        @media(max-width:760px){
          .seo-detail-page{padding-top:92px}
          .seo-detail-page .activity-details-box{padding:17px;border-radius:30px}
          .seo-detail-hero-image{height:230px;border-radius:23px}
          .seo-detail-actions{display:grid;grid-template-columns:1fr}
          .seo-detail-actions .btn{width:100%}
        }
      </style>
    `;

    const body = `
      ${detailsCss}
      <main class="seo-detail-page">
        <section id="${escapeAttr(wrapperId)}">
          <div class="container">

            <div class="section-header reveal show">
              <div>
                <div class="section-kicker"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.label)}</div>
                <h1 class="section-title">${escapeHtml(title)}</h1>
              </div>
              <p class="section-desc">${escapeHtml(description)}</p>
            </div>

            <div class="activity-details-box reveal show">
              <div class="sheet-handle"></div>

              <div class="activity-details-head">
                <div class="activity-details-icon"><i class="${escapeAttr(icon)}"></i></div>
                <div>
                  <h3>${escapeHtml(title)}</h3>
                  <p>${escapeHtml(description)}</p>
                  <div class="seo-detail-actions">
                    <a class="btn btn-dark" href="${escapeAttr(section.path)}"><i class="fa-solid fa-arrow-right"></i> كل ${escapeHtml(section.label)}</a>
                    <a class="btn btn-light" href="${escapeAttr(section.mainAnchor || "/")}"><i class="fa-solid fa-location-arrow"></i> داخل الرئيسية</a>
                    <a class="btn btn-soft" href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
                  </div>
                </div>
                <a class="activity-details-close" href="${escapeAttr(section.path)}" aria-label="رجوع"><i class="fa-solid fa-arrow-right"></i></a>
              </div>

              <div class="activity-details-layout">

                <div class="activity-details-info">
                  ${image ? `<img class="seo-detail-hero-image reveal show" src="${escapeAttr(image)}" alt="${escapeAttr(title)}" onclick="openSeoImage('${escapeAttr(image)}')">` : ""}

                  <div class="activity-info-card reveal show">
                    <h4><i class="${escapeAttr(icon)}"></i> التفاصيل الكاملة</h4>
                    <p style="white-space:pre-line">${escapeHtml(details)}</p>
                  </div>

                  ${metaTags ? `<div class="activity-info-card reveal show">
                    <h4><i class="fa-solid fa-circle-info"></i> معلومات مختصرة</h4>
                    <div class="tags">${metaTags}</div>
                  </div>` : ""}

                  ${tasksHtml}

                  ${committeeLinksHtml}

                  ${linksHtml}

                  ${extraData ? `<div class="activity-info-card reveal show">
                    <h4><i class="fa-solid fa-database"></i> بيانات إضافية</h4>
                    <div class="links-list">${extraData}</div>
                  </div>` : ""}
                </div>

                <div class="activity-details-info">
                  <div class="activity-info-card reveal show">
                    <h4><i class="fa-solid fa-images"></i> الصور والتغطية</h4>
                    <p>صور وتفاصيل مرتبطة بهذا العنصر كما تظهر للمستخدمين بنفس شكل الموقع الرئيسي.</p>
                  </div>
                  ${galleryHtml}
                </div>

              </div>
            </div>
          </div>
        </section>

        <div class="seo-image-viewer" id="seoImageViewer" onclick="closeSeoImage()">
          <button type="button" onclick="closeSeoImage();event.stopPropagation()"><i class="fa-solid fa-xmark"></i></button>
          <img id="seoImageViewerImg" src="" alt="عرض الصورة">
        </div>

        <script>
          function openSeoImage(src){
            var viewer = document.getElementById('seoImageViewer');
            var img = document.getElementById('seoImageViewerImg');
            if(!viewer || !img) return;
            img.src = src;
            viewer.classList.add('show');
          }
          function closeSeoImage(){
            var viewer = document.getElementById('seoImageViewer');
            if(viewer) viewer.classList.remove('show');
          }
          document.addEventListener('keydown', function(e){
            if(e.key === 'Escape') closeSeoImage();
          });
        </script>
      </main>
    `;

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
