// api/seo-page.js
// صفحة ID تعرض نفس تصميم عنصر الصفحة الرئيسية تمامًا، لكن بعنصر واحد فقط.
// لا تعرض أزرار رجوع أو بيانات تقنية، ولا صفحات تفاصيل مختلفة.

const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, imageOf, parseImages, urlFor,
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

  return `<section id="latest-news" style="padding-top:122px">
    <div class="container">
      ${renderHeader(sectionKey, section)}
      <div class="news-studio reveal show delay-1">
        <div class="news-tv">
          <div class="news-screen">
            <div class="news-media">
              ${image ? `<img alt="${escapeAttr(title)}" src="${escapeAttr(image)}" />` : ""}
              <div class="news-shine"></div>
              <div class="news-live"><i class="fa-solid fa-circle"></i> آخر الأخبار</div>
            </div>
            <div class="news-frame-ticker"><span>${escapeHtml(ticker)}</span></div>
            <div class="news-caption">
              <div class="news-category"><i class="${escapeAttr(icon)}"></i> ${escapeHtml(category)}</div>
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(text)}</p>
            </div>
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

  if (row.category) meta.push(`<span><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
  if (row.status) meta.push(`<span><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
  if (row.location) meta.push(`<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);
  if (row.activity_date || row.event_date) meta.push(`<span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(prettyDate(row.activity_date || row.event_date))}</span>`);

  return `<article class="activity-card reveal show" style="max-width:420px;margin-inline:auto">
    <div class="cover">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      ${meta.length ? `<div class="activity-meta">${meta.join("")}</div>` : ""}
      <p>${escapeHtml(text)}</p>
    </div>
  </article>`;
}

function renderCourse(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const category = row.category || row.course_category || "برنامج تدريبي";
  const seatsTotal = Number(row.seats_total || row.capacity || 0);
  const seatsTaken = Number(row.seats_taken || row.registered_count || 0);
  const percent = seatsTotal > 0 ? Math.min(100, Math.max(0, Math.round((seatsTaken / seatsTotal) * 100))) : 0;

  return `<article class="course-card reveal show" data-category="${escapeAttr(category)}" style="max-width:420px;margin-inline:auto">
    <div class="cover">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      <span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(category)}</span>
      <p>${escapeHtml(text)}</p>
      ${seatsTotal > 0 ? `<div class="progress-block">
        <div class="progress-info"><span>المقاعد المسجلة</span><strong>${escapeHtml(seatsTaken)} / ${escapeHtml(seatsTotal)}</strong></div>
        <div class="progress"><span style="--width:${percent}%"></span></div>
      </div>` : ""}
      <div class="course-meta-line">
        <span><i class="fa-solid fa-circle-info"></i> ${escapeHtml(row.status || "متاحة")}</span>
        ${row.start_date ? `<span><i class="fa-solid fa-calendar"></i> ${escapeHtml(prettyDate(row.start_date))}</span>` : ""}
      </div>
    </div>
  </article>`;
}

function renderCommittee(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const icon = safeIcon(row.icon, section.icon);
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

  return `<article class="committee-card reveal show" style="max-width:420px;margin-inline:auto">
    <div class="avatar"><i class="${escapeAttr(icon)}"></i></div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
    ${tasks.length ? `<div class="committee-tasks">${tasks.slice(0,3).map(t => `<div class="committee-task"><i class="fa-solid fa-circle"></i> ${escapeHtml(t)}</div>`).join("")}</div>` : ""}
  </article>`;
}

async function renderCommitteeLinks(sectionKey, id) {
  if (sectionKey !== "committees") return "";

  try {
    const links = await supabaseSelect("committee_links", {
      filters: { committee_id: `eq.${id}`, is_active: "eq.true" },
      order: "sort_order.asc",
      limit: 100
    });

    if (!links.length) return "";

    return `<div class="committee-links-sheet reveal show" style="margin:22px auto 0;max-width:980px">
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <div class="sheet-icon"><i class="fa-solid fa-link"></i></div>
        <div>
          <h3>روابط اللجنة والقنوات</h3>
          <p>روابط مباشرة خاصة بهذه اللجنة.</p>
        </div>
      </div>
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
  } catch (_) {
    return "";
  }
}

function renderAchievement(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const date = row.achievement_date ? prettyDate(row.achievement_date) : "";
  const value = row.value || "";

  return `<article class="achievement-card reveal show" style="max-width:420px;margin-inline:auto">
    ${image && !image.includes("og-image") ? `<div style="height:180px;margin:-24px -18px 16px;overflow:hidden;border-radius:26px 26px 0 0"><img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" style="width:100%;height:100%;object-fit:cover"></div>` : ""}
    <div class="achievement-icon"><i class="${escapeAttr(icon)}"></i></div>
    <div class="achievement-number">${escapeHtml(value || "✓")}</div>
    <p>${escapeHtml(title)}</p>
    ${text ? `<p style="margin-top:8px">${escapeHtml(text)}</p>` : ""}
    ${date ? `<span class="tag" style="margin-top:12px"><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(date)}</span>` : ""}
  </article>`;
}

function renderInitiative(section, row) {
  const title = titleOf(row, section);
  const text = textOf(row, section);
  const image = imageOf(row);
  const icon = safeIcon(row.icon, section.icon);
  const meta = [];

  if (row.category) meta.push(`<span><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
  if (row.status) meta.push(`<span><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
  if (row.initiative_date) meta.push(`<span><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(prettyDate(row.initiative_date))}</span>`);
  if (row.target_group) meta.push(`<span><i class="fa-solid fa-users"></i> ${escapeHtml(row.target_group)}</span>`);

  return `<article class="activity-card initiative-card reveal show" style="max-width:420px;margin-inline:auto">
    <div class="cover">
      ${image && !image.includes("og-image") ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.30">` : ""}
      <h3><i class="${escapeAttr(icon)}"></i> ${escapeHtml(title)}</h3>
    </div>
    <div class="card-body">
      ${meta.length ? `<div class="activity-meta">${meta.join("")}</div>` : ""}
      <p>${escapeHtml(text)}</p>
    </div>
  </article>`;
}

function renderEvent(section, row) {
  const title = titleOf(row, section);
  const text = row.location || textOf(row, section) || section.description;
  return `<article class="timeline-card reveal show" style="max-width:900px;margin-inline:auto">
    <div class="date-box">${escapeHtml(prettyDate(row.event_date || row.activity_date || row.created_at) || "قريبًا")}</div>
    <div class="timeline-content">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </div>
    <span class="timeline-status"><i class="fa-solid fa-calendar-days"></i> فعالية</span>
  </article>`;
}

function renderGallery(sectionKey, row, section) {
  const title = titleOf(row, section);
  const image = imageOf(row);
  const images = parseImages(row.gallery_images);
  const all = [];
  if (image && !image.includes("og-image")) all.push(image);
  for (const src of images) {
    if (src && !all.includes(src)) all.push(src);
  }

  if (!all.length) return "";

  return `<div class="gallery-grid" style="margin-top:24px">
    ${all.map((src, index) => `<article class="gallery-card ${index % 2 ? "light-gallery" : ""} reveal show" style="background-image:linear-gradient(135deg,rgba(11,94,215,.35),rgba(6,59,143,.65)),url('${escapeAttr(src)}');background-size:cover;background-position:center;min-height:260px">
      <h3><i class="fa-solid fa-image"></i> صورة ${index + 1}</h3>
      <p>${escapeHtml(title)}</p>
    </article>`).join("")}
  </div>`;
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

  const committeeLinks = await renderCommitteeLinks(sectionKey, row.id);
  const gallery = ["committees", "events"].includes(sectionKey) ? "" : renderGallery(sectionKey, row, section);

  return `<section id="${escapeAttr(domId)}" style="padding-top:122px">
    <div class="container">
      ${renderHeader(sectionKey, section)}
      <div class="${escapeAttr(gridClass)}" style="${sectionKey === "events" ? "" : "grid-template-columns:1fr"}">${item}</div>
      ${committeeLinks}
      ${gallery}
    </div>
  </section>`;
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
    const description = truncate(textOf(row, section) || section.description, 170);
    const image = imageOf(row);
    const url = urlFor(sectionKey, row);
    const schema = schemaFor(sectionKey, section, row, title, description, image, url);
    const body = `<main>${await renderSingle(sectionKey, section, row)}</main>`;

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
