// api/seo-page.js
// صفحات ID بشكل عناصر الصفحة الرئيسية تمامًا، لكن بعنصر واحد فقط.
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
    news: ["آخر الأخبار", "آخر أخبار الملتقى لحظة بلحظة", "تفاصيل الخبر بصورة أوضح وأسرع للطالب."],
    activities: ["الأنشطة", "حراك طلابي حاضر ومؤثر", "تفاصيل النشاط وصوره في عرض مباشر وواضح."],
    courses: ["تسجيل الدورات", "دورات تصنع مهارة وفرصة", "تفاصيل الدورة والتسجيل في صفحة واحدة واضحة."],
    committees: ["لجان ملتقى الطالب الجامعي", "لجان تعمل لخدمة الطالب مباشرة", "تعريف اللجنة وروابطها الرسمية في مكان واحد."],
    achievements: ["إنجازات الملتقى", "إنجازات موثقة", "قصة الإنجاز وصوره وتاريخه في عرض واضح."],
    initiatives: ["المبادرات الطلابية", "مبادرة طلابية", "تفاصيل المبادرة وأثرها وخطواتها."],
    events: ["الفعاليات القادمة", "مواعيد وفعاليات قادمة", "موعد الفعالية وتفاصيلها بوضوح."]
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
        <button class="btn ${String(status).includes("قريب") ? "btn-soft" : "btn-dark"} action-btn" type="button" onclick="window.openCourseRegModalFromBtn&&window.openCourseRegModalFromBtn(this)" data-course-id="${escapeAttr(row.id)}" data-course-title="${escapeAttr(title)}" data-registration-fields="${escapeAttr(encodeURIComponent(JSON.stringify(row.registration_fields||[])))}">
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

    /* القناة المركزية للجنة العلمية */
    .scientific-central-card{
      position:relative;
      overflow:hidden;
      display:grid;
      grid-template-columns:58px minmax(0,1fr) auto;
      align-items:center;
      gap:12px;
      padding:14px;
      margin:0 0 12px;
      border-radius:24px;
      border:1px solid rgba(11,94,215,.16);
      background:
        radial-gradient(circle at top right,rgba(0,166,214,.13),transparent 34%),
        linear-gradient(135deg,rgba(255,255,255,.82),rgba(238,247,255,.72));
      box-shadow:0 16px 38px rgba(11,94,215,.12);
    }
    .dark .scientific-central-card{
      background:
        radial-gradient(circle at top right,rgba(0,166,214,.14),transparent 34%),
        linear-gradient(135deg,rgba(241,247,251,.08),rgba(11,94,215,.08));
    }
    .scientific-central-card::before{
      content:"القناة المركزية";
      position:absolute;
      top:10px;
      left:12px;
      padding:5px 9px;
      border-radius:999px;
      color:var(--primary);
      background:rgba(11,94,215,.08);
      font-size:10.5px;
      font-weight:900;
    }
    .scientific-central-icon{
      width:58px;
      height:58px;
      display:grid;
      place-items:center;
      border-radius:20px;
      color:var(--bg);
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F);
      box-shadow:0 14px 28px rgba(11,94,215,.20);
      font-size:23px;
    }
    .scientific-central-card h3{
      margin:0;
      color:var(--text);
      font-size:16px;
      font-weight:900;
      line-height:1.55;
    }
    .scientific-central-card p{
      margin:4px 0 0;
      color:var(--muted);
      font-size:12.5px;
      font-weight:800;
      line-height:1.75;
    }
    .scientific-central-card .btn{
      white-space:nowrap;
      align-self:center;
    }
    @media(max-width:760px){
      .scientific-central-card{
        grid-template-columns:50px minmax(0,1fr);
        padding:13px;
      }
      .scientific-central-icon{
        width:50px;
        height:50px;
        border-radius:18px;
        font-size:20px;
      }
      .scientific-central-card .btn{
        grid-column:1/-1;
        width:100%;
        justify-content:center;
      }
      .scientific-central-card::before{
        display:none;
      }
    }

  </style>
<style>

    /* FINAL FIX: نفس تصميم Pop في index و /committees و /committees/1 */
    .scientific-specialty-overlay{
      position:fixed!important;
      inset:0!important;
      z-index:50000!important;
      display:none!important;
      align-items:flex-end!important;
      justify-content:center!important;
      padding:18px!important;
      background:rgba(15,24,29,.45)!important;
      backdrop-filter:blur(14px)!important;
      -webkit-backdrop-filter:blur(14px)!important;
    }
    .scientific-specialty-overlay.show{display:flex!important}
    .scientific-picker.open::before,
    .scientific-specialty-pop::before{content:none!important;display:none!important}
    .scientific-specialty-pop{
      position:static!important;
      inset:auto!important;
      transform:none!important;
      width:min(520px,100%)!important;
      max-width:100%!important;
      max-height:min(72vh,640px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      z-index:auto!important;
      border-radius:30px 30px 24px 24px!important;
      border:1px solid var(--border2)!important;
      background:var(--glass2)!important;
      box-shadow:var(--shadow2)!important;
      padding:0!important;
      display:none!important;
      box-sizing:border-box!important;
    }
    .scientific-specialty-overlay.show .scientific-specialty-pop{
      display:block!important;
      animation:scientificSheetUp .26s var(--ease) both!important;
    }
    @keyframes scientificSheetUp{
      from{opacity:0;transform:translateY(28px) scale(.98)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    .scientific-specialty-pop .sheet-handle{
      width:54px!important;height:5px!important;border-radius:999px!important;
      background:rgba(11,94,215,.25)!important;margin:10px auto 4px!important;display:block!important;
    }
    .scientific-pop-title{
      position:sticky!important;top:0!important;z-index:2!important;
      display:flex!important;align-items:center!important;gap:11px!important;
      margin:0!important;padding:14px 16px!important;border-bottom:1px solid var(--border)!important;
      background:var(--glass2)!important;color:var(--text)!important;font-size:15px!important;font-weight:900!important;
      backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important;
    }
    .scientific-pop-title i{
      width:42px!important;height:42px!important;display:grid!important;place-items:center!important;border-radius:16px!important;
      color:var(--bg)!important;background:linear-gradient(135deg,var(--primary-soft),var(--primary))!important;box-shadow:none!important;flex:0 0 auto!important;
    }
    .scientific-pop-title::after{
      content:"نافذة فرعية";margin-right:auto;padding:6px 10px;border-radius:999px;color:var(--primary);
      background:rgba(11,94,215,.08);font-size:11px;font-weight:900;white-space:nowrap;
    }
    .scientific-pop-grid{
      display:grid!important;grid-template-columns:1fr!important;gap:9px!important;padding:14px!important;
      max-height:none!important;overflow:visible!important;box-sizing:border-box!important;
    }
    .scientific-spec-option{
      width:100%!important;min-height:62px!important;display:grid!important;
      grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;
      padding:10px!important;border-radius:20px!important;border:1px solid var(--border)!important;
      background:rgba(255,255,255,.44)!important;color:var(--text)!important;box-shadow:none!important;
      text-align:right!important;transition:.25s var(--ease)!important;overflow:hidden!important;box-sizing:border-box!important;
    }
    .dark .scientific-spec-option{background:rgba(241,247,251,.05)!important}
    .scientific-spec-option.is-hidden{display:none!important}
    .scientific-spec-option i{
      width:40px!important;height:40px!important;display:grid!important;place-items:center!important;border-radius:15px!important;
      color:var(--bg)!important;background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      box-shadow:0 10px 22px rgba(11,94,215,.16)!important;font-size:16px!important;flex:0 0 auto!important;
    }
    .scientific-spec-option span{min-width:0!important;width:100%!important;display:block!important;overflow:hidden!important;line-height:1.45!important}
    .scientific-spec-name,
    .scientific-spec-option span:not(.scientific-picker-arrow){
      display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;
      overflow:hidden!important;text-overflow:ellipsis!important;word-break:break-word!important;overflow-wrap:anywhere!important;
      color:inherit!important;font-size:12.8px!important;line-height:1.45!important;font-weight:900!important;
    }
    .scientific-spec-option small{
      width:max-content!important;max-width:100%!important;display:inline-flex!important;margin-top:5px!important;padding:3px 7px!important;
      border-radius:999px!important;background:rgba(11,94,215,.08)!important;color:var(--primary)!important;
      font-size:10px!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    }
    .scientific-spec-option:hover,
    .scientific-spec-option.active{
      color:var(--bg)!important;background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      transform:translateY(-2px)!important;box-shadow:0 14px 32px rgba(11,94,215,.20)!important;border-color:transparent!important;
    }
    .scientific-spec-option:hover i,
    .scientific-spec-option.active i{color:var(--primary)!important;background:var(--bg)!important}
    .scientific-spec-option:hover small,
    .scientific-spec-option.active small{color:var(--bg)!important;background:rgba(255,255,255,.18)!important}
    @media(max-width:560px){
      .scientific-specialty-overlay{padding:12px!important}
      .scientific-specialty-pop{width:min(480px,100%)!important;max-height:70vh!important;border-radius:28px 28px 20px 20px!important}
      .scientific-pop-title::after{display:none!important}
    }

  </style>
<style>

    /* FINAL: توحيد Pop اختيار الكلية/التخصص في /committees/1 مع index و /committees */
    .scientific-specialty-overlay{
      position:fixed!important;
      inset:0!important;
      z-index:50000!important;
      display:none!important;
      align-items:flex-end!important;
      justify-content:center!important;
      padding:18px!important;
      background:rgba(15,24,29,.45)!important;
      backdrop-filter:blur(14px)!important;
      -webkit-backdrop-filter:blur(14px)!important;
    }
    .scientific-specialty-overlay.show{
      display:flex!important;
    }
    .scientific-picker.open::before,
    .scientific-specialty-pop::before{
      content:none!important;
      display:none!important;
    }
    .scientific-specialty-pop{
      position:static!important;
      inset:auto!important;
      top:auto!important;
      right:auto!important;
      left:auto!important;
      bottom:auto!important;
      transform:none!important;
      width:min(520px,100%)!important;
      max-width:100%!important;
      max-height:min(72vh,640px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      z-index:auto!important;
      border-radius:30px 30px 24px 24px!important;
      border:1px solid var(--border2)!important;
      background:var(--glass2)!important;
      box-shadow:var(--shadow2)!important;
      padding:0!important;
      display:none!important;
      box-sizing:border-box!important;
    }
    .scientific-specialty-overlay.show .scientific-specialty-pop{
      display:block!important;
      animation:scientificSheetUp .26s var(--ease) both!important;
    }
    @keyframes scientificSheetUp{
      from{opacity:0;transform:translateY(28px) scale(.98)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    .scientific-specialty-pop .sheet-handle{
      width:54px!important;
      height:5px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.25)!important;
      margin:10px auto 4px!important;
      display:block!important;
    }
    .scientific-pop-title{
      position:sticky!important;
      top:0!important;
      z-index:2!important;
      display:flex!important;
      align-items:center!important;
      gap:11px!important;
      margin:0!important;
      padding:14px 16px!important;
      border-bottom:1px solid var(--border)!important;
      background:var(--glass2)!important;
      color:var(--text)!important;
      font-size:15px!important;
      font-weight:900!important;
      backdrop-filter:blur(10px)!important;
      -webkit-backdrop-filter:blur(10px)!important;
    }
    .scientific-pop-title i{
      width:42px!important;
      height:42px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:16px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,var(--primary-soft),var(--primary))!important;
      box-shadow:none!important;
      flex:0 0 auto!important;
    }
    .scientific-pop-title::after{
      content:"نافذة فرعية";
      margin-right:auto;
      padding:6px 10px;
      border-radius:999px;
      color:var(--primary);
      background:rgba(11,94,215,.08);
      font-size:11px;
      font-weight:900;
      white-space:nowrap;
    }
    .scientific-pop-grid{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:9px!important;
      padding:14px!important;
      max-height:none!important;
      overflow:visible!important;
      box-sizing:border-box!important;
    }
    .scientific-spec-option{
      width:100%!important;
      min-height:62px!important;
      display:grid!important;
      grid-template-columns:40px minmax(0,1fr)!important;
      align-items:center!important;
      gap:10px!important;
      padding:10px!important;
      border-radius:20px!important;
      border:1px solid var(--border)!important;
      background:rgba(255,255,255,.44)!important;
      color:var(--text)!important;
      box-shadow:none!important;
      text-align:right!important;
      transition:.25s var(--ease)!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
    }
    .dark .scientific-spec-option{
      background:rgba(241,247,251,.05)!important;
    }
    .scientific-spec-option.is-hidden{
      display:none!important;
    }
    .scientific-spec-option i{
      width:40px!important;
      height:40px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:15px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      box-shadow:0 10px 22px rgba(11,94,215,.16)!important;
      font-size:16px!important;
      flex:0 0 auto!important;
    }
    .scientific-spec-option span{
      min-width:0!important;
      width:100%!important;
      display:block!important;
      overflow:hidden!important;
      line-height:1.45!important;
    }
    .scientific-spec-name,
    .scientific-spec-option span:not(.scientific-picker-arrow){
      display:-webkit-box!important;
      -webkit-line-clamp:2!important;
      -webkit-box-orient:vertical!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
      color:inherit!important;
      font-size:12.8px!important;
      line-height:1.45!important;
      font-weight:900!important;
    }
    .scientific-spec-option small{
      width:max-content!important;
      max-width:100%!important;
      display:inline-flex!important;
      margin-top:5px!important;
      padding:3px 7px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.08)!important;
      color:var(--primary)!important;
      font-size:10px!important;
      font-weight:900!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    .scientific-spec-option:hover,
    .scientific-spec-option.active{
      color:var(--bg)!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      transform:translateY(-2px)!important;
      box-shadow:0 14px 32px rgba(11,94,215,.20)!important;
      border-color:transparent!important;
    }
    .scientific-spec-option:hover i,
    .scientific-spec-option.active i{
      color:var(--primary)!important;
      background:var(--bg)!important;
    }
    .scientific-spec-option:hover small,
    .scientific-spec-option.active small{
      color:var(--bg)!important;
      background:rgba(255,255,255,.18)!important;
    }
    @media(max-width:560px){
      .scientific-specialty-overlay{
        padding:12px!important;
      }
      .scientific-specialty-pop{
        width:min(480px,100%)!important;
        max-height:70vh!important;
        border-radius:28px 28px 20px 20px!important;
      }
      .scientific-pop-title::after{
        display:none!important;
      }
    }

  </style>
<style>

    /* اختيار الكلية ثم التخصص */
    .scientific-picker-row{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      margin:0 0 8px!important;
    }
    .scientific-picker-row .scientific-picker{
      margin:0!important;
    }
    .scientific-step-label{
      display:inline-flex;
      align-items:center;
      gap:6px;
      color:var(--muted);
      font-size:11px;
      font-weight:900;
      margin-bottom:3px;
    }
    .scientific-step-label b{
      width:20px;height:20px;border-radius:8px;display:grid;place-items:center;
      background:rgba(11,94,215,.09);color:var(--primary);
      font-size:10px;
    }
    .scientific-spec-option.is-hidden{
      display:none!important;
    }
    .scientific-picker.is-disabled{
      opacity:.58;
      pointer-events:none;
      filter:grayscale(.25);
    }
    @media(max-width:680px){
      .scientific-picker-row{
        grid-template-columns:1fr;
      }
    }

  </style>
<style>

    /* توحيد شكل Pop اختيار الكلية/التخصص مع شكل index */
    .scientific-specialty-overlay{
      position:fixed!important;
      inset:0!important;
      z-index:50000!important;
      display:none!important;
      align-items:flex-end!important;
      justify-content:center!important;
      padding:18px!important;
      background:rgba(15,24,29,.45)!important;
      backdrop-filter:blur(14px)!important;
      -webkit-backdrop-filter:blur(14px)!important;
    }
    .scientific-specialty-overlay.show{
      display:flex!important;
    }
    .scientific-picker.open::before,
    .scientific-specialty-pop::before{
      content:none!important;
      display:none!important;
    }
    .scientific-specialty-pop{
      position:static!important;
      top:auto!important;
      right:auto!important;
      left:auto!important;
      bottom:auto!important;
      inset:auto!important;
      transform:none!important;
      width:min(520px,100%)!important;
      max-width:100%!important;
      max-height:min(72vh,640px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      z-index:auto!important;
      border-radius:30px 30px 24px 24px!important;
      border:1px solid var(--border2)!important;
      background:var(--glass2)!important;
      box-shadow:var(--shadow2)!important;
      padding:0!important;
      display:none!important;
      box-sizing:border-box!important;
    }
    .scientific-specialty-overlay.show .scientific-specialty-pop{
      display:block!important;
      animation:scientificSheetUp .26s var(--ease) both!important;
    }
    @keyframes scientificSheetUp{
      from{opacity:0;transform:translateY(28px) scale(.98)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    .scientific-specialty-pop .sheet-handle{
      width:54px!important;
      height:5px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.25)!important;
      margin:10px auto 4px!important;
      display:block!important;
    }
    .scientific-pop-title{
      position:sticky!important;
      top:0!important;
      z-index:2!important;
      display:flex!important;
      align-items:center!important;
      gap:11px!important;
      margin:0!important;
      padding:14px 16px!important;
      border-bottom:1px solid var(--border)!important;
      background:var(--glass2)!important;
      color:var(--text)!important;
      font-size:15px!important;
      font-weight:900!important;
      backdrop-filter:blur(10px)!important;
    }
    .scientific-pop-title i{
      width:42px!important;
      height:42px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:16px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,var(--primary-soft),var(--primary))!important;
      box-shadow:none!important;
      flex:0 0 auto!important;
    }
    .scientific-pop-title::after{
      content:"نافذة فرعية";
      margin-right:auto;
      padding:6px 10px;
      border-radius:999px;
      color:var(--primary);
      background:rgba(11,94,215,.08);
      font-size:11px;
      font-weight:900;
      white-space:nowrap;
    }
    .scientific-pop-grid{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:9px!important;
      padding:14px!important;
      max-height:none!important;
      overflow:visible!important;
      box-sizing:border-box!important;
    }
    .scientific-spec-option{
      width:100%!important;
      min-height:62px!important;
      display:grid!important;
      grid-template-columns:40px minmax(0,1fr)!important;
      align-items:center!important;
      gap:10px!important;
      padding:10px!important;
      border-radius:20px!important;
      border:1px solid var(--border)!important;
      background:rgba(255,255,255,.44)!important;
      color:var(--text)!important;
      box-shadow:none!important;
      text-align:right!important;
      transition:.25s var(--ease)!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
    }
    .dark .scientific-spec-option{
      background:rgba(241,247,251,.05)!important;
    }
    .scientific-spec-option i{
      width:40px!important;
      height:40px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:15px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      box-shadow:0 10px 22px rgba(11,94,215,.16)!important;
      font-size:16px!important;
      flex:0 0 auto!important;
    }
    .scientific-spec-option span{
      min-width:0!important;
      width:100%!important;
      display:block!important;
      overflow:hidden!important;
      line-height:1.45!important;
    }
    .scientific-spec-name,
    .scientific-spec-option span:not(.scientific-picker-arrow){
      display:-webkit-box!important;
      -webkit-line-clamp:2!important;
      -webkit-box-orient:vertical!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
      color:inherit!important;
      font-size:12.8px!important;
      line-height:1.45!important;
      font-weight:900!important;
    }
    .scientific-spec-option small{
      width:max-content!important;
      max-width:100%!important;
      display:inline-flex!important;
      margin-top:5px!important;
      padding:3px 7px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.08)!important;
      color:var(--primary)!important;
      font-size:10px!important;
      font-weight:900!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    .scientific-spec-option:hover,
    .scientific-spec-option.active{
      color:var(--bg)!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      transform:translateY(-2px)!important;
      box-shadow:0 14px 32px rgba(11,94,215,.20)!important;
      border-color:transparent!important;
    }
    .scientific-spec-option:hover i,
    .scientific-spec-option.active i{
      color:var(--primary)!important;
      background:var(--bg)!important;
    }
    .scientific-spec-option:hover small,
    .scientific-spec-option.active small{
      color:var(--bg)!important;
      background:rgba(255,255,255,.18)!important;
    }
    .scientific-specialty-pop{
      scrollbar-width:thin!important;
      scrollbar-color:rgba(11,94,215,.34) rgba(11,94,215,.055)!important;
    }
    .scientific-specialty-pop::-webkit-scrollbar{
      width:7px!important;
      height:7px!important;
    }
    .scientific-specialty-pop::-webkit-scrollbar-track{
      background:rgba(11,94,215,.05)!important;
      border-radius:999px!important;
      margin:10px 0!important;
    }
    .scientific-specialty-pop::-webkit-scrollbar-thumb{
      background:rgba(11,94,215,.32)!important;
      border-radius:999px!important;
      border:2px solid rgba(255,255,255,.45)!important;
    }
    @media(max-width:560px){
      .scientific-specialty-overlay{
        padding:12px!important;
      }
      .scientific-specialty-pop{
        width:min(480px,100%)!important;
        max-height:70vh!important;
        border-radius:28px 28px 20px 20px!important;
      }
      .scientific-pop-title::after{
        display:none!important;
      }
    }

  </style>
<style>

    /* توحيد شكل Pop روابط القنوات في /committees/id مع شكل index */
    .committee-links-backdrop.show{
      display:flex!important;
      align-items:flex-end!important;
      justify-content:center!important;
      padding:20px!important;
      background:rgba(15,24,29,.45)!important;
      backdrop-filter:blur(14px)!important;
      -webkit-backdrop-filter:blur(14px)!important;
      overflow:hidden!important;
    }
    .committee-links-sheet{
      width:min(980px,100%)!important;
      max-width:100%!important;
      max-height:min(88vh,820px)!important;
      overflow:hidden!important;
      display:flex!important;
      flex-direction:column!important;
      border-radius:34px 34px 26px 26px!important;
      border:1px solid var(--border2)!important;
      background:var(--glass2)!important;
      box-shadow:var(--shadow2)!important;
      padding:18px!important;
      contain:none!important;
    }
    .committee-links-sheet .sheet-handle{
      flex:0 0 auto!important;
      width:56px!important;
      height:5px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.25)!important;
      margin:0 auto 12px!important;
    }
    .committee-links-sheet .sheet-head{
      flex:0 0 auto!important;
      display:grid!important;
      grid-template-columns:62px 1fr 44px!important;
      align-items:center!important;
      gap:12px!important;
      margin-bottom:14px!important;
      padding:0!important;
      border-bottom:0!important;
      background:transparent!important;
    }
    .committee-links-sheet .sheet-icon{
      width:62px!important;
      height:62px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:22px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,var(--primary-soft),var(--primary))!important;
      font-size:23px!important;
      box-shadow:none!important;
    }
    .committee-links-sheet .sheet-head h3{
      margin:0!important;
      color:var(--text)!important;
      font-size:18px!important;
      font-weight:900!important;
      line-height:1.5!important;
    }
    .committee-links-sheet .sheet-head p{
      margin:3px 0 0!important;
      color:var(--muted)!important;
      font-size:12.5px!important;
      font-weight:800!important;
      line-height:1.7!important;
    }
    .committee-links-sheet .sheet-close{
      width:44px!important;
      height:44px!important;
      border-radius:16px!important;
      border:1px solid var(--border)!important;
      background:var(--glass)!important;
      color:var(--text)!important;
      display:grid!important;
      place-items:center!important;
      cursor:pointer!important;
    }
    .committee-links-sheet .links-list,
    #committeeLinksList{
      flex:1 1 auto!important;
      min-height:0!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding-left:4px!important;
      padding-right:0!important;
      margin-top:0!important;
      display:grid!important;
      gap:12px!important;
      overscroll-behavior:contain!important;
      scrollbar-width:thin!important;
      scrollbar-color:rgba(11,94,215,.34) rgba(11,94,215,.055)!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar,
    #committeeLinksList::-webkit-scrollbar{
      width:7px!important;
      height:7px!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-track,
    #committeeLinksList::-webkit-scrollbar-track{
      background:rgba(11,94,215,.05)!important;
      border-radius:999px!important;
      margin:10px 0!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb,
    #committeeLinksList::-webkit-scrollbar-thumb{
      background:rgba(11,94,215,.32)!important;
      border-radius:999px!important;
      border:2px solid rgba(255,255,255,.45)!important;
    }
    @media(max-width:760px){
      .committee-links-backdrop.show{
        padding:12px!important;
      }
      .committee-links-sheet{
        max-height:86vh!important;
        border-radius:30px 30px 22px 22px!important;
        padding:15px!important;
      }
      .committee-links-sheet .sheet-head{
        grid-template-columns:54px 1fr 40px!important;
      }
      .committee-links-sheet .sheet-icon{
        width:54px!important;
        height:54px!important;
        border-radius:19px!important;
      }
    }

  </style>
  <style>

    /* إصلاح Scroll نافذة روابط القنوات في صفحة /committees/id */
    .committee-links-backdrop.show{
      display:flex!important;
      align-items:flex-end!important;
      justify-content:center!important;
      overflow:hidden!important;
      padding:20px!important;
    }
    .committee-links-sheet{
      width:min(980px,100%)!important;
      max-width:100%!important;
      max-height:min(88vh,820px)!important;
      display:flex!important;
      flex-direction:column!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
      contain:none!important;
    }
    .committee-links-sheet > .sheet-handle,
    .committee-links-sheet > .sheet-head{
      flex:0 0 auto!important;
    }
    .committee-links-sheet .links-list,
    #committeeLinksList{
      flex:1 1 auto!important;
      min-height:0!important;
      max-height:none!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      overscroll-behavior:contain!important;
      padding-left:5px!important;
      scrollbar-width:thin!important;
      scrollbar-color:rgba(11,94,215,.35) rgba(11,94,215,.055)!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar,
    #committeeLinksList::-webkit-scrollbar{
      width:7px!important;
      height:7px!important;
      display:block!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-track,
    #committeeLinksList::-webkit-scrollbar-track{
      background:rgba(11,94,215,.05)!important;
      border-radius:999px!important;
      margin:10px 0!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb,
    #committeeLinksList::-webkit-scrollbar-thumb{
      background:rgba(11,94,215,.32)!important;
      border-radius:999px!important;
      border:2px solid rgba(255,255,255,.45)!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb:hover,
    #committeeLinksList::-webkit-scrollbar-thumb:hover{
      background:rgba(11,94,215,.48)!important;
    }
    @media(max-width:760px){
      .committee-links-backdrop.show{
        padding:12px!important;
      }
      .committee-links-sheet{
        max-height:86vh!important;
      }
    }

  </style>
  <style>

    /* إزالة اللون الخافت من شاشة اختيار الكلية + منع السكرول الأفقي نهائيًا */
    .scientific-specialty-overlay,
    .scientific-specialty-overlay.show{
      background:transparent!important;
      backdrop-filter:none!important;
      -webkit-backdrop-filter:none!important;
    }
    .scientific-picker.open::before,
    .scientific-specialty-pop::before{
      content:none!important;
      display:none!important;
      background:none!important;
      backdrop-filter:none!important;
      -webkit-backdrop-filter:none!important;
    }

    .committee-links-backdrop,
    .committee-links-backdrop.show{
      overflow-x:hidden!important;
    }
    .committee-links-sheet{
      width:min(980px,calc(100vw - 28px))!important;
      max-width:calc(100vw - 28px)!important;
      overflow-x:hidden!important;
      box-sizing:border-box!important;
      contain:layout paint;
    }
    .committee-links-sheet *,
    .links-list,
    .links-list *,
    .scientific-links-wrap,
    .scientific-links-wrap *,
    .committee-link-card,
    .committee-link-card *,
    .scientific-channel-card,
    .scientific-channel-card *{
      box-sizing:border-box!important;
      max-width:100%!important;
      min-width:0!important;
    }
    .committee-links-sheet .links-list{
      overflow-x:hidden!important;
      width:100%!important;
      max-width:100%!important;
    }
    .scientific-channel-grid{
      width:100%!important;
      max-width:100%!important;
      overflow-x:hidden!important;
      grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))!important;
    }
    .scientific-channel-card{
      width:100%!important;
      max-width:100%!important;
      overflow:hidden!important;
      grid-template-columns:48px minmax(0,1fr)!important;
    }
    .committee-link-card{
      width:100%!important;
      max-width:100%!important;
      overflow:hidden!important;
      grid-template-columns:52px minmax(0,1fr) auto!important;
    }
    .scientific-chip,
    .committee-link-card h4,
    .committee-link-card p,
    .scientific-channel-card h4,
    .scientific-selected-title,
    #scientificPickerLabel{
      max-width:100%!important;
      overflow:hidden!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
    }
    .scientific-chip{
      white-space:normal!important;
      text-overflow:clip!important;
      line-height:1.45!important;
    }
    .scientific-selected-title{
      flex-wrap:wrap!important;
      line-height:1.6!important;
    }
    .committee-link-card .btn,
    .scientific-channel-card .btn{
      max-width:100%!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }

    @media(max-width:760px){
      .committee-links-sheet{
        width:calc(100vw - 20px)!important;
        max-width:calc(100vw - 20px)!important;
      }
      .committee-link-card{
        grid-template-columns:46px minmax(0,1fr)!important;
      }
      .committee-link-card .btn{
        grid-column:1/-1!important;
        width:100%!important;
      }
      .scientific-channel-card{
        grid-template-columns:44px minmax(0,1fr)!important;
      }
      .scientific-channel-card .btn{
        grid-column:1/-1!important;
        width:100%!important;
      }
    }

  </style>
  <style>

    /* إصلاح نهائي للأسماء الطويلة + سكرول خافت + إزالة اللمعة المتحركة */
    .scientific-picker.open::before{
      content:none!important;
      display:none!important;
      background:none!important;
      backdrop-filter:none!important;
      pointer-events:none!important;
    }
    .scientific-specialty-overlay{
      background:rgba(15,24,29,.30)!important;
      backdrop-filter:blur(8px)!important;
      -webkit-backdrop-filter:blur(8px)!important;
    }

    /* Scroll خافت وناعم في Chrome */
    .committee-links-sheet .links-list,
    .scientific-specialty-pop{
      scrollbar-width:thin!important;
      scrollbar-color:rgba(11,94,215,.34) rgba(11,94,215,.055)!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar,
    .scientific-specialty-pop::-webkit-scrollbar{
      width:7px!important;
      height:7px!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-track,
    .scientific-specialty-pop::-webkit-scrollbar-track{
      background:rgba(11,94,215,.045)!important;
      border-radius:999px!important;
      margin:12px 0!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb,
    .scientific-specialty-pop::-webkit-scrollbar-thumb{
      background:rgba(11,94,215,.32)!important;
      border-radius:999px!important;
      border:2px solid rgba(255,255,255,.42)!important;
      min-height:42px!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb:hover,
    .scientific-specialty-pop::-webkit-scrollbar-thumb:hover{
      background:rgba(11,94,215,.48)!important;
    }

    /* حماية Pop اختيار الكلية/التخصص من الأسماء الطويلة جدًا */
    .scientific-specialty-pop,
    .scientific-pop-grid,
    .scientific-spec-option,
    .scientific-spec-option span,
    .scientific-spec-option b,
    .scientific-spec-name{
      min-width:0!important;
      max-width:100%!important;
      box-sizing:border-box!important;
    }
    .scientific-spec-option{
      width:100%!important;
      overflow:hidden!important;
      grid-template-columns:34px minmax(0,1fr)!important;
    }
    .scientific-spec-option span{
      overflow:hidden!important;
      white-space:normal!important;
    }
    .scientific-spec-name,
    .scientific-spec-option span:not(.scientific-picker-arrow){
      display:-webkit-box!important;
      -webkit-box-orient:vertical!important;
      -webkit-line-clamp:2!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
      line-height:1.38!important;
    }
    .scientific-spec-option small{
      max-width:100%!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }

    /* حماية كروت روابط القنوات من اسم قناة أو كلية طويل */
    .committee-link-card,
    .scientific-channel-card{
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
    }
    .committee-link-card > *,
    .scientific-channel-card > *{
      min-width:0!important;
      max-width:100%!important;
    }
    .committee-link-card h4,
    .committee-link-card p,
    .scientific-channel-card h4{
      max-width:100%!important;
      display:-webkit-box!important;
      -webkit-box-orient:vertical!important;
      -webkit-line-clamp:2!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
    }
    .scientific-channel-meta{
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    .scientific-chip{
      min-width:0!important;
      max-width:100%!important;
      white-space:normal!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
      line-height:1.45!important;
    }
    .scientific-picker-main,
    .scientific-picker-main div,
    #scientificPickerLabel{
      min-width:0!important;
      max-width:100%!important;
    }
    #scientificPickerLabel{
      display:block!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }

  </style>
  <style>

    /* إصلاح لون Scroll في Chrome + حماية التصميم من الأسماء الطويلة */
    .committee-links-sheet .links-list{
      scrollbar-width:thin!important;
      scrollbar-color:rgba(11,94,215,.75) rgba(11,94,215,.10)!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar,
    .scientific-specialty-pop::-webkit-scrollbar{
      width:9px!important;
      height:9px!important;
      display:block!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-track,
    .scientific-specialty-pop::-webkit-scrollbar-track{
      background:rgba(11,94,215,.10)!important;
      border-radius:999px!important;
      margin:12px 0!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb,
    .scientific-specialty-pop::-webkit-scrollbar-thumb{
      background:linear-gradient(180deg,#00A6D6,#0B5ED7,#063B8F)!important;
      border-radius:999px!important;
      border:2px solid rgba(255,255,255,.75)!important;
      min-height:44px!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb:hover,
    .scientific-specialty-pop::-webkit-scrollbar-thumb:hover{
      background:linear-gradient(180deg,#0B5ED7,#063B8F)!important;
    }

    .committee-link-card,
    .scientific-channel-card{
      min-width:0!important;
      overflow:hidden!important;
    }
    .committee-link-card > div:nth-child(2),
    .scientific-channel-card > div:nth-child(2),
    .scientific-channel-card > div,
    .committee-link-card h4,
    .committee-link-card p,
    .scientific-channel-card h4,
    .scientific-channel-meta{
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    .committee-link-card h4,
    .scientific-channel-card h4{
      display:-webkit-box!important;
      -webkit-line-clamp:2!important;
      -webkit-box-orient:vertical!important;
      overflow:hidden!important;
      overflow-wrap:anywhere!important;
      word-break:break-word!important;
      line-height:1.55!important;
    }
    .committee-link-card p{
      display:-webkit-box!important;
      -webkit-line-clamp:2!important;
      -webkit-box-orient:vertical!important;
      overflow:hidden!important;
      overflow-wrap:anywhere!important;
      word-break:break-word!important;
    }
    .scientific-channel-meta{
      display:flex!important;
      flex-wrap:wrap!important;
      gap:6px!important;
    }
    .scientific-chip{
      max-width:100%!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      white-space:nowrap!important;
    }
    .scientific-chip i{
      flex:0 0 auto!important;
    }
    .committee-link-card .btn,
    .scientific-channel-card .btn{
      flex-shrink:0!important;
      white-space:nowrap!important;
    }
    @media(max-width:760px){
      .committee-link-card{
        grid-template-columns:46px minmax(0,1fr)!important;
      }
      .committee-link-card .btn{
        grid-column:1/-1!important;
        width:100%!important;
        justify-content:center!important;
      }
      .scientific-chip{
        white-space:normal!important;
        overflow-wrap:anywhere!important;
      }
    }

  </style>
  <style>

    /* تقليل المسافة بين اختيار التخصص/الكلية وعرض القنوات */
    .scientific-links-wrap{
      gap:10px!important;
    }
    .scientific-clean-head{
      margin-bottom:8px!important;
    }
    .scientific-picker{
      margin:0 0 6px!important;
    }
    .scientific-panels{
      margin-top:0!important;
    }
    .scientific-selected-title{
      margin:0 0 8px!important;
      padding-top:0!important;
    }
    .scientific-channel-grid{
      margin-top:0!important;
    }

  </style>
  <style>

    /* إصلاح Scroll نافذة روابط القنوات العلمية */
    .committee-links-backdrop.show{
      align-items:flex-end!important;
      overflow:hidden!important;
    }
    .committee-links-sheet{
      max-height:min(88vh,820px)!important;
      overflow:hidden!important;
      display:flex!important;
      flex-direction:column!important;
    }
    .committee-links-sheet .sheet-head{
      flex:0 0 auto!important;
    }
    .committee-links-sheet .links-list{
      flex:1 1 auto!important;
      min-height:0!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding-left:4px!important;
      overscroll-behavior:contain!important;
      scrollbar-width:thin!important;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar{
      width:7px;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-thumb{
      background:rgba(11,94,215,.35);
      border-radius:999px;
    }
    .committee-links-sheet .links-list::-webkit-scrollbar-track{
      background:rgba(11,94,215,.06);
      border-radius:999px;
    }
    @media(max-width:760px){
      .committee-links-sheet{
        max-height:86vh!important;
      }
    }

  </style>
  <style>

    /* Pop اختيار التخصص بنفس منطق نافذة روابط القنوات العلمية لكن أصغر */
    .scientific-specialty-overlay{
      position:fixed;
      inset:0;
      z-index:50000;
      display:none;
      align-items:flex-end;
      justify-content:center;
      padding:18px;
      background:rgba(15,24,29,.45);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
    }
    .scientific-specialty-overlay.show{
      display:flex;
    }
    .scientific-specialty-pop{
      position:static!important;
      inset:auto!important;
      transform:none!important;
      width:min(520px,100%)!important;
      max-height:min(72vh,640px)!important;
      overflow:auto!important;
      z-index:auto!important;
      border-radius:30px 30px 24px 24px!important;
      border:1px solid var(--border2)!important;
      background:var(--glass2)!important;
      box-shadow:var(--shadow2)!important;
      padding:0!important;
      display:none!important;
    }
    .scientific-specialty-overlay.show .scientific-specialty-pop{
      display:block!important;
      animation:scientificSheetUp .26s var(--ease) both!important;
    }
    @keyframes scientificSheetUp{
      from{opacity:0;transform:translateY(28px) scale(.98)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    .scientific-specialty-pop .sheet-handle{
      width:54px;
      height:5px;
      border-radius:999px;
      background:rgba(11,94,215,.25);
      margin:10px auto 4px;
    }
    .scientific-pop-title{
      position:sticky!important;
      top:0!important;
      z-index:2!important;
      display:flex!important;
      align-items:center!important;
      gap:11px!important;
      margin:0!important;
      padding:14px 16px!important;
      border-bottom:1px solid var(--border)!important;
      background:var(--glass2)!important;
      color:var(--text)!important;
      font-size:15px!important;
      font-weight:900!important;
      backdrop-filter:blur(10px)!important;
    }
    .scientific-pop-title i{
      width:42px!important;
      height:42px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:16px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,var(--primary-soft),var(--primary))!important;
      box-shadow:none!important;
    }
    .scientific-pop-title::after{
      content:"نافذة فرعية";
      margin-right:auto;
      padding:6px 10px;
      border-radius:999px;
      color:var(--primary);
      background:rgba(11,94,215,.08);
      font-size:11px;
      font-weight:900;
    }
    .scientific-pop-grid{
      display:grid!important;
      grid-template-columns:1fr!important;
      gap:9px!important;
      padding:14px!important;
      max-height:none!important;
      overflow:visible!important;
    }
    .scientific-spec-option{
      min-height:62px!important;
      display:grid!important;
      grid-template-columns:40px minmax(0,1fr)!important;
      align-items:center!important;
      gap:10px!important;
      padding:10px!important;
      border-radius:20px!important;
      border:1px solid var(--border)!important;
      background:rgba(255,255,255,.44)!important;
      color:var(--text)!important;
      box-shadow:none!important;
      text-align:right!important;
      transition:.25s var(--ease)!important;
    }
    .dark .scientific-spec-option{
      background:rgba(241,247,251,.05)!important;
    }
    .scientific-spec-option i{
      width:40px!important;
      height:40px!important;
      display:grid!important;
      place-items:center!important;
      border-radius:15px!important;
      color:var(--bg)!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      box-shadow:0 10px 22px rgba(11,94,215,.16)!important;
      font-size:16px!important;
    }
    .scientific-spec-option span{
      min-width:0!important;
      width:100%!important;
      display:block!important;
      overflow:hidden!important;
      line-height:1.45!important;
    }
    .scientific-spec-name{
      display:-webkit-box!important;
      -webkit-line-clamp:2!important;
      -webkit-box-orient:vertical!important;
      overflow:hidden!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
      color:inherit!important;
      font-size:12.8px!important;
      line-height:1.45!important;
      font-weight:900!important;
    }
    .scientific-spec-option small{
      width:max-content!important;
      max-width:100%!important;
      display:inline-flex!important;
      margin-top:5px!important;
      padding:3px 7px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.08)!important;
      color:var(--primary)!important;
      font-size:10px!important;
      font-weight:900!important;
    }
    .scientific-spec-option:hover,
    .scientific-spec-option.active{
      color:var(--bg)!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F)!important;
      transform:translateY(-2px)!important;
      box-shadow:0 14px 32px rgba(11,94,215,.20)!important;
      border-color:transparent!important;
    }
    .scientific-spec-option:hover i,
    .scientific-spec-option.active i{
      color:var(--primary)!important;
      background:var(--bg)!important;
    }
    .scientific-spec-option:hover small,
    .scientific-spec-option.active small{
      color:var(--bg)!important;
      background:rgba(255,255,255,.18)!important;
    }
    @media(max-width:560px){
      .scientific-specialty-overlay{
        padding:12px;
      }
      .scientific-specialty-pop{
        width:min(480px,100%)!important;
        max-height:70vh!important;
        border-radius:28px 28px 20px 20px!important;
      }
      .scientific-pop-title::after{
        display:none;
      }
    }

  </style>
  <style>

    /* منع قص نافذة اختيار التخصص عند السكرول + تصغير العرض أكثر */
    .committee-links-backdrop.show{
      overflow:visible!important;
    }
    .committee-links-sheet{
      overflow:visible!important;
    }
    .committee-links-sheet .links-list{
      overflow:visible!important;
    }
    .scientific-specialty-pop{
      position:fixed!important;
      top:50%!important;
      right:50%!important;
      left:auto!important;
      bottom:auto!important;
      transform:translate(50%,-50%)!important;
      width:min(380px,calc(100vw - 62px))!important;
      max-height:min(56vh,470px)!important;
      overflow:auto!important;
      z-index:99999!important;
    }
    .scientific-picker.open::before{
      z-index:99990!important;
    }
    .scientific-pop-grid{
      grid-template-columns:1fr!important;
      padding:10px!important;
      gap:7px!important;
    }
    .scientific-pop-title{
      padding:11px 13px!important;
      font-size:13.5px!important;
    }
    .scientific-pop-title i{
      width:32px!important;
      height:32px!important;
      border-radius:12px!important;
    }
    .scientific-spec-option{
      min-height:56px!important;
      padding:8px 9px!important;
      border-radius:17px!important;
      grid-template-columns:34px minmax(0,1fr)!important;
    }
    .scientific-spec-option i{
      width:34px!important;
      height:34px!important;
      border-radius:12px!important;
      font-size:14px!important;
    }
    .scientific-spec-name{
      font-size:12px!important;
      line-height:1.35!important;
      -webkit-line-clamp:2!important;
    }
    .scientific-spec-option small{
      font-size:9.8px!important;
      padding:3px 6px!important;
      margin-top:4px!important;
    }
    @media(max-width:560px){
      .scientific-specialty-pop{
        width:calc(100vw - 56px)!important;
        max-height:54vh!important;
      }
    }

  </style>
  <style>

    /* تصغير إضافي لنافذة اختيار التخصص */
    .scientific-specialty-pop{
      width:min(440px,calc(100vw - 52px))!important;
      max-height:min(64vh,520px)!important;
    }
    .scientific-pop-grid{
      padding:12px!important;
      gap:8px!important;
    }
    .scientific-spec-option{
      min-height:60px!important;
      padding:9px 10px!important;
      border-radius:18px!important;
    }
    .scientific-spec-option i{
      width:36px!important;
      height:36px!important;
      border-radius:13px!important;
      font-size:15px!important;
    }
    .scientific-spec-name{
      font-size:12.5px!important;
      line-height:1.4!important;
    }
    .scientific-spec-option small{
      font-size:10px!important;
      padding:3px 7px!important;
    }
    .scientific-pop-title{
      padding:12px 14px!important;
      font-size:14px!important;
    }
    .scientific-pop-title i{
      width:34px!important;
      height:34px!important;
      border-radius:13px!important;
    }
    @media(max-width:560px){
      .scientific-specialty-pop{
        width:calc(100vw - 44px)!important;
        max-height:60vh!important;
      }
    }

  </style>
  <style>

    /* تصغير Pop اختيار التخصص ومعالجة الأسماء الطويلة */
    .scientific-specialty-pop{
      width:min(560px,calc(100vw - 44px))!important;
      max-height:min(68vh,560px)!important;
      border-radius:28px!important;
      padding:0!important;
      overflow:auto!important;
    }
    .scientific-specialty-pop::before{
      border-radius:28px!important;
    }
    .scientific-pop-title{
      padding:14px 16px!important;
      font-size:14.5px!important;
    }
    .scientific-pop-title i{
      width:36px!important;
      height:36px!important;
      border-radius:14px!important;
    }
    .scientific-pop-title::after{
      content:"نافذة فرعية"!important;
      font-size:11px!important;
      padding:6px 9px!important;
    }
    .scientific-pop-grid{
      grid-template-columns:1fr!important;
      gap:9px!important;
      padding:14px!important;
      max-height:none!important;
      overflow:visible!important;
    }
    .scientific-spec-option{
      min-height:64px!important;
      grid-template-columns:40px minmax(0,1fr)!important;
      gap:10px!important;
      padding:10px 11px!important;
      border-radius:20px!important;
      text-align:right!important;
    }
    .scientific-spec-option i{
      width:40px!important;
      height:40px!important;
      border-radius:15px!important;
      font-size:16px!important;
    }
    .scientific-spec-option span{
      min-width:0!important;
      width:100%!important;
      display:block!important;
      overflow:hidden!important;
      line-height:1.45!important;
    }
    .scientific-spec-name{
      display:-webkit-box!important;
      -webkit-line-clamp:2!important;
      -webkit-box-orient:vertical!important;
      overflow:hidden!important;
      word-break:break-word!important;
      overflow-wrap:anywhere!important;
      font-size:13px!important;
      line-height:1.45!important;
      font-weight:900!important;
    }
    .scientific-spec-option small{
      width:max-content!important;
      max-width:100%!important;
      margin-top:5px!important;
      font-size:10.5px!important;
    }
    .scientific-picker-main{
      min-width:0!important;
      flex:1 1 auto!important;
    }
    .scientific-picker-main div{
      min-width:0!important;
    }
    #scientificPickerLabel{
      max-width:100%!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    @media(max-width:560px){
      .scientific-specialty-pop{
        width:calc(100vw - 30px)!important;
        max-height:62vh!important;
        border-radius:24px!important;
      }
      .scientific-specialty-pop::before{border-radius:24px!important}
      .scientific-pop-title::after{display:inline-flex!important}
    }

  </style>
  <style>

    /* تحسين نهائي لشكل Pop اختيار التخصص */
    .scientific-picker.open::before{
      content:"";
      position:fixed;
      inset:0;
      background:
        radial-gradient(circle at 50% 25%,rgba(11,94,215,.24),transparent 34%),
        rgba(2,10,24,.42)!important;
      backdrop-filter:blur(12px) saturate(130%)!important;
      -webkit-backdrop-filter:blur(12px) saturate(130%)!important;
      z-index:4500!important;
      pointer-events:auto!important;
    }
    .scientific-specialty-pop{
      position:fixed!important;
      top:50%!important;
      right:50%!important;
      left:auto!important;
      bottom:auto!important;
      transform:translate(50%,-50%)!important;
      width:min(860px,calc(100vw - 30px))!important;
      max-height:calc(100vh - 86px)!important;
      overflow:auto!important;
      z-index:4600!important;
      padding:0!important;
      border-radius:34px!important;
      border:1px solid rgba(255,255,255,.58)!important;
      background:
        linear-gradient(135deg,rgba(255,255,255,.98),rgba(238,247,255,.97)) padding-box,
        linear-gradient(135deg,#00A6D6,#0B5ED7,#063B8F) border-box!important;
      box-shadow:
        0 42px 120px rgba(2,10,24,.45),
        0 24px 60px rgba(11,94,215,.25),
        0 0 0 1px rgba(255,255,255,.55) inset!important;
    }
    .dark .scientific-specialty-pop{
      background:
        linear-gradient(135deg,rgba(23,32,51,.98),rgba(8,20,45,.98)) padding-box,
        linear-gradient(135deg,#00A6D6,#0B5ED7,#063B8F) border-box!important;
      border-color:rgba(255,255,255,.14)!important;
      box-shadow:
        0 42px 120px rgba(0,0,0,.62),
        0 24px 60px rgba(11,94,215,.22),
        0 0 0 1px rgba(255,255,255,.08) inset!important;
    }
    .scientific-picker.open .scientific-specialty-pop{
      animation:scientificElegantPop .24s var(--ease) both!important;
    }
    @keyframes scientificElegantPop{
      from{opacity:0;transform:translate(50%,-44%) scale(.94)}
      to{opacity:1;transform:translate(50%,-50%) scale(1)}
    }
    .scientific-specialty-pop::before{
      content:"";
      position:absolute;
      inset:0;
      border-radius:34px;
      background:
        radial-gradient(circle at top right,rgba(0,166,214,.20),transparent 34%),
        radial-gradient(circle at bottom left,rgba(11,94,215,.14),transparent 36%);
      pointer-events:none;
    }
    .scientific-pop-title{
      position:sticky;
      top:0;
      z-index:2;
      display:flex!important;
      align-items:center!important;
      gap:11px!important;
      margin:0!important;
      padding:18px 20px!important;
      border-bottom:1px solid rgba(11,94,215,.12)!important;
      background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(238,247,255,.92))!important;
      color:var(--text)!important;
      font-size:16px!important;
      font-weight:900!important;
      backdrop-filter:blur(10px);
    }
    .dark .scientific-pop-title{
      background:linear-gradient(135deg,rgba(23,32,51,.95),rgba(8,20,45,.93))!important;
    }
    .scientific-pop-title i{
      width:42px;
      height:42px;
      display:grid;
      place-items:center;
      border-radius:16px;
      color:#fff;
      background:linear-gradient(135deg,#00A6D6,#0B5ED7);
      box-shadow:0 14px 30px rgba(11,94,215,.24);
    }
    .scientific-pop-title::after{
      content:"اختر تخصصك";
      margin-right:auto;
      padding:7px 11px;
      border-radius:999px;
      color:var(--primary);
      background:rgba(11,94,215,.08);
      font-size:12px;
      font-weight:900;
    }
    .scientific-pop-grid{
      position:relative;
      z-index:1;
      display:grid!important;
      grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important;
      gap:12px!important;
      max-height:none!important;
      overflow:visible!important;
      padding:18px!important;
    }
    .scientific-spec-option{
      min-height:82px!important;
      border-radius:24px!important;
      border:1px solid rgba(11,94,215,.12)!important;
      background:
        linear-gradient(135deg,rgba(255,255,255,.86),rgba(238,247,255,.78))!important;
      color:var(--text)!important;
      box-shadow:0 12px 28px rgba(11,94,215,.08)!important;
      position:relative!important;
      overflow:hidden!important;
    }
    .dark .scientific-spec-option{
      background:linear-gradient(135deg,rgba(241,247,251,.07),rgba(11,94,215,.08))!important;
    }
    .scientific-spec-option::before{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.34),transparent);
      transform:translateX(110%) skewX(-18deg);
      transition:.45s var(--ease);
      pointer-events:none;
    }
    .scientific-spec-option:hover::before{
      transform:translateX(-110%) skewX(-18deg);
    }
    .scientific-spec-option i{
      width:44px!important;
      height:44px!important;
      border-radius:17px!important;
      color:#0B5ED7!important;
      background:#fff!important;
      box-shadow:0 10px 22px rgba(11,94,215,.13)!important;
      position:relative;
      z-index:1;
    }
    .scientific-spec-option span{
      position:relative;
      z-index:1;
      font-size:13.5px!important;
      font-weight:900!important;
      line-height:1.55!important;
    }
    .scientific-spec-option small{
      display:inline-flex!important;
      align-items:center;
      justify-content:center;
      margin-top:6px!important;
      padding:4px 8px!important;
      border-radius:999px!important;
      background:rgba(11,94,215,.08)!important;
      color:var(--primary)!important;
      font-size:10.8px!important;
      font-weight:900!important;
    }
    .scientific-spec-option:hover,
    .scientific-spec-option.active{
      border-color:transparent!important;
      background:linear-gradient(135deg,#00A6D6,#0B5ED7,#063B8F)!important;
      color:#fff!important;
      transform:translateY(-4px)!important;
      box-shadow:0 20px 44px rgba(11,94,215,.28)!important;
    }
    .scientific-spec-option:hover i,
    .scientific-spec-option.active i{
      color:#0B5ED7!important;
      background:#fff!important;
    }
    .scientific-spec-option:hover small,
    .scientific-spec-option.active small{
      color:#fff!important;
      background:rgba(255,255,255,.18)!important;
    }
    @media(max-width:560px){
      .scientific-specialty-pop{
        width:calc(100vw - 20px)!important;
        max-height:calc(100vh - 54px)!important;
        border-radius:28px!important;
      }
      .scientific-specialty-pop::before{border-radius:28px}
      .scientific-pop-title{padding:15px!important}
      .scientific-pop-title::after{display:none}
      .scientific-pop-grid{
        grid-template-columns:1fr!important;
        padding:14px!important;
      }
    }

  </style>
  <style>

    /* النسخة النهائية لنافذة اختيار التخصص: Pop واضح وخفيف */
    .scientific-picker.open::before{
      content:"";
      position:fixed;
      inset:0;
      background:rgba(3,12,22,.22)!important;
      backdrop-filter:blur(7px)!important;
      z-index:4500!important;
      pointer-events:auto!important;
    }
    .scientific-specialty-pop{
      position:fixed!important;
      top:50%!important;
      right:50%!important;
      left:auto!important;
      bottom:auto!important;
      transform:translate(50%,-50%)!important;
      width:min(820px,calc(100vw - 28px))!important;
      max-height:calc(100vh - 90px)!important;
      overflow:auto!important;
      z-index:4600!important;
      padding:18px!important;
      border-radius:32px!important;
      border:1px solid rgba(255,255,255,.48)!important;
      background:rgba(255,255,255,.97)!important;
      box-shadow:
        0 40px 120px rgba(3,12,22,.40),
        0 24px 60px rgba(11,94,215,.24),
        0 0 0 1px rgba(11,94,215,.09) inset!important;
    }
    .dark .scientific-specialty-pop{
      background:rgba(23,32,51,.98)!important;
      border-color:rgba(255,255,255,.12)!important;
      box-shadow:
        0 40px 120px rgba(0,0,0,.58),
        0 24px 60px rgba(11,94,215,.22),
        0 0 0 1px rgba(255,255,255,.08) inset!important;
    }
    .scientific-picker.open .scientific-specialty-pop{
      animation:scientificCenterPop .22s var(--ease) both!important;
    }
    @keyframes scientificCenterPop{
      from{opacity:0;transform:translate(50%,-46%) scale(.96)}
      to{opacity:1;transform:translate(50%,-50%) scale(1)}
    }
    .scientific-pop-title{
      padding:3px 2px 13px!important;
      margin-bottom:12px!important;
      border-bottom:1px solid rgba(11,94,215,.10);
      font-size:15px!important;
    }
    .scientific-pop-grid{
      display:grid!important;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;
      gap:11px!important;
      max-height:none!important;
      overflow:visible!important;
      padding:0!important;
    }
    .scientific-spec-option{
      min-height:74px!important;
      border-radius:20px!important;
      background:rgba(238,247,255,.76)!important;
    }
    @media(max-width:560px){
      .scientific-specialty-pop{
        width:calc(100vw - 22px)!important;
        max-height:calc(100vh - 70px)!important;
        padding:14px!important;
      }
      .scientific-pop-grid{
        grid-template-columns:1fr!important;
      }
    }

  </style>
  <style>

    /* ظل أوضح للـ Pop + قسم خاص للقنوات العامة */
    .scientific-picker.open::before{
      content:"";
      position:fixed;
      inset:0;
      background:rgba(3,12,22,.10);
      backdrop-filter:blur(1.5px);
      z-index:35;
      pointer-events:none;
    }
    .scientific-specialty-pop{
      border:1px solid rgba(11,94,215,.20)!important;
      box-shadow:
        0 34px 90px rgba(3,12,22,.28),
        0 18px 44px rgba(11,94,215,.22),
        0 0 0 1px rgba(255,255,255,.38) inset!important;
      background:rgba(255,255,255,.98)!important;
    }
    .dark .scientific-specialty-pop{
      background:rgba(23,32,51,.98)!important;
      box-shadow:
        0 34px 90px rgba(0,0,0,.45),
        0 18px 44px rgba(11,94,215,.22),
        0 0 0 1px rgba(255,255,255,.08) inset!important;
    }
    .scientific-picker.open .scientific-picker-trigger{
      box-shadow:0 18px 50px rgba(11,94,215,.20)!important;
      border-color:rgba(11,94,215,.24)!important;
    }
    .scientific-general-section{
      margin-top:16px;
      padding:14px;
      border-radius:24px;
      background:linear-gradient(135deg,rgba(11,94,215,.06),rgba(0,166,214,.05));
      border:1px solid rgba(11,94,215,.11);
    }
    .scientific-general-title{
      display:flex;
      align-items:center;
      gap:10px;
      margin:0 0 12px;
      color:var(--text);
      font-size:16px;
      font-weight:900;
    }
    .scientific-general-title i{
      width:38px;
      height:38px;
      display:grid;
      place-items:center;
      border-radius:14px;
      color:#fff;
      background:linear-gradient(135deg,#00A6D6,#0B5ED7);
    }

  </style>
  <style>

    /* اختيار التخصص من Pop جميل بدل صفوف الأزرار */
    .scientific-picker{
      position:relative;
      z-index:5;
      margin:0 0 14px;
    }
    .scientific-picker-trigger{
      width:100%;
      min-height:58px;
      border:1px solid rgba(11,94,215,.14);
      border-radius:22px;
      background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(238,247,255,.94));
      color:var(--text);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      cursor:pointer;
      box-shadow:0 14px 34px rgba(11,94,215,.10);
      transition:.25s var(--ease);
      font-weight:900;
    }
    .dark .scientific-picker-trigger{
      background:linear-gradient(135deg,rgba(241,247,251,.08),rgba(11,94,215,.08));
    }
    .scientific-picker-trigger:hover{
      transform:translateY(-2px);
      box-shadow:0 18px 44px rgba(11,94,215,.16);
    }
    .scientific-picker-main{
      display:flex;
      align-items:center;
      gap:11px;
      min-width:0;
    }
    .scientific-picker-main i{
      width:42px;
      height:42px;
      display:grid;
      place-items:center;
      border-radius:16px;
      color:#fff;
      background:linear-gradient(135deg,var(--primary),#063B8F);
      box-shadow:0 12px 26px rgba(11,94,215,.18);
    }
    .scientific-picker-main span{
      display:block;
      color:var(--text);
      font-size:15.5px;
      line-height:1.4;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .scientific-picker-main small{
      display:block;
      color:var(--muted);
      font-size:11.5px;
      margin-top:2px;
      font-weight:900;
    }
    .scientific-picker-arrow{
      width:38px;
      height:38px;
      display:grid;
      place-items:center;
      border-radius:14px;
      color:var(--primary);
      background:rgba(11,94,215,.08);
      flex:0 0 auto;
      transition:.25s var(--ease);
    }
    .scientific-picker.open .scientific-picker-arrow{
      transform:rotate(180deg);
      background:var(--primary);
      color:#fff;
    }
    .scientific-specialty-pop{
      position:absolute;
      top:calc(100% + 10px);
      right:0;
      left:0;
      display:none;
      padding:14px;
      border-radius:26px;
      border:1px solid rgba(11,94,215,.14);
      background:rgba(255,255,255,.94);
      backdrop-filter:blur(18px);
      box-shadow:0 24px 70px rgba(11,94,215,.18);
      z-index:40;
    }
    .dark .scientific-specialty-pop{
      background:rgba(23,32,51,.94);
    }
    .scientific-picker.open .scientific-specialty-pop{
      display:block;
      animation:scientificPopIn .22s var(--ease) both;
    }
    @keyframes scientificPopIn{
      from{opacity:0;transform:translateY(10px) scale(.98)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    .scientific-pop-title{
      display:flex;
      align-items:center;
      gap:9px;
      color:var(--primary);
      font-weight:900;
      margin-bottom:12px;
      font-size:14px;
    }
    .scientific-pop-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
      max-height:min(55vh,430px);
      overflow:auto;
      padding-left:4px;
    }
    .scientific-spec-option{
      min-height:82px;
      border:1px solid rgba(11,94,215,.12);
      border-radius:20px;
      background:rgba(238,247,255,.64);
      color:var(--text);
      display:grid;
      grid-template-columns:38px 1fr;
      align-items:center;
      gap:9px;
      padding:10px;
      cursor:pointer;
      transition:.22s var(--ease);
      text-align:right;
    }
    .dark .scientific-spec-option{
      background:rgba(241,247,251,.06);
    }
    .scientific-spec-option i{
      width:38px;
      height:38px;
      display:grid;
      place-items:center;
      border-radius:14px;
      color:var(--primary);
      background:#fff;
      box-shadow:0 8px 18px rgba(11,94,215,.09);
    }
    .scientific-spec-option span{
      display:block;
      font-size:13px;
      font-weight:900;
      line-height:1.45;
    }
    .scientific-spec-option small{
      display:inline-flex;
      margin-top:5px;
      padding:3px 7px;
      border-radius:999px;
      background:rgba(11,94,215,.08);
      color:var(--primary);
      font-size:10.5px;
      font-weight:900;
    }
    .scientific-spec-option:hover,
    .scientific-spec-option.active{
      background:linear-gradient(135deg,var(--primary),#063B8F);
      color:#fff;
      transform:translateY(-3px);
      box-shadow:0 15px 34px rgba(11,94,215,.22);
    }
    .scientific-spec-option:hover i,
    .scientific-spec-option.active i{
      color:var(--primary);
      background:#fff;
    }
    .scientific-spec-option:hover small,
    .scientific-spec-option.active small{
      color:#fff;
      background:rgba(255,255,255,.18);
    }
    @media(max-width:760px){
      .scientific-pop-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      .scientific-specialty-pop{
        position:fixed;
        top:auto;
        right:14px;
        left:14px;
        bottom:92px;
        max-height:70vh;
        overflow:auto;
      }
    }
    @media(max-width:430px){
      .scientific-pop-grid{grid-template-columns:1fr}
    }

  </style>
  <style>

    /* تصميم أنظف لروابط اللجنة العلمية */
    .scientific-links-wrap{
      display:grid!important;
      gap:16px!important;
      margin-top:14px!important;
    }
    .scientific-clean-head{
      padding:14px 16px;
      border-radius:24px;
      background:linear-gradient(135deg,rgba(11,94,215,.08),rgba(0,166,214,.06));
      border:1px solid rgba(11,94,215,.10);
    }
    .scientific-clean-head h3{
      margin:0 0 5px;
      color:var(--text);
      font-size:18px;
      font-weight:900;
      display:flex;
      align-items:center;
      gap:9px;
    }
    .scientific-clean-head h3 i{color:var(--primary)}
    .scientific-clean-head p{
      margin:0;
      color:var(--muted);
      font-size:13px;
      line-height:1.8;
      font-weight:800;
    }
    .scientific-spec-tabs{
      display:flex!important;
      flex-wrap:wrap!important;
      gap:10px!important;
      overflow:visible!important;
      padding:0!important;
      margin:0!important;
      scrollbar-width:none!important;
    }
    .scientific-spec-tabs::-webkit-scrollbar{display:none!important}
    .scientific-spec-tab{
      flex:0 1 auto!important;
      min-height:48px!important;
      border-radius:18px!important;
      padding:9px 12px!important;
      background:rgba(255,255,255,.72)!important;
      border:1px solid rgba(11,94,215,.14)!important;
      color:var(--text)!important;
      box-shadow:0 10px 24px rgba(11,94,215,.07)!important;
    }
    .dark .scientific-spec-tab{background:rgba(241,247,251,.06)!important}
    .scientific-spec-tab i{
      width:32px!important;
      height:32px!important;
      border-radius:12px!important;
      background:rgba(11,94,215,.10)!important;
      color:var(--primary)!important;
      box-shadow:none!important;
    }
    .scientific-spec-tab small{
      padding:2px 7px;
      border-radius:999px;
      background:rgba(11,94,215,.08);
      color:var(--primary)!important;
      font-size:11px!important;
    }
    .scientific-spec-tab.active{
      background:linear-gradient(135deg,var(--primary),#063B8F)!important;
      color:#fff!important;
      border-color:transparent!important;
      transform:translateY(-2px)!important;
      box-shadow:0 14px 34px rgba(11,94,215,.22)!important;
    }
    .scientific-spec-tab.active i{
      background:#fff!important;
      color:var(--primary)!important;
    }
    .scientific-spec-tab.active small{
      background:rgba(255,255,255,.18);
      color:#fff!important;
    }
    .scientific-spec-panel{display:none;animation:scientificFade .25s var(--ease) both}
    .scientific-spec-panel.active{display:block}
    .scientific-selected-title{
      margin:2px 0 12px!important;
      padding:0!important;
      border:0!important;
      background:transparent!important;
      color:var(--text)!important;
      font-size:17px;
      display:flex;
      align-items:center;
      gap:9px;
      font-weight:900;
    }
    .scientific-selected-title i{
      width:38px!important;
      height:38px!important;
      border-radius:14px!important;
      background:linear-gradient(135deg,var(--primary),#063B8F)!important;
      color:#fff!important;
    }
    .scientific-channel-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
    }
    .scientific-channel-card{
      display:grid!important;
      grid-template-columns:48px 1fr!important;
      gap:11px!important;
      align-items:start!important;
      padding:14px!important;
      border-radius:22px!important;
      border:1px solid rgba(11,94,215,.12)!important;
      background:rgba(255,255,255,.68)!important;
      box-shadow:0 12px 30px rgba(11,94,215,.08)!important;
    }
    .dark .scientific-channel-card{background:rgba(241,247,251,.05)!important}
    .scientific-channel-icon{
      width:48px!important;
      height:48px!important;
      border-radius:16px!important;
      background:linear-gradient(135deg,#1E88E5,#0B5ED7)!important;
      color:#fff!important;
      box-shadow:none!important;
    }
    .scientific-channel-card h4{
      margin:0 0 8px!important;
      color:var(--text)!important;
      font-size:15.5px!important;
      line-height:1.55!important;
    }
    .scientific-channel-meta{
      display:flex;
      flex-wrap:wrap;
      gap:7px;
      margin-bottom:10px;
    }
    .scientific-chip{
      display:inline-flex;
      align-items:center;
      gap:5px;
      padding:5px 8px;
      border-radius:999px;
      background:rgba(11,94,215,.07);
      color:var(--muted);
      font-size:11.5px;
      font-weight:900;
      line-height:1.5;
    }
    .scientific-chip i{color:var(--primary)}
    .scientific-channel-card .btn{
      grid-column:1/-1;
      width:100%;
      justify-content:center;
      border-radius:16px;
      min-height:40px;
    }
    @media(max-width:760px){
      .scientific-channel-grid{grid-template-columns:1fr}
      .scientific-spec-tab{flex:1 1 calc(50% - 10px)!important;justify-content:center}
    }

  </style>
  <style>
    .scientific-spec-tabs{display:flex;gap:10px;overflow-x:auto;padding:10px 4px 14px;margin:4px 0 12px;scrollbar-width:thin}
    .scientific-spec-tab{flex:0 0 auto;display:flex;align-items:center;gap:9px;min-height:48px;padding:9px 13px;border-radius:18px;border:1px solid rgba(11,94,215,.16);color:var(--text);background:rgba(255,255,255,.60);cursor:pointer;font-weight:900;transition:.25s var(--ease);box-shadow:0 10px 24px rgba(11,94,215,.08)}
    .scientific-spec-tab i{width:32px;height:32px;display:grid;place-items:center;border-radius:12px;color:#fff;background:linear-gradient(135deg,#0B5ED7,#063B8F)}
    .scientific-spec-tab small{color:var(--muted);font-weight:900;font-size:11px}.scientific-spec-tab.active{color:#fff;background:linear-gradient(135deg,#00A6D6,#0B5ED7,#063B8F);transform:translateY(-3px);box-shadow:0 16px 36px rgba(11,94,215,.24)}
    .scientific-spec-tab.active i{background:#fff;color:#0B5ED7}.scientific-spec-tab.active small{color:rgba(255,255,255,.86)}
    .scientific-spec-panel{display:none;animation:scientificFade .28s var(--ease) both}.scientific-spec-panel.active{display:block}
    @keyframes scientificFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .scientific-selected-title{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:12px 14px;border-radius:22px;color:var(--primary);background:rgba(11,94,215,.07);border:1px solid rgba(11,94,215,.12);font-weight:900}
    .scientific-selected-title i{width:38px;height:38px;display:grid;place-items:center;border-radius:14px;color:#fff;background:linear-gradient(135deg,#0B5ED7,#063B8F)}
  </style>
  <style>
    .scientific-links-wrap{display:grid;gap:16px;margin-top:14px}
    .scientific-college-group{border:1px solid rgba(11,94,215,.16);border-radius:28px;overflow:hidden;background:rgba(255,255,255,.58);box-shadow:0 18px 48px rgba(11,94,215,.10)}
    .scientific-college-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px;background:linear-gradient(135deg,rgba(11,94,215,.12),rgba(0,166,214,.08));border-bottom:1px solid rgba(11,94,215,.12)}
    .scientific-college-title{display:flex;align-items:center;gap:12px}.scientific-college-title i{width:48px;height:48px;display:grid;place-items:center;border-radius:18px;color:#fff;background:linear-gradient(135deg,#0B5ED7,#063B8F)}
    .scientific-college-title h3{margin:0;color:var(--text);font-size:18px;font-weight:900}.scientific-college-title p{margin:3px 0 0;color:var(--muted);font-size:12.5px;font-weight:800}
    .scientific-count{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:999px;color:#fff;background:linear-gradient(135deg,#00A6D6,#0B5ED7);font-size:12.5px;font-weight:900}
    .scientific-specializations{display:grid;gap:12px;padding:14px}.scientific-spec-group{border:1px solid rgba(11,94,215,.12);border-radius:24px;padding:13px;background:rgba(255,255,255,.46)}
    .scientific-spec-title{display:flex;align-items:center;gap:9px;margin-bottom:10px;color:var(--primary);font-size:15px;font-weight:900}.scientific-level-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .scientific-channel-card{display:grid;grid-template-columns:50px 1fr auto;gap:11px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:21px;background:rgba(255,255,255,.62);transition:.25s var(--ease)}
    .scientific-channel-icon{width:50px;height:50px;border-radius:18px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F);font-size:20px}
    .scientific-channel-card h4{margin:0 0 4px;color:var(--text);font-size:15px;font-weight:900;line-height:1.5}.scientific-channel-card p{margin:0;color:var(--muted);font-size:12.3px;line-height:1.8;font-weight:800}
    .scientific-level-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(11,94,215,.08);color:var(--primary);font-size:11.5px;font-weight:900;margin-top:6px}
    @media(max-width:760px){.scientific-level-grid{grid-template-columns:1fr}.scientific-channel-card{grid-template-columns:46px 1fr}.scientific-channel-card .btn{grid-column:1/-1;width:100%;justify-content:center}}
  </style>
  <style>
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


  <script id="course-registration-modal-fallback">
    (function(){
      function q(id){return document.getElementById(id)}
      function safe(v){return String(v||"")}
      function normalizeFields(value){
        if(!value)return [];
        if(Array.isArray(value))return value;
        if(typeof value==="string"){
          try{var p=JSON.parse(value);return Array.isArray(p)?p:[]}catch(e){return []}
        }
        return [];
      }
      function defaultFields(){
        return [
          {label:"الاسم الكامل",type:"text",required:true,placeholder:"اكتب اسمك الرباعي"},
          {label:"الرقم الأكاديمي",type:"text",required:true,placeholder:"مثال: 202412345"}
        ];
      }
      function fieldKey(label,index){
        return "field_"+index+"_"+String(label||"").replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,32);
      }
      function renderFields(fields){
        var box=q("dynamicCourseFields");
        if(!box)return;
        var list=normalizeFields(fields);
        var finalList=list.length?list:defaultFields();
        box.innerHTML=finalList.map(function(field,index){
          var label=safe(field.label||("حقل "+(index+1)));
          var type=field.type||"text";
          var required=field.required?"required":"";
          var placeholder=safe(field.placeholder||"");
          var name=fieldKey(label,index);
          if(type==="textarea"){
            return '<div class="field full"><label><i class="fa-solid fa-pen-to-square"></i> '+label+'</label><textarea name="'+name+'" data-label="'+label+'" placeholder="'+placeholder+'" '+required+'></textarea></div>';
          }
          if(type==="select"){
            var options=String(field.options||"").split(/,|،|\\n/).map(function(x){return x.trim()}).filter(Boolean);
            return '<div class="field full"><label><i class="fa-solid fa-list"></i> '+label+'</label><select name="'+name+'" data-label="'+label+'" '+required+'><option value="">اختر...</option>'+options.map(function(opt){return '<option value="'+safe(opt)+'">'+safe(opt)+'</option>'}).join("")+'</select></div>';
          }
          var htmlType=["text","number","tel","email","date"].includes(type)?type:"text";
          var icon=htmlType==="tel"?"fa-phone":htmlType==="email"?"fa-envelope":htmlType==="number"?"fa-hashtag":htmlType==="date"?"fa-calendar-days":"fa-user";
          return '<div class="field full"><label><i class="fa-solid '+icon+'"></i> '+label+'</label><input name="'+name+'" data-label="'+label+'" placeholder="'+placeholder+'" '+required+' type="'+htmlType+'" /></div>';
        }).join("");
      }
      function getData(){
        var data={};
        document.querySelectorAll("#dynamicCourseFields input,#dynamicCourseFields textarea,#dynamicCourseFields select").forEach(function(input){
          data[input.dataset.label||input.name]=input.value||"";
        });
        return data;
      }
      function pick(data,keys){
        var entries=Object.entries(data||{});
        var found=entries.find(function(pair){return keys.some(function(k){return String(pair[0]).includes(k)})});
        return found?found[1]:"";
      }
      window.openCourseRegModalFromBtn=function(btn){
        var modal=q("courseModal");
        if(!modal)return;
        var id=q("registrationCourseId"), title=q("registrationCourseTitle"), name=q("modalCourseName");
        if(id)id.value=btn.dataset.courseId||"";
        if(title)title.value=btn.dataset.courseTitle||"";
        if(name)name.textContent="الدورة: "+(btn.dataset.courseTitle||"دورة");
        var fields=[];
        try{fields=JSON.parse(decodeURIComponent(btn.dataset.registrationFields||"[]"))}catch(e){fields=[]}
        renderFields(fields);
        modal.classList.add("show");
        document.body.style.overflow="hidden";
      };
      window.closeCourseRegModal=function(){
        var modal=q("courseModal");
        if(modal)modal.classList.remove("show");
        document.body.style.overflow="hidden";
      };
      document.addEventListener("click",function(e){
        if(e.target&&e.target.id==="closeCourseModal")window.closeCourseRegModal();
        if(e.target&&e.target.id==="cancelCourseModal")window.closeCourseRegModal();
      });
      setTimeout(function(){
        var form=q("courseRegistrationForm");
        if(!form||form.dataset.bound)return;
        form.dataset.bound="1";
        form.addEventListener("submit",async function(e){
          e.preventDefault();
          var registrationData=getData();
          var payload={
            course_id:q("registrationCourseId")?q("registrationCourseId").value:null,
            course_title:q("registrationCourseTitle")?q("registrationCourseTitle").value:"",
            student_full_name:pick(registrationData,["الاسم","name","Name"])||Object.values(registrationData)[0]||"",
            academic_number:pick(registrationData,["أكاديمي","اكاديمي","academic","الرقم الجامعي"])||"",
            registration_data:registrationData
          };
          try{
            var response=await fetch("/api/course-registration",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
            var result=await response.json().catch(function(){return {}});
            if(!response.ok)throw new Error(result.error||"تعذر إرسال طلب التسجيل");
            alert("تم إرسال طلب التسجيل بنجاح");
            window.closeCourseRegModal();
            form.reset();
          }catch(error){
            alert(error.message||"تعذر إرسال طلب التسجيل");
          }
        });
      },0);
    })();
  </script>

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
  
<script id="course-page-buttons-safe-fix">
(function(){
  function q(id){return document.getElementById(id)}
  function safe(v){return String(v||"")}
  function defaultFields(){
    return [
      {label:"الاسم الكامل",type:"text",required:true,placeholder:"اكتب اسمك الرباعي"},
      {label:"الرقم الأكاديمي",type:"text",required:true,placeholder:"مثال: 202412345"}
    ];
  }
  function parseFields(value){
    if(!value)return [];
    try{
      var parsed=JSON.parse(decodeURIComponent(value));
      return Array.isArray(parsed)?parsed:[];
    }catch(e){
      try{
        var parsed2=JSON.parse(value);
        return Array.isArray(parsed2)?parsed2:[];
      }catch(_){return []}
    }
  }
  function fieldKey(label,index){
    return "field_"+index+"_"+String(label||"").replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,32);
  }
  function splitOptions(value){
    return String(value||"").replace(/\r/g,"").split(/\n|,|،/).map(function(x){return x.trim()}).filter(Boolean);
  }
  function renderFields(fields){
    var box=q("dynamicCourseFields");
    if(!box)return;
    var finalList=(Array.isArray(fields)&&fields.length)?fields:defaultFields();
    box.innerHTML=finalList.map(function(field,index){
      var label=safe(field.label||("حقل "+(index+1)));
      var type=field.type||"text";
      var required=field.required?"required":"";
      var placeholder=safe(field.placeholder||"");
      var name=fieldKey(label,index);
      if(type==="textarea"){
        return '<div class="field full"><label><i class="fa-solid fa-pen-to-square"></i> '+label+'</label><textarea name="'+name+'" data-label="'+label+'" placeholder="'+placeholder+'" '+required+'></textarea></div>';
      }
      if(type==="select"){
        var options=splitOptions(field.options);
        return '<div class="field full"><label><i class="fa-solid fa-list"></i> '+label+'</label><select name="'+name+'" data-label="'+label+'" '+required+'><option value="">اختر...</option>'+options.map(function(opt){return '<option value="'+safe(opt)+'">'+safe(opt)+'</option>'}).join("")+'</select></div>';
      }
      var htmlType=["text","number","tel","email","date"].includes(type)?type:"text";
      var icon=htmlType==="tel"?"fa-phone":htmlType==="email"?"fa-envelope":htmlType==="number"?"fa-hashtag":htmlType==="date"?"fa-calendar-days":"fa-user";
      return '<div class="field full"><label><i class="fa-solid '+icon+'"></i> '+label+'</label><input name="'+name+'" data-label="'+label+'" placeholder="'+placeholder+'" '+required+' type="'+htmlType+'" /></div>';
    }).join("");
  }
  function openModal(btn){
    var modal=q("courseModal");
    if(!modal)return;
    if(q("registrationCourseId"))q("registrationCourseId").value=btn.getAttribute("data-course-id")||"";
    if(q("registrationCourseTitle"))q("registrationCourseTitle").value=btn.getAttribute("data-course-title")||"";
    if(q("modalCourseName"))q("modalCourseName").textContent="الدورة: "+(btn.getAttribute("data-course-title")||"دورة");
    renderFields(parseFields(btn.getAttribute("data-registration-fields")||"[]"));
    modal.classList.add("show");
    document.body.style.overflow="hidden";
  }
  function closeModal(){
    var modal=q("courseModal");
    if(modal)modal.classList.remove("show");
    document.body.style.overflow="";
  }
  function getRegData(){
    var data={};
    document.querySelectorAll("#dynamicCourseFields input,#dynamicCourseFields textarea,#dynamicCourseFields select").forEach(function(input){
      data[input.dataset.label||input.name]=input.value||"";
    });
    return data;
  }
  function pick(data,keys){
    var entries=Object.entries(data||{});
    var found=entries.find(function(pair){return keys.some(function(k){return String(pair[0]).includes(k)})});
    return found?found[1]:"";
  }
  document.addEventListener("click",function(e){
    var more=e.target.closest&&e.target.closest(".more-btn");
    if(more){
      var card=more.closest(".course-card");
      var box=card&&card.querySelector(".course-more-box");
      if(box){
        box.classList.toggle("show");
        more.innerHTML=box.classList.contains("show")?'<i class="fa-solid fa-chevron-up"></i> إخفاء المعلومات':'<i class="fa-solid fa-circle-info"></i> المزيد';
      }
    }
    var action=e.target.closest&&e.target.closest(".action-btn");
    if(action){openModal(action)}
    if(e.target&&e.target.id==="closeCourseModal")closeModal();
    if(e.target&&e.target.id==="cancelCourseModal")closeModal();
    if(e.target&&e.target.id==="courseModal")closeModal();
  });
  setTimeout(function(){
    var form=q("courseRegistrationForm");
    if(!form||form.dataset.safeBound)return;
    form.dataset.safeBound="1";
    form.addEventListener("submit",async function(e){
      e.preventDefault();
      var data=getRegData();
      var payload={
        course_id:q("registrationCourseId")?q("registrationCourseId").value:null,
        course_title:q("registrationCourseTitle")?q("registrationCourseTitle").value:"",
        student_full_name:pick(data,["الاسم","name","Name"])||Object.values(data)[0]||"",
        academic_number:pick(data,["أكاديمي","اكاديمي","academic","الرقم الجامعي"])||"",
        registration_data:data
      };
      try{
        var response=await fetch("/api/course-registration",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        var result=await response.json().catch(function(){return {}});
        if(!response.ok)throw new Error(result.error||"تعذر إرسال طلب التسجيل");
        alert("تم إرسال طلب التسجيل بنجاح");
        closeModal();
        form.reset();
      }catch(error){
        alert(error.message||"تعذر إرسال طلب التسجيل");
      }
    });
  },0);
})();
</script>

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
    function renderDynamicCourseFields(fields){const box=q("dynamicCourseFields");if(!box)return;const list=normalizeCourseRegFields(fields);const finalList=list.length?list:defaultCourseRegFields();box.innerHTML=finalList.map((field,index)=>{const label=safeText(field.label||("حقل "+(index+1))),type=field.type||"text",req=field.required?"required":"",ph=safeText(field.placeholder||""),name=fieldKey(label,index);if(type==="textarea")return '<div class="field full"><label><i class="fa-solid fa-pen-to-square"></i> '+label+'</label><textarea name="'+name+'" data-label="'+label+'" placeholder="'+ph+'" '+req+'></textarea></div>';if(type==="select"){const opts=String(field.options||"").split(/,|،|\\n/).map(x=>x.trim()).filter(Boolean);return '<div class="field full"><label><i class="fa-solid fa-list"></i> '+label+'</label><select name="'+name+'" data-label="'+label+'" '+req+'><option value="">اختر...</option>'+opts.map(o=>'<option value="'+safeText(o)+'">'+safeText(o)+'</option>').join("")+'</select></div>'}const htmlType=["text","number","tel","email","date"].includes(type)?type:"text";return '<div class="field full"><label><i class="fa-solid fa-user"></i> '+label+'</label><input name="'+name+'" data-label="'+label+'" placeholder="'+ph+'" '+req+' type="'+htmlType+'" /></div>'}).join("")}
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
    function closeCourseModal(){if(q("courseModal"))q("courseModal").classList.remove("show");document.body.style.overflow=""}
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
    if(regForm&&!regForm.dataset.bound){
      regForm.dataset.bound="1";
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
    function normalizeScientificCollegeSeo(college,specialization,title){
      const text=String((college||"")+" "+(specialization||"")+" "+(title||""));
      if(/أسنان|اسنان|Dental/i.test(text))return "كلية طب الأسنان";
      if(/طب|Medicine|صيدلة|Pharmacy|مختبر|Laboratory|تمريض|Nursing|تغذية|Nutrition|علاج طبيعي|Physical/i.test(text))return "كلية الطب والعلوم الصحية";
      if(/أمن سيبراني|امن سيبراني|حاسبات|تقنية معلومات|نظم معلومات|ذكاء اصطناعي|برمجة|جرافيكس|حاسوب|IT|Cyber|AI|Computer/i.test(text))return "كلية الحاسبات وتقنية المعلومات";
      if(/هندسة|مدني|معمار|ميكاترونكس|شبكات|CCNA|NDG|Primavera|Engineering/i.test(text))return "كلية الهندسة";
      if(/إدارة|ادارة|أعمال|اعمال|تسويق|محاسبة|مالية|اقتصاد|موارد|Business|Marketing|Accounting|Finance/i.test(text))return "كلية العلوم الإدارية والإنسانية";
      return college || "أخرى";
    }
    function iconForCollegeSeo(name){
      const text=String(name||"");
      if(text.includes("الطب"))return "fa-solid fa-stethoscope";
      if(text.includes("الأسنان"))return "fa-solid fa-tooth";
      if(text.includes("الحاسبات"))return "fa-solid fa-laptop-code";
      if(text.includes("الهندسة"))return "fa-solid fa-helmet-safety";
      if(text.includes("الإدارية"))return "fa-solid fa-briefcase";
      return "fa-solid fa-building-columns";
    }

    function normalizeScientificSpecializationSeo(rawSpecialization,college,title,isAllLevels){
      const raw=String(rawSpecialization||"").trim();
      const text=String((rawSpecialization||"")+" "+(college||"")+" "+(title||""));
      const collegeText=String(college||"");
      const rawLooksBad=!raw || raw===collegeText || /جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات|^عام$|^أخرى$|^كلية/i.test(raw);

      if(/أسنان|اسنان|Dental/i.test(text))return "طب الأسنان";
      if(/صيدلة|Pharmacy/i.test(text))return "صيدلة";
      if(/مختبر|Laboratory/i.test(text))return "مختبرات طبية";
      if(/تمريض|Nursing/i.test(text))return "تمريض";
      if(/تغذية|Nutrition/i.test(text))return "تغذية علاجية";
      if(/علاج طبيعي|Physical/i.test(text))return "علاج طبيعي";
      if(/طب بشري|بشري|Medicine/i.test(text))return "طب بشري";
      if(collegeText.includes("الطب") && rawLooksBad)return "قنوات عامة للكلية";

      if(/أمن سيبراني|امن سيبراني|Cyber/i.test(text))return "أمن سيبراني";
      if(/ذكاء اصطناعي|Artificial|AI/i.test(text))return "ذكاء اصطناعي";
      if(/نظم المعلومات|نظم معلومات/i.test(text))return "نظم المعلومات";
      if(/تقنية المعلومات|تقنية معلومات|Information Technology|IT/i.test(text))return "تقنية المعلومات";
      if(/جرافيكس|تصميم|Graphics/i.test(text))return "جرافيكس وتصميم";
      if(/حاسوب|برمجة|Computer|Software/i.test(text))return "علوم الحاسوب والبرمجة";
      if(collegeText.includes("الحاسبات") && rawLooksBad)return "قنوات عامة للكلية";

      if(/مدني|Civil/i.test(text))return "هندسة مدنية";
      if(/معمار|Architecture/i.test(text))return "هندسة معمارية";
      if(/ميكاترونكس|Mechatronics/i.test(text))return "ميكاترونكس";
      if(/شبكات|CCNA|NDG/i.test(text))return "شبكات";
      if(/هندسة|Engineering/i.test(text))return rawLooksBad ? "هندسة عامة" : raw;
      if(collegeText.includes("الهندسة") && rawLooksBad)return "هندسة عامة";

      if(/إدارة أعمال دولية|ادارة اعمال دولية|International Business/i.test(text))return "إدارة أعمال دولية";
      if(/تسويق رقمي|Digital Marketing/i.test(text))return "تسويق رقمي";
      if(/محاسبة|Accounting/i.test(text))return "محاسبة";
      if(/مالية|Finance/i.test(text))return "مالية ومصرفية";
      if(/إدارة أعمال|ادارة اعمال|Business Administration/i.test(text))return "إدارة أعمال";
      if(/إدارة|ادارة|علوم إدارية|علوم ادارية/i.test(text))return rawLooksBad ? "العلوم الإدارية" : raw;
      if(collegeText.includes("الإدارية") && rawLooksBad)return "العلوم الإدارية";

      if(!rawLooksBad)return raw;
      return "قنوات عامة للكلية";
    }
    function iconForSpecializationSeo(name,college){
      const text=String((name||"")+" "+(college||""));
      if(/أسنان|اسنان/i.test(text))return "fa-solid fa-tooth";
      if(/صيدلة/i.test(text))return "fa-solid fa-pills";
      if(/مختبر/i.test(text))return "fa-solid fa-flask-vial";
      if(/تمريض/i.test(text))return "fa-solid fa-user-nurse";
      if(/تغذية/i.test(text))return "fa-solid fa-apple-whole";
      if(/علاج طبيعي/i.test(text))return "fa-solid fa-person-walking";
      if(/طب/i.test(text))return "fa-solid fa-stethoscope";
      if(/أمن سيبراني|امن سيبراني/i.test(text))return "fa-solid fa-shield-halved";
      if(/ذكاء اصطناعي/i.test(text))return "fa-solid fa-brain";
      if(/نظم المعلومات/i.test(text))return "fa-solid fa-database";
      if(/تقنية المعلومات/i.test(text))return "fa-solid fa-network-wired";
      if(/جرافيكس|تصميم/i.test(text))return "fa-solid fa-palette";
      if(/حاسوب|برمجة/i.test(text))return "fa-solid fa-laptop-code";
      if(/مدني|معمار|ميكاترونكس|هندسة|شبكات/i.test(text))return "fa-solid fa-helmet-safety";
      if(/محاسبة/i.test(text))return "fa-solid fa-calculator";
      if(/تسويق/i.test(text))return "fa-solid fa-bullhorn";
      if(/مالية/i.test(text))return "fa-solid fa-chart-line";
      if(/إدارة|ادارة|أعمال|اعمال/i.test(text))return "fa-solid fa-briefcase";
      return iconForCollegeSeo(college);
    }

    function parseScientificMetaSeo(link){
      const desc=String(link.description||"");
      const fromDesc=(label)=>{
        const match=desc.match(new RegExp(label+"\\s*[:：]\\s*([^|\\n]+)","i"));
        return match?match[1].trim():"";
      };
      const rawCollege = link.college || fromDesc("الكلية") || "";
      const rawSpecialization = link.specialization || fromDesc("التخصص") || rawCollege || "عام";
      const savedCollege = String(rawCollege||"").trim();
      const college = (savedCollege && savedCollege !== "أخرى")
        ? savedCollege
        : normalizeScientificCollegeSeo(rawCollege, rawSpecialization, link.title);
      const level = link.level || fromDesc("المستوى") || link.stage || "عام";
      const generalText = (rawSpecialization + " " + level + " " + desc);
      const isAllLevels = /جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات/i.test(generalText);
      const displaySpecialization = normalizeScientificSpecializationSeo(rawSpecialization,college,link.title,isAllLevels);
      return {
        college,
        college_icon: iconForCollegeSeo(college),
        specialization: displaySpecialization,
        original_specialization: rawSpecialization,
        specialization_icon: iconClass(link.specialization_icon || link.spec_icon || link.specialty_icon || "", iconForSpecializationSeo(displaySpecialization,college)),
        level: isAllLevels ? "جميع المستويات" : level,
        is_all_levels: isAllLevels,
        title: link.title || "قناة علمية",
        url: link.url || "#",
        icon: iconClass(link.icon,"fa-brands fa-telegram"),
        description: link.description || ""
      };
    }
    function groupByValueSeo(items,key){
      const map=new Map();
      items.forEach(item=>{const value=item[key]||"أخرى";if(!map.has(value))map.set(value,[]);map.get(value).push(item);});
      return Array.from(map.entries()).map(([name,items])=>({name,items}));
    }
    function scientificSafeKeySeo(value,index){
      return "spec_"+index+"_"+String(value||"").replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
    }
    function makeScientificGroupKeySeo(collegeName,specializationName,collegeIndex,specIndex){
      return scientificSafeKeySeo(collegeName+"_"+specializationName,collegeIndex+"_"+specIndex);
    }
    function renderScientificChannelCardsSeo(items){
      return '<div class="scientific-channel-grid">'+items.map(link=>{
        return '<article class="scientific-channel-card"><div class="scientific-channel-icon"><i class="'+link.icon+'"></i></div><div><h4>'+safeText(link.title)+'</h4><div class="scientific-channel-meta"><span class="scientific-chip"><i class="fa-solid fa-building-columns"></i> '+safeText(link.college)+'</span><span class="scientific-chip"><i class="fa-solid fa-layer-group"></i> '+safeText(link.level)+'</span></div></div><a class="btn btn-dark" href="'+safeText(link.url)+'" '+(String(link.url).startsWith("http")?'target="_blank" rel="noopener"':'')+'><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح القناة</a></article>';
      }).join("")+'</div>';
    }
    function buildCollegeSpecialtyGroupsSeo(items){
      const colleges=groupByValueSeo(items,"college");
      const entries=[];
      colleges.forEach((college,collegeIndex)=>{
        const collegeKey=scientificSafeKeySeo(college.name,collegeIndex);
        const specs=groupByValueSeo(college.items,"specialization");
        specs.forEach((spec,specIndex)=>{
          const key=makeScientificGroupKeySeo(college.name,spec.name,collegeIndex,specIndex);
          entries.push({key,collegeKey,collegeName:college.name,specName:spec.name,items:spec.items,collegeIndex,specIndex});
        });
      });
      return {colleges,entries};
    }
    function isFeaturedCommitteeLinkSeo(link){
      return Boolean(link?.is_featured || link?.show_on_top || link?.featured || Number(link?.sort_order) < 0);
    }
    function renderFeaturedCommitteeLinksSeo(links){
      const featured=(links||[]).filter(isFeaturedCommitteeLinkSeo);
      if(!featured.length)return "";
      return '<div class="scientific-featured-list">'+featured.map(link=>{
        const url=link.url||"#";
        return '<article class="scientific-central-card">'+
          '<div class="scientific-central-icon"><i class="'+iconClass(link.icon,"fa-solid fa-star")+'"></i></div>'+
          '<div>'+
            '<h3>'+safeText(link.title||"رابط مهم")+'</h3>'+
            '<p>'+safeText(link.description||"رابط بارز من روابط اللجنة يظهر في واجهة القسم ويمكن تعديله من لوحة التحكم.")+'</p>'+
          '</div>'+
          '<a class="btn btn-dark" href="'+safeText(url)+'" '+(String(url).startsWith("http")?'target="_blank" rel="noopener"':'')+'>'+
            '<i class="fa-solid fa-arrow-up-right-from-square"></i> فتح الرابط'+
          '</a>'+
        '</article>';
      }).join("")+'</div>';
    }
    function renderScientificLinksSeo(data){
      const featuredLinks=data.filter(isFeaturedCommitteeLinkSeo);
      const items=data.filter(link=>!isFeaturedCommitteeLinkSeo(link)).map(parseScientificMetaSeo);
      const grouped=buildCollegeSpecialtyGroupsSeo(items);
      const colleges=grouped.colleges;
      const entries=grouped.entries;
      if(!entries.length){
        return '<div class="scientific-links-wrap">'+
          renderFeaturedCommitteeLinksSeo(featuredLinks)+
          '<div class="links-empty">لا توجد روابط تخصصية مضافة حاليًا.</div>'+
        '</div>';
      }
      const firstCollege=colleges[0];
      const firstEntry=entries.find(entry=>entry.collegeName===firstCollege?.name)||entries[0];
      const firstCollegeIcon=firstCollege?.items?.[0]?.college_icon||"fa-solid fa-building-columns";
      const firstSpecIcon=firstEntry?.items?.[0]?.specialization_icon||"fa-solid fa-graduation-cap";

      return '<div class="scientific-links-wrap">'+
        renderFeaturedCommitteeLinksSeo(featuredLinks)+
        
        '<div class="scientific-picker-row">'+
          '<div><span class="scientific-step-label"><b>1</b> الكلية</span><div class="scientific-picker" id="scientificCollegePicker">'+
            '<button class="scientific-picker-trigger" type="button" id="scientificCollegeTrigger"><div class="scientific-picker-main"><i class="'+firstCollegeIcon+'" id="scientificCollegeIcon"></i><div><span id="scientificCollegeLabel">اختر الكلية</span><small id="scientificCollegeCount">حدد الكلية أولًا</small></div></div><span class="scientific-picker-arrow"><i class="fa-solid fa-chevron-down"></i></span></button>'+
            '<div class="scientific-specialty-pop" id="scientificCollegePop"><div class="sheet-handle"></div><div class="scientific-pop-title"><i class="fa-solid fa-building-columns"></i> اختر الكلية</div><div class="scientific-pop-grid">'+colleges.map((college,index)=>{
              const icon=college.items[0]?.college_icon||"fa-solid fa-building-columns";
              const key=scientificSafeKeySeo(college.name,index);
              const specsCount=groupByValueSeo(college.items,"specialization").length;
              return '<button class="scientific-spec-option" type="button" data-scientific-college="'+key+'" data-label="'+safeText(college.name)+'" data-icon="'+icon+'" data-count="'+college.items.length+'"><i class="'+icon+'"></i><span><b class="scientific-spec-name">'+safeText(college.name)+'</b><small>'+specsCount+' تخصص | '+college.items.length+' قناة</small></span></button>';
            }).join("")+'</div></div>'+
          '</div></div>'+
          '<div><span class="scientific-step-label"><b>2</b> التخصص</span><div class="scientific-picker" id="scientificPicker">'+
            '<button class="scientific-picker-trigger" type="button" id="scientificPickerTrigger"><div class="scientific-picker-main"><i class="'+firstSpecIcon+'" id="scientificPickerIcon"></i><div><span id="scientificPickerLabel">اختر التخصص</span><small id="scientificPickerCount">اختر الكلية أولًا</small></div></div><span class="scientific-picker-arrow"><i class="fa-solid fa-chevron-down"></i></span></button>'+
            '<div class="scientific-specialty-pop" id="scientificSpecialtyPop"><div class="sheet-handle"></div><div class="scientific-pop-title"><i class="fa-solid fa-layer-group"></i> اختر التخصص</div><div class="scientific-pop-grid">'+entries.map((entry,index)=>{
              const icon=entry.items[0]?.specialization_icon||"fa-solid fa-graduation-cap";
              return '<button class="scientific-spec-option is-hidden" type="button" data-scientific-tab="'+entry.key+'" data-college-key="'+entry.collegeKey+'" data-label="'+safeText(entry.specName)+'" data-icon="'+icon+'" data-count="'+entry.items.length+'"><i class="'+icon+'"></i><span><b class="scientific-spec-name">'+safeText(entry.specName)+'</b><small>'+entry.items.length+' قناة</small></span></button>';
            }).join("")+'</div></div>'+
          '</div></div>'+
        '</div>'+
        '<div class="scientific-panels">'+entries.map((entry,index)=>{
          const icon=entry.items[0]?.specialization_icon||"fa-solid fa-graduation-cap";
          return '<section class="scientific-spec-panel" data-scientific-panel="'+entry.key+'"><div class="scientific-selected-title"><i class="'+icon+'"></i> '+safeText(entry.specName)+'</div>'+renderScientificChannelCardsSeo(entry.items)+'</section>';
        }).join("")+'</div></div>';
    }
    function bindScientificTabsSeo(){
      const root=q("committeeLinksList");
      if(!root)return;

      const collegePicker=root.querySelector("#scientificCollegePicker");
      const collegeTrigger=root.querySelector("#scientificCollegeTrigger");
      const collegePop=root.querySelector("#scientificCollegePop");
      const collegeLabel=root.querySelector("#scientificCollegeLabel");
      const collegeCount=root.querySelector("#scientificCollegeCount");
      const collegeIcon=root.querySelector("#scientificCollegeIcon");

      const picker=root.querySelector("#scientificPicker");
      const trigger=root.querySelector("#scientificPickerTrigger");
      const pop=root.querySelector("#scientificSpecialtyPop");
      const specialtyGrid=pop?pop.querySelector(".scientific-pop-grid"):null;
      const label=root.querySelector("#scientificPickerLabel");
      const count=root.querySelector("#scientificPickerCount");
      const iconBox=root.querySelector("#scientificPickerIcon");

      let overlay=null;
      let activePop=null;
      let activePicker=null;

      const allSpecialtyOptions=specialtyGrid
        ? Array.from(specialtyGrid.querySelectorAll(".scientific-spec-option[data-scientific-tab]")).map(btn=>({
            collegeKey:btn.dataset.collegeKey||"",
            tabKey:btn.dataset.scientificTab||"",
            label:btn.dataset.label||"التخصص",
            icon:btn.dataset.icon||"fa-solid fa-graduation-cap",
            count:btn.dataset.count||"0"
          }))
        : [];

      if(specialtyGrid)specialtyGrid.innerHTML="";

      const firstCollegeOption=root.querySelector(".scientific-spec-option[data-scientific-college]");
      let currentCollegeKey="";
      let currentSpecialtyKey="";

      function cleanText(value){
        return String(value||"").replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
      }

      function specialtyButtonHtml(item){
        return '<button class="scientific-spec-option" type="button" data-scientific-tab="'+cleanText(item.tabKey)+'" data-college-key="'+cleanText(item.collegeKey)+'" data-label="'+cleanText(item.label)+'" data-icon="'+cleanText(item.icon)+'" data-count="'+cleanText(item.count)+'">'+
          '<i class="'+cleanText(item.icon)+'"></i>'+
          '<span><b class="scientific-spec-name">'+cleanText(item.label)+'</b><small>'+cleanText(item.count)+' قناة</small></span>'+
        '</button>';
      }

      function openScientificPop(pickerEl,popEl){
        if(!pickerEl||!popEl)return;
        closeScientificPop(false);
        if(popEl===pop)renderSpecialtyOptionsForCollege(currentCollegeKey,false);
        overlay=document.createElement("div");
        overlay.className="scientific-specialty-overlay show";
        document.body.appendChild(overlay);
        overlay.appendChild(popEl);
        activePop=popEl;
        activePicker=pickerEl;
        pickerEl.classList.add("open");
        document.body.style.overflow="hidden";
        overlay.onclick=(e)=>{if(e.target===overlay)closeScientificPop(true)};
      }

      function closeScientificPop(restore=true){
        if(activePicker)activePicker.classList.remove("open");
        if(overlay&&activePop&&activePicker){
          activePicker.appendChild(activePop);
          overlay.remove();
        }
        overlay=null;activePop=null;activePicker=null;
        if(restore)document.body.style.overflow="hidden";
      }

      function activateSpecialty(option){
        if(!option)return;
        const key=option.dataset.scientificTab;
        currentSpecialtyKey=key;

        document.querySelectorAll(".scientific-spec-option[data-scientific-tab]").forEach(t=>t.classList.remove("active"));
        root.querySelectorAll(".scientific-spec-panel").forEach(p=>p.classList.remove("active"));

        option.classList.add("active");

        if(label)label.textContent=option.dataset.label||"التخصص";
        if(count)count.textContent=(option.dataset.count||"0")+" قناة متاحة";
        if(iconBox)iconBox.className=option.dataset.icon||"fa-solid fa-graduation-cap";

        const safeKey = window.CSS&&CSS.escape ? CSS.escape(key) : key;
        const panel=root.querySelector('[data-scientific-panel="'+safeKey+'"]');
        if(panel)panel.classList.add("active");
      }

      function bindSpecialtyOptions(){
        if(!specialtyGrid)return;
        specialtyGrid.querySelectorAll(".scientific-spec-option[data-scientific-tab]").forEach(option=>{
          option.onclick=(e)=>{
            e.stopPropagation();
            activateSpecialty(option);
            closeScientificPop(true);
          };
        });
      }

      function renderSpecialtyOptionsForCollege(collegeKey,activateFirst=false){
        if(!specialtyGrid)return;
        const filtered=allSpecialtyOptions.filter(item=>item.collegeKey===collegeKey);
        specialtyGrid.innerHTML=filtered.length
          ? filtered.map(specialtyButtonHtml).join("")
          : '<div class="links-empty">لا توجد تخصصات لهذه الكلية حاليًا.</div>';

        bindSpecialtyOptions();

        root.querySelectorAll(".scientific-spec-panel").forEach(p=>p.classList.remove("active"));

        const first=specialtyGrid.querySelector(".scientific-spec-option[data-scientific-tab]");
        if(first&&activateFirst){
          activateSpecialty(first);
        }else if(first){
          if(label)label.textContent="اختر التخصص";
          if(count)count.textContent=filtered.length+" تخصص متاح";
          if(iconBox)iconBox.className="fa-solid fa-layer-group";
        }else{
          if(label)label.textContent="لا توجد تخصصات";
          if(count)count.textContent="0 قناة";
          if(iconBox)iconBox.className="fa-solid fa-circle-info";
        }
      }

      function selectCollege(option){
        if(!option)return;
        currentCollegeKey=option.dataset.scientificCollege||"";

        document.querySelectorAll(".scientific-spec-option[data-scientific-college]").forEach(t=>t.classList.remove("active"));
        option.classList.add("active");

        if(collegeLabel)collegeLabel.textContent=option.dataset.label||"الكلية";
        if(collegeCount)collegeCount.textContent=(option.dataset.count||"0")+" قناة";
        if(collegeIcon)collegeIcon.className=option.dataset.icon||"fa-solid fa-building-columns";

        currentSpecialtyKey="";
        renderSpecialtyOptionsForCollege(currentCollegeKey,false);
      }

      if(collegeTrigger&&collegePicker&&collegePop){
        collegeTrigger.onclick=(e)=>{e.stopPropagation();openScientificPop(collegePicker,collegePop)};
      }
      if(trigger&&picker&&pop){
        trigger.onclick=(e)=>{
          e.stopPropagation();
          if(!currentCollegeKey && firstCollegeOption){
            if(label)label.textContent="اختر التخصص";
            if(count)count.textContent="اختر الكلية أولًا";
          }
          openScientificPop(picker,pop);
        };
      }

      document.querySelectorAll(".scientific-spec-option[data-scientific-college]").forEach(option=>{
        option.onclick=(e)=>{
          e.stopPropagation();
          selectCollege(option);
          closeScientificPop(true);
        };
      });

      if(label)label.textContent="اختر التخصص";
      if(count)count.textContent="اختر الكلية أولًا";
      if(collegeLabel)collegeLabel.textContent="اختر الكلية";
      if(collegeCount)collegeCount.textContent="حدد الكلية أولًا";
    }
    function isScientificSeo(title,data){
      const name=String(title||"");
      return name.includes("العلمية") || name.includes("العلمي") || data.some(link=>link.college||link.specialization||link.level||String(link.description||"").includes("الكلية:"));
    }
    document.querySelectorAll(".committee-links-btn").forEach(btn=>{
      btn.onclick=()=>{
        q("linksSheetIcon").innerHTML='<i class="'+(btn.dataset.icon||"fa-solid fa-link")+'"></i>';
        q("linksSheetTitle").textContent="روابط "+(btn.dataset.title||"اللجنة");
        if(isScientificSeo(btn.dataset.title,committeeLinks)){
          q("committeeLinksList").innerHTML=committeeLinks.length?renderScientificLinksSeo(committeeLinks):'<div class="links-empty">لا توجد روابط مضافة لهذه اللجنة حاليًا.</div>'; if(committeeLinks.length)bindScientificTabsSeo();
        }else{
          q("committeeLinksList").innerHTML=committeeLinks.length?committeeLinks.map(link=>{
            const url=link.url||"#";
            return '<article class="committee-link-card"><div class="committee-link-icon"><i class="'+iconClass(link.icon,"fa-solid fa-link")+'"></i></div><div><h4>'+safeText(link.title)+'</h4><p>'+safeText(link.description||"رابط خاص بهذه اللجنة.")+'</p></div><a class="btn btn-dark" href="'+url+'" '+(url.startsWith("http")?'target="_blank" rel="noopener"':'')+'><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح</a></article>';
          }).join(""):'<div class="links-empty">لا توجد روابط مضافة لهذه اللجنة حاليًا.</div>';
        }
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
