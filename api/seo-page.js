// api/seo-page.js
// صفحة تفاصيل نظيفة وجميلة للمستخدمين.
// لا تعرض حقول تقنية مثل icon أو is_light أو بيانات إضافية غير مفهومة.
// تستخدم نفس CSS وكلاسات الموقع الرئيسي قدر الإمكان.

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

  return schema;
}

function sectionDomId(sectionKey) {
  if (sectionKey === "news") return "latest-news";
  if (sectionKey === "events") return "timeline";
  return sectionKey;
}

function sectionDate(row, sectionKey) {
  return row.event_date || row.activity_date || row.start_date || row.end_date || row.achievement_date || row.initiative_date || row.created_at || "";
}

function buildReadableTags(row, sectionKey) {
  const tags = [];

  if (row.category) {
    tags.push(`<span class="tag"><i class="fa-solid fa-tag"></i> ${escapeHtml(row.category)}</span>`);
  }

  if (row.status) {
    tags.push(`<span class="tag"><i class="fa-solid fa-signal"></i> ${escapeHtml(row.status)}</span>`);
  }

  if (row.location) {
    tags.push(`<span class="tag"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(row.location)}</span>`);
  }

  const date = sectionDate(row, sectionKey);
  if (date) {
    tags.push(`<span class="tag"><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(prettyDate(date))}</span>`);
  }

  if (row.organizer) {
    tags.push(`<span class="tag"><i class="fa-solid fa-building"></i> ${escapeHtml(row.organizer)}</span>`);
  }

  if (row.target_group) {
    tags.push(`<span class="tag"><i class="fa-solid fa-users"></i> ${escapeHtml(row.target_group)}</span>`);
  }

  const seatsTotal = row.seats_total || row.capacity;
  const seatsTaken = row.seats_taken || row.registered_count;
  if (seatsTotal) {
    tags.push(`<span class="tag"><i class="fa-solid fa-users"></i> المقاعد: ${escapeHtml(seatsTaken || 0)} / ${escapeHtml(seatsTotal)}</span>`);
  }

  if (row.value) {
    tags.push(`<span class="tag"><i class="fa-solid fa-chart-line"></i> ${escapeHtml(row.value)}</span>`);
  }

  return tags.join("");
}

function buildHighlights(row, sectionKey) {
  const items = [];

  if (row.organizer) items.push(["الجهة المنفذة", row.organizer, "fa-solid fa-building"]);
  if (row.target_group) items.push(["الفئة المستهدفة", row.target_group, "fa-solid fa-users"]);
  if (row.beneficiaries) items.push(["المستفيدون", row.beneficiaries, "fa-solid fa-hand-holding-heart"]);
  if (row.requirements) items.push(["المتطلبات", row.requirements, "fa-solid fa-list-check"]);
  if (row.expected_needs) items.push(["الاحتياجات", row.expected_needs, "fa-solid fa-box-open"]);
  if (row.team) items.push(["الفريق", row.team, "fa-solid fa-people-group"]);
  if (row.suggested_team) items.push(["الفريق المقترح", row.suggested_team, "fa-solid fa-people-group"]);

  if (!items.length) return "";

  return `<div class="activity-info-card reveal show">
    <h4><i class="fa-solid fa-star"></i> نقاط مهمة</h4>
    <div class="links-list">
      ${items.map(([label, value, icon]) => `<article class="committee-link-card">
        <div class="committee-link-icon"><i class="${icon}"></i></div>
        <div>
          <h4>${escapeHtml(label)}</h4>
          <p style="white-space:pre-line">${escapeHtml(value)}</p>
        </div>
      </article>`).join("")}
    </div>
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

function buildLinks(row, details) {
  const links = [];
  if (row.url) links.push(String(row.url));

  extractLinksFromText(`${row.description || ""}\n${row.details || ""}\n${row.ticker || ""}\n${details || ""}`).forEach(url => {
    if (!links.includes(url)) links.push(url);
  });

  if (!links.length) return "";

  return `<div class="activity-info-card reveal show">
    <h4><i class="fa-solid fa-link"></i> روابط مهمة</h4>
    <div class="links-list">
      ${links.map((url, i) => `<article class="committee-link-card">
        <div class="committee-link-icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
        <div>
          <h4>${escapeHtml(row.link_text || `رابط ${i + 1}`)}</h4>
          <p>${escapeHtml(url)}</p>
        </div>
        <a class="btn btn-dark" href="${escapeAttr(url)}" target="_blank" rel="noopener">فتح</a>
      </article>`).join("")}
    </div>
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
    return "";
  }
}

function buildGallery(image, images, title) {
  const all = [];
  if (image) all.push(image);
  for (const src of images) {
    if (src && !all.includes(src)) all.push(src);
  }

  if (!all.length) {
    return `<div class="links-empty">لا توجد صور مضافة حاليًا.</div>`;
  }

  return `<div class="activity-details-gallery reveal show">
    ${all.map(src => `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy" onclick="openCleanImage('${escapeAttr(src)}')">`).join("")}
  </div>`;
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
    const domId = sectionDomId(sectionKey);
    const tags = buildReadableTags(row, sectionKey);
    const tasks = buildTasks(row);
    const highlights = buildHighlights(row, sectionKey);
    const links = buildLinks(row, details);
    const committeeLinks = await buildCommitteeLinks(sectionKey, id);
    const gallery = buildGallery(image, images, title);

    const css = `
      <style>
        .clean-detail-page{padding-top:112px}
        .clean-detail-page .activity-details-box{width:100%;max-height:none;overflow:visible;border-radius:38px}
        .clean-detail-page .activity-details-head{margin-bottom:20px}
        .clean-detail-page .activity-details-head h3{font-size:clamp(24px,3.4vw,44px)}
        .clean-detail-page .activity-details-head p{max-width:900px}
        .clean-main-image{width:100%;height:360px;object-fit:cover;border-radius:30px;border:1px solid var(--border);box-shadow:0 24px 60px rgba(11,94,215,.16);margin-bottom:14px;cursor:pointer}
        .clean-detail-page .activity-info-card{position:relative;overflow:hidden}
        .clean-detail-page .activity-info-card:before{content:"";position:absolute;top:0;right:0;left:0;height:3px;background:linear-gradient(90deg,var(--section-color,var(--primary)),var(--primary-light))}
        .clean-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
        .clean-viewer{position:fixed;inset:0;z-index:6000;display:none;place-items:center;padding:18px;background:rgba(3,12,22,.82);backdrop-filter:blur(12px)}
        .clean-viewer.show{display:grid}
        .clean-viewer img{max-width:min(1120px,100%);max-height:86vh;border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.45)}
        .clean-viewer button{position:absolute;top:18px;left:18px;width:46px;height:46px;border:1px solid rgba(255,255,255,.28);border-radius:17px;color:white;background:rgba(255,255,255,.12);cursor:pointer}
        @media(max-width:760px){.clean-detail-page{padding-top:92px}.clean-detail-page .activity-details-box{padding:17px;border-radius:30px}.clean-main-image{height:235px;border-radius:24px}.clean-actions{display:grid}.clean-actions .btn{width:100%}}
      </style>
    `;

    const body = `
      ${css}
      <main class="clean-detail-page">
        <section id="${escapeAttr(domId)}">
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
                  <div class="clean-actions">
                    <a class="btn btn-dark" href="${escapeAttr(section.path)}"><i class="fa-solid fa-arrow-right"></i> العودة إلى ${escapeHtml(section.label)}</a>
                    <a class="btn btn-light" href="${escapeAttr(section.mainAnchor || "/")}"><i class="fa-solid fa-location-arrow"></i> عرض داخل الرئيسية</a>
                    <a class="btn btn-soft" href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
                  </div>
                </div>
                <a class="activity-details-close" href="${escapeAttr(section.path)}" aria-label="رجوع"><i class="fa-solid fa-arrow-right"></i></a>
              </div>

              <div class="activity-details-layout">
                <div class="activity-details-info">
                  ${image ? `<img class="clean-main-image reveal show" src="${escapeAttr(image)}" alt="${escapeAttr(title)}" onclick="openCleanImage('${escapeAttr(image)}')">` : ""}

                  <div class="activity-info-card reveal show">
                    <h4><i class="${escapeAttr(icon)}"></i> التفاصيل</h4>
                    <p style="white-space:pre-line">${escapeHtml(details)}</p>
                  </div>

                  ${tags ? `<div class="activity-info-card reveal show">
                    <h4><i class="fa-solid fa-circle-info"></i> معلومات مهمة</h4>
                    <div class="tags">${tags}</div>
                  </div>` : ""}

                  ${highlights}
                  ${tasks}
                  ${committeeLinks}
                  ${links}
                </div>

                <div class="activity-details-info">
                  <div class="activity-info-card reveal show">
                    <h4><i class="fa-solid fa-images"></i> الصور والتغطية</h4>
                    <p>اضغط على أي صورة لعرضها بحجم أكبر.</p>
                  </div>
                  ${gallery}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="clean-viewer" id="cleanViewer" onclick="closeCleanImage()">
          <button type="button" onclick="closeCleanImage();event.stopPropagation()"><i class="fa-solid fa-xmark"></i></button>
          <img id="cleanViewerImg" src="" alt="عرض الصورة">
        </div>

        <script>
          function openCleanImage(src){
            var viewer = document.getElementById('cleanViewer');
            var img = document.getElementById('cleanViewerImg');
            if(!viewer || !img) return;
            img.src = src;
            viewer.classList.add('show');
          }
          function closeCleanImage(){
            var viewer = document.getElementById('cleanViewer');
            if(viewer) viewer.classList.remove('show');
          }
          document.addEventListener('keydown', function(e){
            if(e.key === 'Escape') closeCleanImage();
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
