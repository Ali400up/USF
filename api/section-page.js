// api/section-page.js
// صفحات الأقسام هنا مصممة كأنها "نفس قسم الصفحة الرئيسية مقصوص وحده"
// الأخبار = نفس شاشة التلفاز.
// الدورات = نفس كروت الدورات والفلاتر.
// الأنشطة = نفس كروت الأنشطة.
// اللجان = نفس كروت اللجان.
// الإنجازات = نفس كروت الإنجازات.
// الفعاليات = نفس الـ Timeline.

const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, imageOf,
  responseHeaders, supabaseSelect, htmlLayout, errorPage
} = require("./_seo-utils");

const SECTION_COPY = {
  news: {
    id: "latest-news",
    kicker: "آخر الأخبار",
    title: "نشرة أخبار الملتقى بطريقة تلفزيونية حديثة",
    desc: "شاشة أخبار مدمجة تعرض الصورة كاملة مع شريط موجز داخل إطار التلفاز."
  },
  activities: {
    id: "activities",
    kicker: "الأنشطة",
    title: "أنشطة الملتقى وبرامجه",
    desc: "مساحة لعرض أحدث الأنشطة والبرامج الطلابية، مع تفاصيل كل نشاط وصوره."
  },
  courses: {
    id: "courses",
    kicker: "تسجيل الدورات",
    title: "الدورات والبرامج التدريبية",
    desc: "استعرض الدورات المتاحة، اقرأ تفاصيل كل دورة، ثم سجّل بياناتك بسهولة عند فتح التسجيل."
  },
  committees: {
    id: "committees",
    kicker: "لجان ملتقى الطالب الجامعي",
    title: "اللجان الرئيسية التي يتعامل معها الطالب مباشرة",
    desc: "يتكون ملتقى الطالب الجامعي من عدد من اللجان الرئيسية التي تعمل بشكل منظم لخدمة الطالب الجامعي، وتغطي الجوانب العلمية، التدريبية، الإعلامية، والأنشطة الطلابية، إضافة إلى متابعة قضايا الطلاب ومقترحاتهم."
  },
  achievements: {
    id: "achievements",
    kicker: "إنجازات الملتقى",
    title: "أثر الملتقى وإنجازاته",
    desc: "أرقام مختصرة تعكس حضور الملتقى وأنشطته وخدماته للطلاب."
  },
  events: {
    id: "timeline",
    kicker: "Timeline",
    title: "المواعيد القادمة",
    desc: "تابع أهم المواعيد والفعاليات القادمة للملتقى أولًا بأول."
  }
};

function safeIcon(value, fallback) {
  return value && String(value).startsWith("fa-") ? value : fallback;
}

function dateText(value) {
  if (!value) return "قريبًا";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  try {
    return new Intl.DateTimeFormat("ar", { day: "2-digit", month: "long" }).format(date);
  } catch (_) {
    return escapeHtml(value);
  }
}

function renderSectionHeader(sectionKey, section) {
  const copy = SECTION_COPY[sectionKey] || {
    id: sectionKey,
    kicker: section.label,
    title: section.label,
    desc: section.description
  };

  return `<div class="section-header reveal show">
    <div>
      <div class="section-kicker">${escapeHtml(copy.kicker)}</div>
      <h2 class="section-title">${escapeHtml(copy.title)}</h2>
    </div>
    <p class="section-desc">${escapeHtml(copy.desc)}</p>
  </div>`;
}

function renderNewsTv(section, rows) {
  const items = rows.map(row => ({
    id: row.id,
    category: row.category || "خبر",
    title: titleOf(row, section),
    description: textOf(row, section),
    ticker: row.ticker || titleOf(row, section) || "خبر جديد من ملتقى الطالب الجامعي",
    image: imageOf(row),
    icon: safeIcon(row.icon, section.icon)
  }));

  const first = items[0];

  if (!first) {
    return `<section id="latest-news" style="padding-top:122px">
      <div class="container">
        ${renderSectionHeader("news", section)}
        <div class="news-studio reveal show delay-1">
          <div class="news-tv">
            <div class="news-screen">
              <div class="news-media">
                <div class="news-shine"></div>
                <div class="news-live"><i class="fa-solid fa-circle"></i> آخر الأخبار</div>
              </div>
              <div class="news-frame-ticker"><span>لا توجد أخبار مضافة من قاعدة البيانات حاليًا.</span></div>
              <div class="news-caption">
                <div class="news-category"><i class="fa-solid fa-database"></i> قاعدة البيانات</div>
                <h3>لا توجد أخبار لعرضها</h3>
                <p>أضف خبرًا من لوحة التحكم واجعل خيار الظهور في الموقع مفعّلًا.</p>
              </div>
            </div>
            <div class="news-control-panel">
              <div class="news-progress" title="مدة عرض الخبر"><span></span></div>
              <div class="news-dots"></div>
              <a class="news-brief-btn" href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
            </div>
            <div class="tv-stand"></div>
          </div>
        </div>
      </div>
    </section>`;
  }

  const dots = items.map((item, index) => {
    const active = index === 0 ? "active" : "";
    return `<a class="news-dot ${active}" href="/news/${encodeURIComponent(item.id)}" aria-label="خبر ${index + 1}"></a>`;
  }).join("");

  const briefItems = items.map((item, index) => {
    const active = index === 0 ? "active" : "";
    const thumb = item.image
      ? `<img class="news-brief-thumb" src="${escapeAttr(item.image)}" alt="${escapeAttr(item.title)}" />`
      : `<span class="news-brief-thumb" style="display:grid;place-items:center;background:rgba(11,94,215,.10);color:var(--primary);"><i class="${escapeAttr(item.icon)}"></i></span>`;

    return `<a class="news-brief-item ${active}" href="/news/${encodeURIComponent(item.id)}">
      ${thumb}
      <span class="news-brief-content">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(truncate(item.description, 120))}</span>
      </span>
      <span class="news-brief-tag">${escapeHtml(item.category)}</span>
    </a>`;
  }).join("");

  return `<section id="latest-news" style="padding-top:122px">
    <div class="container">
      ${renderSectionHeader("news", section)}
      <div class="news-studio reveal show delay-1">
        <div class="news-tv" id="newsTv">
          <div class="news-screen">
            <div class="news-media">
              ${first.image ? `<a href="/news/${encodeURIComponent(first.id)}"><img alt="${escapeAttr(first.title)}" src="${escapeAttr(first.image)}" /></a>` : ""}
              <div class="news-shine"></div>
              <div class="news-live"><i class="fa-solid fa-circle"></i> آخر الأخبار</div>
            </div>
            <div class="news-frame-ticker"><span>${escapeHtml(first.ticker)}</span></div>
            <div class="news-caption">
              <div class="news-category"><i class="${escapeAttr(first.icon)}"></i> ${escapeHtml(first.category)}</div>
              <h3>${escapeHtml(first.title)}</h3>
              <p>${escapeHtml(first.description)}</p>
              <a class="news-read-more show" href="/news/${encodeURIComponent(first.id)}"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> عرض المزيد</a>
            </div>
          </div>
          <div class="news-control-panel">
            <div class="news-progress" title="مدة عرض الخبر"><span></span></div>
            <div class="news-dots">${dots}</div>
            <a class="news-brief-btn" href="#newsBriefListFull"><i class="fa-solid fa-list-ul"></i> موجز</a>
          </div>
          <div class="tv-stand"></div>
        </div>
      </div>

      <div class="news-brief-modal-box reveal show" id="newsBriefListFull" style="margin-top:22px">
        <div class="news-brief-head">
          <div class="news-brief-icon"><i class="fa-solid fa-newspaper"></i></div>
          <div>
            <h3>موجز الأخبار</h3>
            <p>اختر أي خبر لفتح صفحته الكاملة بنفس تصميم الموقع.</p>
          </div>
          <a class="news-brief-close" href="#latest-news"><i class="fa-solid fa-arrow-up"></i></a>
        </div>
        <div class="news-brief-list">${briefItems}</div>
      </div>
    </div>
  </section>`;
}

function renderActivityCard(sectionKey, section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const url = `${section.path}/${encodeURIComponent(row.id)}`;
  const meta = [];

  if (row.category) meta.push(`<span><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
  if (row.status) meta.push(`<span><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
  if (row.location) meta.push(`<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);
  if (row.activity_date || row.event_date) meta.push(`<span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(row.activity_date || row.event_date)}</span>`);

  return `<article class="activity-card reveal show">
    <div class="cover">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(safeIcon(row.icon, section.icon))}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      ${meta.length ? `<div class="activity-meta">${meta.join("")}</div>` : ""}
      <p>${escapeHtml(truncate(text, 190))}</p>
      <div class="activity-actions">
        <a class="btn btn-dark" href="${escapeAttr(url)}"><i class="fa-solid fa-arrow-left"></i> عرض التفاصيل</a>
      </div>
    </div>
  </article>`;
}

function renderCourseCard(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const url = `${section.path}/${encodeURIComponent(row.id)}`;
  const category = row.category || row.course_category || "برنامج تدريبي";
  const seatsTotal = Number(row.seats_total || row.capacity || 0);
  const seatsTaken = Number(row.seats_taken || row.registered_count || 0);
  const percent = seatsTotal > 0 ? Math.min(100, Math.max(0, Math.round((seatsTaken / seatsTotal) * 100))) : 0;

  return `<article class="course-card reveal show" data-category="${escapeAttr(category)}">
    <div class="cover">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(safeIcon(row.icon, section.icon))}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      <span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(category)}</span>
      <p>${escapeHtml(truncate(text, 180))}</p>
      ${seatsTotal > 0 ? `<div class="progress-block">
        <div class="progress-info"><span>المقاعد المسجلة</span><strong>${escapeHtml(seatsTaken)} / ${escapeHtml(seatsTotal)}</strong></div>
        <div class="progress"><span style="--width:${percent}%"></span></div>
      </div>` : ""}
      <div class="course-meta-line">
        <span><i class="fa-solid fa-circle-info"></i> ${escapeHtml(row.status || "متاحة")}</span>
        ${row.start_date ? `<span><i class="fa-solid fa-calendar"></i> ${escapeHtml(row.start_date)}</span>` : ""}
      </div>
      <div class="course-actions">
        <a class="btn btn-dark" href="${escapeAttr(url)}"><i class="fa-solid fa-arrow-left"></i> عرض التفاصيل</a>
      </div>
    </div>
  </article>`;
}

function renderCommitteeCard(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const url = `${section.path}/${encodeURIComponent(row.id)}`;

  const tasksText = row.tasks || row.responsibilities || row.description || "";
  let tasks = [];
  if (Array.isArray(tasksText)) tasks = tasksText;
  else if (typeof tasksText === "string") {
    try {
      const parsed = JSON.parse(tasksText);
      if (Array.isArray(parsed)) tasks = parsed;
    } catch (_) {
      tasks = tasksText.split(/\n|،|,/).map(x => x.trim()).filter(Boolean).slice(0, 3);
    }
  }

  return `<article class="committee-card reveal show">
    <div class="avatar"><i class="${escapeAttr(safeIcon(row.icon, section.icon))}"></i></div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(truncate(text, 150))}</p>
    ${tasks.length ? `<div class="committee-tasks">${tasks.slice(0,3).map(t => `<div class="committee-task"><i class="fa-solid fa-circle"></i> ${escapeHtml(t)}</div>`).join("")}</div>` : ""}
    <div class="committee-actions">
      <a class="btn btn-soft" href="${escapeAttr(url)}"><i class="fa-solid fa-circle-info"></i> عرض التفاصيل</a>
    </div>
  </article>`;
}

function renderAchievementCard(section, row) {
  const title = titleOf(row, section);
  return `<article class="achievement-card reveal show">
    <div class="achievement-icon"><i class="${escapeAttr(safeIcon(row.icon, section.icon))}"></i></div>
    <div class="achievement-number">${escapeHtml(row.value || row.number || "—")}</div>
    <p>${escapeHtml(title)}</p>
  </article>`;
}

function renderEventCard(section, row) {
  const title = titleOf(row, section);
  const text = row.location || textOf(row, section) || section.description;
  const url = `${section.path}/${encodeURIComponent(row.id)}`;

  return `<article class="timeline-card reveal show">
    <div class="date-box">${dateText(row.event_date || row.activity_date || row.created_at)}</div>
    <div class="timeline-content">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </div>
    <a class="timeline-status" href="${escapeAttr(url)}"><i class="fa-solid fa-arrow-left"></i> التفاصيل</a>
  </article>`;
}

function renderItems(sectionKey, section, rows) {
  if (!rows.length) return `<div class="empty-state">لا توجد عناصر منشورة حاليًا في قسم ${escapeHtml(section.label)}.</div>`;

  if (sectionKey === "activities") return rows.map(row => renderActivityCard(sectionKey, section, row)).join("\n");
  if (sectionKey === "courses") return rows.map(row => renderCourseCard(section, row)).join("\n");
  if (sectionKey === "committees") return rows.map(row => renderCommitteeCard(section, row)).join("\n");
  if (sectionKey === "achievements") return rows.map(row => renderAchievementCard(section, row)).join("\n");
  if (sectionKey === "events") return rows.map(row => renderEventCard(section, row)).join("\n");

  return rows.map(row => renderActivityCard(sectionKey, section, row)).join("\n");
}

function renderCroppedSection(sectionKey, section, rows) {
  if (sectionKey === "news") return renderNewsTv(section, rows);

  const copy = SECTION_COPY[sectionKey] || {
    id: sectionKey,
    kicker: section.label,
    title: section.label,
    desc: section.description
  };

  const gridClass = sectionKey === "events"
    ? "timeline-wrap"
    : section.gridClass || "activities-grid";

  const filters = sectionKey === "courses"
    ? `<div class="filters reveal show">
        <button class="filter-btn active" type="button"><i class="fa-solid fa-border-all"></i> الكل</button>
        <button class="filter-btn" type="button"><i class="fa-solid fa-laptop-code"></i> تقنية</button>
        <button class="filter-btn" type="button"><i class="fa-solid fa-person-chalkboard"></i> مهارات</button>
        <button class="filter-btn" type="button"><i class="fa-solid fa-graduation-cap"></i> أكاديمية</button>
      </div>`
    : "";

  return `<section id="${escapeAttr(copy.id)}" style="padding-top:122px">
    <div class="container">
      ${renderSectionHeader(sectionKey, section)}
      ${filters}
      <div class="${escapeAttr(gridClass)}">${renderItems(sectionKey, section, rows)}</div>
    </div>
  </section>`;
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
      order: sectionKey === "news" ? "sort_order.asc,created_at.desc" : section.order,
      limit: 1000
    });

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

    const body = `<main>${renderCroppedSection(sectionKey, section, rows)}</main>`;

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
