// api/seo-page.js
// صفحات ID بنفس شكل عناصر الصفحة الرئيسية تمامًا، لكن بعنصر واحد فقط.
// جميع الأزرار الأصلية موجودة كما في الصفحة الرئيسية.

const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, detailOf, imageOf, parseImages, urlFor,
  responseHeaders, supabaseSelect, htmlLayout, errorPage
} = require("./_seo-utils");

function safeIcon(value, fallback) {
  return value && String(value).startsWith("fa-") ? value : fallback;
}

function prettyDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat("ar", { day: "2-digit", month: "long", year: "numeric" }).format(date);
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
    "isPartOf": { "@type": "WebSite", "name": SITE_NAME, "url": SITE_URL + "/" }
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
    schema.startDate = row.event_date || row.activity_date || row.start_date || row.created_at || new Date().toISOString();
    schema.location = { "@type": "Place", "name": row.location || "جامعة العلوم والتكنولوجيا" };
    schema.organizer = { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL + "/" };
  }

  if (sectionKey === "committees") {
    schema["@type"] = "Organization";
    schema.logo = `${SITE_URL}/logo.png`;
  }

  return schema;
}

function jsData(value) {
  return encodeURIComponent(JSON.stringify(value || {}));
}

function sectionCopy(sectionKey, section) {
  const copy = {
    news: ["آخر الأخبار", "نشرة أخبار الملتقى بطريقة تلفزيونية حديثة", "شاشة أخبار تعرض الخبر المحدد بنفس شكل الصفحة الرئيسية."],
    activities: ["الأنشطة", "أنشطة الملتقى وبرامجه", "عرض النشاط المحدد بنفس شكل كروت الأنشطة في الصفحة الرئيسية."],
    courses: ["تسجيل الدورات", "الدورات والبرامج التدريبية", "عرض الدورة المحددة بنفس شكل كروت الدورات في الصفحة الرئيسية."],
    committees: ["لجان ملتقى الطالب الجامعي", "اللجان الرئيسية التي يتعامل معها الطالب مباشرة", "عرض اللجنة المحددة وروابطها بنفس أسلوب الصفحة الرئيسية."],
    achievements: ["إنجازات الملتقى", "إنجازات موثقة", "عرض الإنجاز المحدد بالصور والتفاصيل بنفس روح الموقع الرئيسي."],
    initiatives: ["المبادرات الطلابية", "مبادرة طلابية", "عرض المبادرة المحددة بنفس شكل الموقع الرئيسي."],
    events: ["Timeline", "المواعيد القادمة", "عرض الفعالية المحددة بنفس شكل خط الزمن في الصفحة الرئيسية."]
  };
  return copy[sectionKey] || [section.label, section.label, section.description];
}

function sectionDomId(sectionKey) {
  if (sectionKey === "news") return "latest-news";
  if (sectionKey === "events") return "timeline";
  return sectionKey;
}

function renderHeader(sectionKey, section) {
  const [kicker, title, desc] = sectionCopy(sectionKey, section);
  return `<div class="section-header reveal show">
    <div>
      <div class="section-kicker">${escapeHtml(kicker)}</div>
      <h2 class="section-title">${escapeHtml(title)}</h2>
    </div>
    <p class="section-desc">${escapeHtml(desc)}</p>
  </div>`;
}

function renderNews(sectionKey, section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const category = row.category || "خبر";
  const ticker = row.ticker || title;
  const icon = safeIcon(row.icon, section.icon);
  const encoded = jsData({ title, category, description: text, ticker, image, icon });

  return `<section id="latest-news" style="padding-top:122px">
    <div class="container">
      ${renderHeader(sectionKey, section)}
      <div class="news-studio reveal show delay-1">
        <div class="news-tv">
          <div class="news-screen">
            <div class="news-media">
              ${image ? `<img id="newsImage" alt="${escapeAttr(title)}" src="${escapeAttr(image)}" style="cursor:pointer" onclick="openImageViewer(\'${escapeAttr(image)}\')" title="اضغط لعرض الصورة" />` : ""}
              <div class="news-shine"></div>
              <div class="news-live"><i class="fa-solid fa-circle"></i> آخر الأخبار</div>
            </div>
            <div class="news-frame-ticker"><span id="newsFrameTicker">${escapeHtml(ticker)}</span></div>
            <div class="news-caption">
              <div class="news-category" id="newsCategory"><i class="${escapeAttr(icon)}"></i> ${escapeHtml(category)}</div>
              <h3 id="newsTitle">${escapeHtml(title)}</h3>
              <p id="newsDescription">${escapeHtml(text)}</p>
              <button class="news-read-more show" id="newsReadMoreBtn" type="button" data-news="${encoded}">
                <i class="fa-solid fa-up-right-and-down-left-from-center"></i> عرض المزيد
              </button>
            </div>
          </div>
          <div class="news-control-panel">
            <div class="news-progress" title="مدة عرض الخبر"><span id="newsProgress"></span></div>
            <div class="news-dots" id="newsDots"><button class="news-dot active" type="button" aria-label="الخبر الحالي"></button></div>
            <button class="news-brief-btn" id="newsBriefBtn" type="button"><i class="fa-solid fa-list-ul"></i> موجز</button>
          </div>
          <div class="tv-stand"></div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderActivity(sectionKey, section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const meta = [];
  if (row.activity_date) meta.push(`<span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(prettyDate(row.activity_date))}</span>`);
  if (row.location) meta.push(`<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);

  const payload = jsData(row);

  return `<article class="activity-card reveal show delay-1" style="max-width:420px;margin-inline:auto">
    <div class="cover ${row.is_light ? "light-cover" : ""}">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      <h3>${escapeHtml(row.subtitle || title)}</h3>
      ${meta.length ? `<div class="activity-meta">${meta.join("")}</div>` : ""}
      <p>${escapeHtml(text)}</p>
      <div class="tags">
        <span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(row.tag_one || row.category || "نشاط")}</span>
        <span class="tag"><i class="fa-solid fa-star"></i> ${escapeHtml(row.tag_two || "مميز")}</span>
      </div>
      <div class="activity-actions">
        <button class="btn btn-dark activity-details-btn" type="button" data-activity="${payload}">
          <i class="fa-solid fa-circle-info"></i> عرض تفاصيل النشاط والصور
        </button>
      </div>
    </div>
  </article>`;
}

function renderCourse(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const category = row.category || row.course_category || "academic";
  const status = row.status || "متاح";
  const seatsTotal = Number(row.seats_total || row.capacity || 0);
  const seatsTaken = Number(row.seats_taken || row.registered_count || 0);
  const percent = seatsTotal > 0 ? Math.min(100, Math.max(0, Math.round((seatsTaken / seatsTotal) * 100))) : 0;

  return `<article class="course-card reveal show delay-1" data-category="${escapeAttr(category)}" style="max-width:420px;margin-inline:auto">
    <div class="cover ${row.is_light ? "light-cover" : ""}">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      <div class="tags">
        <span class="tag"><i class="fa-solid fa-layer-group"></i> ${escapeHtml(category)}</span>
        <span class="tag"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(status)}</span>
      </div>
      <p>${escapeHtml(text)}</p>
      <div class="course-meta-line"><span><i class="fa-solid fa-users"></i> الطلاب المسجلون</span><strong>${escapeHtml(seatsTaken)}</strong></div>
      <div class="progress-block">
        <div class="progress-info"><span>المقاعد</span><span>${escapeHtml(seatsTaken)} / ${escapeHtml(seatsTotal || "غير محدد")}</span></div>
        <div class="progress"><span style="--width:${percent}%"></span></div>
      </div>
      <div class="course-more-box">${escapeHtml(row.details || "لا توجد تفاصيل إضافية بعد.")}</div>
      <div class="course-actions">
        <button class="btn btn-soft more-btn" type="button"><i class="fa-solid fa-circle-info"></i> المزيد</button>
        <button class="btn ${String(status).includes("قريب") ? "btn-soft" : "btn-dark"} action-btn" type="button" data-course-id="${escapeAttr(row.id)}" data-course-title="${escapeAttr(title)}" data-registration-fields="${escapeAttr(encodeURIComponent(JSON.stringify(row.registration_fields||[])))}">
          <i class="fa-solid ${String(status).includes("قريب") ? "fa-bell" : "fa-user-plus"}"></i>${String(status).includes("قريب") ? "تنبيه عند الفتح" : "طلب التسجيل"}
        </button>
      </div>
    </div>
  </article>`;
}

function renderCommittee(section, row) {
  const title = titleOf(row, section);
  const description = row.description || textOf(row, section);
  const icon = safeIcon(row.icon, section.icon);
  const tasks = [row.task_one, row.task_two, row.task_three].filter(Boolean).map(task => `<div class="committee-task"><i class="fa-solid fa-circle"></i><span>${escapeHtml(task)}</span></div>`).join("");
  const linkText = row.link_text || "روابط اللجنة";

  return `<div class="committee-card reveal show delay-1" style="max-width:420px;margin-inline:auto">
    <div class="avatar"><i class="${escapeAttr(icon)}"></i></div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
    <div class="committee-tasks">${tasks}</div>
    <div class="committee-actions">
      <button class="btn btn-soft committee-detail-btn" type="button"
        data-title="${escapeAttr(title)}"
        data-icon="${escapeAttr(icon)}"
        data-description="${escapeAttr(description)}"
        data-task-one="${escapeAttr(row.task_one || "")}"
        data-task-two="${escapeAttr(row.task_two || "")}"
        data-task-three="${escapeAttr(row.task_three || "")}">
        <i class="fa-solid fa-circle-info"></i> التفاصيل
      </button>
      <button class="btn btn-dark committee-links-btn" type="button"
        data-committee-id="${escapeAttr(row.id)}"
        data-title="${escapeAttr(title)}"
        data-icon="${escapeAttr(icon)}">
        <i class="fa-solid fa-link"></i> ${escapeHtml(linkText)}
      </button>
    </div>
  </div>`;
}

async function renderCommitteeLinksData(id) {
  try {
    return await supabaseSelect("committee_links", {
      filters: { committee_id: `eq.${id}`, is_active: "eq.true" },
      order: "sort_order.asc",
      limit: 100
    });
  } catch (_) {
    return [];
  }
}

function renderAchievement(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section) || detailOf(row, section) || "إنجاز موثق يمكن إضافة وصفه وصوره من لوحة الإدارة.";
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const date = row.achievement_date ? prettyDate(row.achievement_date) : "تاريخ قابل للإضافة";
  const cat = row.category || "إنجاز";

  return `<article class="achievement-story-card reveal show delay-1" style="max-width:520px;margin-inline:auto">
    <div class="achievement-media">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" />` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="achievement-body">
      <div class="achievement-meta">
        <span><i class="fa-solid fa-tag"></i> ${escapeHtml(cat)}</span>
        <span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(date)}</span>
        ${row.value ? `<span><i class="fa-solid fa-chart-line"></i> ${escapeHtml(row.value)}</span>` : ""}
      </div>
      <p>${escapeHtml(text)}</p>
      <div class="achievement-actions">
        <button class="btn btn-dark achievement-detail-btn" type="button" data-achievement="${jsData(row)}"><i class="fa-solid fa-images"></i> عرض التفاصيل والصور</button>
      </div>
    </div>
  </article>`;
}

function renderInitiative(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section) || detailOf(row, section) || "مبادرة طلابية يمكن إضافة تفاصيلها من لوحة الإدارة.";
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const date = row.initiative_date ? prettyDate(row.initiative_date) : "تاريخ قابل للإضافة";
  const cat = row.category || "مبادرة";
  const status = row.status || "مقترحة";

  return `<article class="initiative-card reveal show delay-1" style="max-width:520px;margin-inline:auto">
    <div class="initiative-media">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" />` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="initiative-body">
      <div class="initiative-meta">
        <span><i class="fa-solid fa-tag"></i> ${escapeHtml(cat)}</span>
        <span><i class="fa-solid fa-signal"></i> ${escapeHtml(status)}</span>
        <span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(date)}</span>
      </div>
      <p>${escapeHtml(text)}</p>
      ${(row.organizer || row.target_group) ? `<div class="initiative-meta">${row.organizer ? `<span><i class="fa-solid fa-users-gear"></i> ${escapeHtml(row.organizer)}</span>` : ""}${row.target_group ? `<span><i class="fa-solid fa-user-group"></i> ${escapeHtml(row.target_group)}</span>` : ""}</div>` : ""}
      <div class="initiative-actions">
        <button class="btn btn-dark initiative-detail-btn" type="button" data-initiative="${jsData(row)}"><i class="fa-solid fa-circle-info"></i> تفاصيل المبادرة</button>
      </div>
    </div>
  </article>`;
}

function renderEvent(section, row) {
  const title = titleOf(row, section);
  const text = row.location || textOf(row, section) || section.description;
  return `<article class="timeline-card reveal show delay-1" style="max-width:900px;margin-inline:auto">
    <div class="date-box">${escapeHtml(prettyDate(row.event_date || row.activity_date || row.created_at) || "قريبًا")}</div>
    <div class="timeline-content">
      <h3><i class="${escapeAttr(safeIcon(row.icon, section.icon))}"></i> ${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </div>
    <div class="timeline-status"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(row.status || "قريبًا")}</div>
  </article>`;
}

async function renderSingle(sectionKey, section, row) {
  if (sectionKey === "news") return renderNews(sectionKey, section, row);

  const domId = sectionDomId(sectionKey);
  const gridClass = sectionKey === "events" ? "timeline-wrap" : (section.gridClass || "activities-grid");
  let item = "";

  if (sectionKey === "activities") item = renderActivity(sectionKey, section, row);
  else if (sectionKey === "courses") item = renderCourse(section, row);
  else if (sectionKey === "committees") item = renderCommittee(section, row);
  else if (sectionKey === "achievements") item = renderAchievement(section, row);
  else if (sectionKey === "initiatives") item = renderInitiative(section, row);
  else if (sectionKey === "events") item = renderEvent(section, row);
  else item = renderActivity(sectionKey, section, row);

  return `<section id="${escapeAttr(domId)}" style="padding-top:122px">
    <div class="container">
      ${renderHeader(sectionKey, section)}
      <div class="${escapeAttr(gridClass)}" style="${sectionKey === "events" ? "" : "grid-template-columns:1fr"}">${item}</div>
    </div>
  </section>`;
}

function modalHtml() {
  return `<style>
    .dynamic-course-fields{display:grid;gap:12px;margin-top:4px}
    .dynamic-course-fields .field{animation:fieldIn .28s var(--ease) both}
    @keyframes fieldIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .dynamic-course-note{
      padding:11px 13px;border-radius:18px;background:rgba(11,94,215,.07);
      color:var(--muted);font-size:13px;font-weight:800;line-height:1.8;border:1px solid rgba(11,94,215,.12);
      margin-bottom:12px
    }
  </style>
  
  <div class="modal-backdrop" id="newsFullModal">
    <div class="news-brief-modal-box news-full-box">
      <div class="news-brief-head">
        <div class="news-brief-icon"><i class="fa-solid fa-newspaper"></i></div>
        <div><h3 id="newsFullTitle">تفاصيل الخبر</h3><p id="newsFullCategory">آخر الأخبار</p></div>
        <button class="news-brief-close" id="closeNewsFullModal" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="news-full-description" id="newsFullDescription"></div>
      <div class="news-full-links" id="newsFullLinks"></div>
    </div>
  </div>

  <div class="modal-backdrop" id="courseModal">
    <div class="modal-box">
      <button class="modal-close" id="closeCourseModal" type="button"><i class="fa-solid fa-xmark"></i></button>
      <div class="modal-head"><div class="modal-icon"><i class="fa-solid fa-user-plus"></i></div><div><h3>التسجيل في الدورة</h3><p id="modalCourseName">الدورة</p></div></div>
      <form id="courseRegistrationForm">
        <input type="hidden" name="course_id" id="registrationCourseId">
        <input type="hidden" name="course_title" id="registrationCourseTitle">
        <div class="dynamic-course-note"><i class="fa-solid fa-list-check"></i> يرجى تعبئة بيانات التسجيل المطلوبة لهذه الدورة.</div>
        <div class="dynamic-course-fields" id="dynamicCourseFields"></div>
        <div class="modal-actions">
          <button class="btn btn-dark" type="submit"><i class="fa-solid fa-paper-plane"></i> إرسال الطلب</button>
          <button class="btn btn-soft" id="cancelCourseModal" type="button">إلغاء</button>
        </div>
      </form>
    </div>
  </div>

  <div class="committee-detail-backdrop" id="committeeDetailBackdrop">
    <div class="committee-detail-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <div class="sheet-icon" id="sheetIcon"><i class="fa-solid fa-sitemap"></i></div>
        <div><h3 id="sheetTitle">تفاصيل اللجنة</h3><p id="sheetDescription">وصف اللجنة</p></div>
        <button class="sheet-close" id="sheetClose" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="sheet-section"><h4>مهام اللجنة</h4><ul id="sheetTasks"></ul></div>
      <div id="sheetLinkBox" style="display:none"></div>
    </div>
  </div>

  <div class="committee-links-backdrop" id="committeeLinksBackdrop">
    <div class="committee-links-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <div class="sheet-icon" id="linksSheetIcon"><i class="fa-solid fa-link"></i></div>
        <div><h3 id="linksSheetTitle">روابط اللجنة</h3><p id="linksSheetSubtitle">روابط مهمة مع توضيح لمن كل رابط مخصص</p></div>
        <button class="sheet-close" id="linksSheetClose" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="links-list" id="committeeLinksList"></div>
    </div>
  </div>

  <div class="activity-details-backdrop" id="activityDetailsBackdrop">
    <div class="activity-details-box">
      <div class="activity-details-head">
        <div class="activity-details-icon" id="activityDetailsIcon"><i class="fa-solid fa-images"></i></div>
        <div><h3 id="activityDetailsTitle">تفاصيل النشاط</h3><p id="activityDetailsSubtitle">معرض الصور وتفاصيل النشاط</p></div>
        <button class="activity-details-close" id="activityDetailsClose" type="button"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="activity-details-layout">
        <div class="activity-details-gallery" id="activityDetailsGallery"></div>
        <div class="activity-details-info">
          <div class="activity-info-card"><h4><i class="fa-solid fa-circle-info"></i> الوصف</h4><p id="activityDetailsDescription"></p></div>
          <div class="activity-info-card"><h4><i class="fa-solid fa-location-dot"></i> معلومات</h4><ul id="activityDetailsMeta"></ul></div>
          <div class="activity-info-card"><h4><i class="fa-solid fa-list-check"></i> تفاصيل إضافية</h4><p id="activityDetailsLong"></p></div>
        </div>
      </div>
    </div>
  </div>

  <div class="image-viewer" id="imageViewer"><button id="imageViewerClose" type="button"><i class="fa-solid fa-xmark"></i></button><img alt="صورة" id="imageViewerImg" src="" /></div>
  `;
}

function pageScript(committeeLinks) {
  const linksJson = JSON.stringify(committeeLinks || []);

  return `<script>
    function q(id){return document.getElementById(id)}
    function safeText(v){return String(v||"")}
    function formatDateArabic(v){try{return new Intl.DateTimeFormat("ar",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(v))}catch(e){return v||""}}
    function parseGalleryImages(value){if(!value)return[];if(Array.isArray(value))return value.filter(Boolean);if(typeof value==="string"){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.filter(Boolean)}catch(e){}return value.split(/\\n|,|\\|/).map(x=>x.trim()).filter(Boolean)}return[]}
    function iconClass(v,f){return v&&String(v).startsWith("fa-")?v:f}
    function openImageViewer(src){const box=q("imageViewer"),img=q("imageViewerImg");if(!box||!img)return;img.src=src;box.classList.add("show");document.body.style.overflow="hidden"}
    function closeImageViewer(){const box=q("imageViewer");if(box)box.classList.remove("show");document.body.style.overflow=""}

    const closeImage=q("imageViewerClose");if(closeImage)closeImage.onclick=closeImageViewer;
    const imgViewer=q("imageViewer");if(imgViewer)imgViewer.onclick=e=>{if(e.target===imgViewer)closeImageViewer()};

    document.querySelectorAll(".news-read-more").forEach(btn=>{
      btn.onclick=()=>{
        let item={};try{item=JSON.parse(decodeURIComponent(btn.dataset.news||"{}"))}catch(e){}
        q("newsFullTitle").textContent=item.title||"تفاصيل الخبر";
        q("newsFullCategory").textContent=item.category||"آخر الأخبار";
        q("newsFullDescription").textContent=item.description||"";
        q("newsFullLinks").innerHTML=(String(item.description||"").match(/https?:\\/\\/[^\\s<>()]+/g)||[]).map((url,i)=>'<a class="news-link-chip" href="'+url+'" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> رابط '+(i+1)+'</a>').join("");
        q("newsFullModal").classList.add("show");
        document.body.style.overflow="hidden";
      };
    });
    const closeNews=q("closeNewsFullModal");if(closeNews)closeNews.onclick=()=>{q("newsFullModal").classList.remove("show");document.body.style.overflow=""};

    document.querySelectorAll(".more-btn").forEach(btn=>{
      btn.onclick=()=>{
        const box=btn.closest(".course-card").querySelector(".course-more-box");
        if(!box)return;
        box.classList.toggle("show");
        btn.innerHTML=box.classList.contains("show")?'<i class="fa-solid fa-chevron-up"></i> إخفاء المعلومات':'<i class="fa-solid fa-circle-info"></i> المزيد';
      };
    });

    function normalizeCourseRegFields(value){if(!value)return[];if(Array.isArray(value))return value;if(typeof value==="string"){try{const p=JSON.parse(value);return Array.isArray(p)?p:[]}catch(e){return[]}}return[]}
    function defaultCourseRegFields(){return[{label:"الاسم الكامل",type:"text",required:true,placeholder:"اكتب اسمك الرباعي"},{label:"الرقم الأكاديمي",type:"text",required:true,placeholder:"مثال: 202412345"}]}
    function fieldKey(label,index){return "field_"+index+"_"+String(label||"").replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,32)}
    function renderDynamicCourseFields(fields){const box=q("dynamicCourseFields");if(!box)return;const list=normalizeCourseRegFields(fields);const finalList=list.length?list:defaultCourseRegFields();box.innerHTML=finalList.map((field,index)=>{const label=safeText(field.label||("حقل "+(index+1))),type=field.type||"text",req=field.required?"required":"",ph=safeText(field.placeholder||""),name=fieldKey(label,index);if(type==="textarea")return '<div class="field full"><label><i class="fa-solid fa-pen-to-square"></i> '+label+'</label><textarea name="'+name+'" data-label="'+label+'" placeholder="'+ph+'" '+req+'></textarea></div>';if(type==="select"){const opts=String(field.options||"").split(/,|،|\n/).map(x=>x.trim()).filter(Boolean);return '<div class="field full"><label><i class="fa-solid fa-list"></i> '+label+'</label><select name="'+name+'" data-label="'+label+'" '+req+'><option value="">اختر...</option>'+opts.map(o=>'<option value="'+safeText(o)+'">'+safeText(o)+'</option>').join("")+'</select></div>'}const htmlType=["text","number","tel","email","date"].includes(type)?type:"text";return '<div class="field full"><label><i class="fa-solid fa-user"></i> '+label+'</label><input name="'+name+'" data-label="'+label+'" placeholder="'+ph+'" '+req+' type="'+htmlType+'" /></div>'}).join("")}
    document.querySelectorAll(".action-btn").forEach(btn=>{
      btn.onclick=()=>{
        if(q("registrationCourseId"))q("registrationCourseId").value=btn.dataset.courseId||"";
        if(q("registrationCourseTitle"))q("registrationCourseTitle").value=btn.dataset.courseTitle||"";
        if(q("modalCourseName"))q("modalCourseName").textContent="الدورة: "+(btn.dataset.courseTitle||"دورة");
        let fields=[];try{fields=JSON.parse(decodeURIComponent(btn.dataset.registrationFields||"[]"))}catch(e){fields=[]}
        renderDynamicCourseFields(fields);
        q("courseModal").classList.add("show");
        document.body.style.overflow="hidden";
      };
    });
    const closeCourse=q("closeCourseModal"),cancelCourse=q("cancelCourseModal");
    function closeCourseModal(){q("courseModal").classList.remove("show");document.body.style.overflow=""}
    if(closeCourse)closeCourse.onclick=closeCourseModal;
    if(cancelCourse)cancelCourse.onclick=closeCourseModal;

    function getDynamicRegistrationData(){
      const data={};
      document.querySelectorAll("#dynamicCourseFields input,#dynamicCourseFields textarea,#dynamicCourseFields select").forEach(input=>{
        const label=input.dataset.label||input.name;
        data[label]=input.value||"";
      });
      return data;
    }
    function pickByLabel(data,keywords){
      const entries=Object.entries(data||{});
      const found=entries.find(([label])=>keywords.some(k=>String(label).includes(k)));
      return found?found[1]:"";
    }
    const regForm=q("courseRegistrationForm");
    if(regForm){
      regForm.addEventListener("submit",async function(e){
        e.preventDefault();
        const registrationData=getDynamicRegistrationData();
        const payload={
          course_id:q("registrationCourseId")?q("registrationCourseId").value:null,
          course_title:q("registrationCourseTitle")?q("registrationCourseTitle").value:"",
          student_full_name:pickByLabel(registrationData,["الاسم","name","Name"])||Object.values(registrationData)[0]||"",
          academic_number:pickByLabel(registrationData,["أكاديمي","اكاديمي","academic","الرقم الجامعي"])||"",
          registration_data:registrationData
        };
        try{
          const response=await fetch("/api/course-registration",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(payload)
          });
          const result=await response.json().catch(()=>({}));
          if(!response.ok) throw new Error(result.error||"تعذر إرسال طلب التسجيل");
          alert("تم إرسال طلب التسجيل بنجاح");
          closeCourseModal();
        }catch(error){
          alert(error.message||"تعذر إرسال طلب التسجيل");
        }
      });
    }


    document.querySelectorAll(".activity-details-btn").forEach(btn=>{
      btn.onclick=()=>{
        let activity={};try{activity=JSON.parse(decodeURIComponent(btn.dataset.activity||"{}"))}catch(e){}
        const images=parseGalleryImages(activity.gallery_images||activity.images||activity.image_urls);
        if(activity.image_url)images.unshift(activity.image_url);
        q("activityDetailsIcon").innerHTML='<i class="'+iconClass(activity.icon,"fa-solid fa-images")+'"></i>';
        q("activityDetailsTitle").textContent=activity.title||"تفاصيل النشاط";
        q("activityDetailsSubtitle").textContent=activity.subtitle||activity.category||"معرض الصور وتفاصيل النشاط";
        q("activityDetailsDescription").textContent=activity.description||"";
        q("activityDetailsLong").textContent=activity.details||activity.long_description||"لا توجد تفاصيل إضافية.";
        const meta=[
          activity.activity_date?'<li><strong>التاريخ:</strong> '+formatDateArabic(activity.activity_date)+'</li>':"",
          activity.location?'<li><strong>المكان:</strong> '+safeText(activity.location)+'</li>':"",
          activity.category?'<li><strong>التصنيف:</strong> '+safeText(activity.category)+'</li>':""
        ].filter(Boolean).join("");
        q("activityDetailsMeta").innerHTML=meta||"<li>لا توجد معلومات إضافية.</li>";
        q("activityDetailsGallery").innerHTML=images.length?images.map(url=>'<img src="'+url+'" alt="" loading="lazy" onclick="openImageViewer(\\''+url+'\\')" />').join(""):'<div class="empty-state" style="grid-column:1/-1;">لا توجد صور مضافة.</div>';
        q("activityDetailsBackdrop").classList.add("show");
        document.body.style.overflow="hidden";
      };
    });
    const activityClose=q("activityDetailsClose");if(activityClose)activityClose.onclick=()=>{q("activityDetailsBackdrop").classList.remove("show");document.body.style.overflow=""};

    document.querySelectorAll(".committee-detail-btn").forEach(btn=>{
      btn.onclick=()=>{
        q("sheetIcon").innerHTML='<i class="'+(btn.dataset.icon||"fa-solid fa-sitemap")+'"></i>';
        q("sheetTitle").textContent=btn.dataset.title||"لجنة";
        q("sheetDescription").textContent=btn.dataset.description||"";
        const tasks=[btn.dataset.taskOne,btn.dataset.taskTwo,btn.dataset.taskThree].filter(Boolean);
        q("sheetTasks").innerHTML=tasks.length?tasks.map(t=>'<li>'+safeText(t)+'</li>').join(""):'<li>لا توجد مهام مضافة بعد.</li>';
        q("committeeDetailBackdrop").classList.add("show");
        document.body.style.overflow="hidden";
      };
    });
    const sheetClose=q("sheetClose");if(sheetClose)sheetClose.onclick=()=>{q("committeeDetailBackdrop").classList.remove("show");document.body.style.overflow=""};

    const committeeLinks=${linksJson};
    document.querySelectorAll(".committee-links-btn").forEach(btn=>{
      btn.onclick=()=>{
        q("linksSheetIcon").innerHTML='<i class="'+(btn.dataset.icon||"fa-solid fa-link")+'"></i>';
        q("linksSheetTitle").textContent="روابط "+(btn.dataset.title||"اللجنة");
        q("committeeLinksList").innerHTML=committeeLinks.length?committeeLinks.map(link=>{
          const url=link.url||"#";
          return '<article class="committee-link-card"><div class="committee-link-icon"><i class="'+iconClass(link.icon,"fa-solid fa-link")+'"></i></div><div><h4>'+safeText(link.title)+'</h4><p>'+safeText(link.description||"رابط خاص بهذه اللجنة.")+'</p></div><a class="btn btn-dark" href="'+url+'" '+(url.startsWith("http")?'target="_blank" rel="noopener"':'')+'><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح</a></article>';
        }).join(""):'<div class="links-empty">لا توجد روابط مضافة لهذه اللجنة حاليًا.</div>';
        q("committeeLinksBackdrop").classList.add("show");
        document.body.style.overflow="hidden";
      };
    });
    const linksClose=q("linksSheetClose");if(linksClose)linksClose.onclick=()=>{q("committeeLinksBackdrop").classList.remove("show");document.body.style.overflow=""};

    document.querySelectorAll(".achievement-detail-btn,.initiative-detail-btn").forEach(btn=>{
      btn.onclick=()=>{
        const payload=btn.dataset.achievement||btn.dataset.initiative||"";
        let item={};try{item=JSON.parse(decodeURIComponent(payload))}catch(e){}
        alert((item.title||"التفاصيل")+"\\n\\n"+(item.details||item.description||"لا توجد تفاصيل إضافية."));
      };
    });
  </script>`;
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
    const filters = {};

    // للأخبار فقط:
    // إذا كان الرابط رقم بسيط مثل /news/1 نبحث في public_id.
    // وإذا كان الرابط UUID قديم مثل /news/a1db... نبحث في id حتى لا تتعطل الروابط القديمة.
    if (sectionKey === "news" && /^\\d+$/.test(id)) {
      filters.public_id = `eq.${id}`;
    } else {
      filters.id = `eq.${id}`;
    }

    if (section.activeField) filters[section.activeField] = "eq.true";

    const rows = await supabaseSelect(section.table, { filters, limit: 1 });
    const row = rows[0];

    if (!row) {
      res.writeHead(404, responseHeaders());
      res.end(errorPage("العنصر غير موجود أو غير منشور"));
      return;
    }

    let committeeLinks = [];
    if (sectionKey === "committees") committeeLinks = await renderCommitteeLinksData(id);

    const title = titleOf(row, section);
    const description = truncate(textOf(row, section) || section.description, 170);
    const image = imageOf(row);
    const url = urlFor(sectionKey, row);
    const schema = schemaFor(sectionKey, section, row, title, description, image, url);
    const body = `<main>${await renderSingle(sectionKey, section, row)}</main>${modalHtml()}${pageScript(committeeLinks)}`;

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
    res.end(errorPage(`تعذر تحميل العنصر: ${error.message}`));
  }
};
