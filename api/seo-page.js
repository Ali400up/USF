// api/seo-page.js
// تصميم فاخر ومنظم جدًا لصفحات التفاصيل عند الدخول برابط ID.
// يعمل مع: /news/:id /courses/:id /activities/:id /events/:id /committees/:id /achievements/:id /initiatives/:id

const {
  SITE_URL, SITE_NAME, SECTIONS,
  escapeHtml, escapeAttr, truncate, titleOf, textOf, detailOf, imageOf, parseImages, urlFor,
  responseHeaders, supabaseSelect, htmlLayout, errorPage
} = require("./_seo-utils");

const premiumDetailCss = `
<style>
  .id-premium-page{
    --detail-color: var(--section-color, #0B5ED7);
    --detail-color-dark:#063B8F;
    --detail-accent:#64B5F6;
    --detail-soft:rgba(11,94,215,.10);
    position:relative;
    overflow:hidden;
    padding-top:104px;
  }

  .id-premium-page:before,
  .id-premium-page:after{
    content:"";
    position:fixed;
    z-index:-1;
    width:520px;
    height:520px;
    border-radius:50%;
    filter:blur(36px);
    opacity:.18;
    pointer-events:none;
    background:var(--detail-color);
    animation:idOrb 16s cubic-bezier(.2,.8,.2,1) infinite alternate;
  }

  .id-premium-page:before{top:70px;right:-210px}
  .id-premium-page:after{bottom:-210px;left:-190px;background:var(--detail-accent);animation-delay:1.5s}

  @keyframes idOrb{
    to{transform:translate3d(54px,-42px,0) scale(1.12)}
  }

  .id-hero-wrap{
    padding:28px 0 30px;
  }

  .id-hero-card{
    position:relative;
    overflow:hidden;
    border-radius:46px;
    min-height:480px;
    color:#fff;
    border:1px solid rgba(255,255,255,.22);
    box-shadow:0 38px 110px rgba(11,94,215,.25);
    isolation:isolate;
    background:
      radial-gradient(circle at 18% 16%,rgba(255,255,255,.26),transparent 24%),
      radial-gradient(circle at 84% 22%,rgba(100,181,246,.24),transparent 28%),
      linear-gradient(135deg,var(--detail-color),#0B5ED7 55%,#063B8F);
  }

  .id-hero-bg{
    position:absolute;
    inset:0;
    z-index:-3;
    opacity:.22;
    background-size:cover;
    background-position:center;
    filter:saturate(1.15) contrast(1.05);
    transform:scale(1.04);
  }

  .id-hero-card:before{
    content:"";
    position:absolute;
    inset:0;
    z-index:-2;
    background:
      linear-gradient(90deg,rgba(3,12,22,.82),rgba(3,12,22,.45) 48%,rgba(3,12,22,.18)),
      repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 6px);
  }

  .id-hero-card:after{
    content:"";
    position:absolute;
    top:-70%;
    left:-25%;
    width:32%;
    height:210%;
    transform:rotate(18deg);
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);
    animation:idShine 5.8s linear infinite;
    z-index:-1;
  }

  @keyframes idShine{
    0%{left:-38%;opacity:0}
    16%{opacity:.88}
    42%{left:120%;opacity:0}
    100%{left:120%;opacity:0}
  }

  .id-hero-inner{
    position:relative;
    z-index:2;
    display:grid;
    grid-template-columns:minmax(0,1.03fr) minmax(320px,.72fr);
    gap:28px;
    align-items:center;
    padding:42px;
    min-height:480px;
  }

  .id-breadcrumb{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    gap:8px;
    margin-bottom:18px;
    color:rgba(255,255,255,.80);
    font-size:13px;
    font-weight:900;
  }

  .id-breadcrumb a{
    color:#fff;
    display:inline-flex;
    align-items:center;
    gap:7px;
    padding:8px 12px;
    border-radius:999px;
    background:rgba(255,255,255,.12);
    border:1px solid rgba(255,255,255,.16);
    backdrop-filter:blur(12px);
  }

  .id-badge{
    display:inline-flex;
    align-items:center;
    gap:10px;
    margin-bottom:16px;
    padding:10px 14px;
    border-radius:999px;
    background:rgba(255,255,255,.14);
    border:1px solid rgba(255,255,255,.18);
    color:#EAF6FF;
    font-weight:900;
    box-shadow:0 16px 38px rgba(0,0,0,.14);
  }

  .id-badge i{
    width:34px;
    height:34px;
    display:grid;
    place-items:center;
    border-radius:13px;
    color:var(--detail-color);
    background:#fff;
  }

  .id-hero-title{
    font-size:clamp(34px,5.5vw,72px);
    line-height:1.18;
    font-weight:900;
    letter-spacing:-1.6px;
    margin-bottom:16px;
    text-shadow:0 18px 46px rgba(0,0,0,.28);
  }

  .id-hero-desc{
    max-width:840px;
    color:rgba(255,255,255,.86);
    font-size:17px;
    line-height:2.05;
    font-weight:800;
    margin-bottom:24px;
  }

  .id-actions{
    display:flex;
    align-items:center;
    flex-wrap:wrap;
    gap:11px;
  }

  .id-actions .btn{
    min-height:50px;
    border-radius:19px;
  }

  .id-hero-media{
    position:relative;
    padding:14px;
    border-radius:34px;
    background:rgba(255,255,255,.14);
    border:1px solid rgba(255,255,255,.20);
    box-shadow:0 26px 72px rgba(0,0,0,.28);
    backdrop-filter:blur(20px);
    transform:perspective(1000px) rotateY(-4deg);
    transition:.45s cubic-bezier(.2,.8,.2,1);
  }

  .id-hero-media:hover{
    transform:perspective(1000px) rotateY(0deg) translateY(-6px);
  }

  .id-main-image{
    width:100%;
    height:330px;
    object-fit:cover;
    border-radius:26px;
    border:1px solid rgba(255,255,255,.20);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 20px 56px rgba(0,0,0,.28);
    background:#061525;
  }

  .id-image-fallback{
    height:330px;
    display:grid;
    place-items:center;
    border-radius:26px;
    background:linear-gradient(135deg,rgba(255,255,255,.20),rgba(255,255,255,.07));
    color:#fff;
    font-size:82px;
  }

  .id-live-strip{
    position:absolute;
    right:26px;
    top:26px;
    display:inline-flex;
    align-items:center;
    gap:7px;
    padding:8px 12px;
    border-radius:999px;
    color:#fff;
    background:rgba(220,38,38,.92);
    font-size:12px;
    font-weight:900;
    box-shadow:0 14px 34px rgba(220,38,38,.28);
  }

  .id-live-strip i{
    animation:idPulse 1.1s ease-in-out infinite;
  }

  @keyframes idPulse{50%{transform:scale(1.3);opacity:.55}}

  .id-mini-stats{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:10px;
    margin-top:12px;
  }

  .id-mini-stat{
    padding:12px;
    border-radius:18px;
    background:rgba(255,255,255,.12);
    border:1px solid rgba(255,255,255,.16);
    color:rgba(255,255,255,.84);
    font-weight:900;
    line-height:1.5;
    font-size:12px;
  }

  .id-mini-stat strong{
    display:block;
    color:#fff;
    font-size:14px;
    margin-top:2px;
  }

  .id-body-section{
    padding:46px 0 78px;
  }

  .id-layout{
    display:grid;
    grid-template-columns:minmax(0,1fr) 380px;
    gap:18px;
    align-items:start;
  }

  .id-panel{
    position:relative;
    overflow:hidden;
    border:1px solid rgba(11,94,215,.14);
    border-radius:34px;
    background:rgba(255,255,255,.78);
    backdrop-filter:blur(22px);
    box-shadow:0 24px 76px rgba(11,94,215,.13);
    padding:24px;
    transition:.38s cubic-bezier(.2,.8,.2,1);
  }

  .dark .id-panel{background:rgba(8,27,47,.78)}

  .id-panel:hover{
    transform:translateY(-5px);
    box-shadow:0 34px 92px rgba(11,94,215,.22);
  }

  .id-panel:before{
    content:"";
    position:absolute;
    top:0;
    right:0;
    left:0;
    height:4px;
    background:linear-gradient(90deg,var(--detail-color),var(--detail-accent),#fff);
  }

  .id-panel-title{
    display:flex;
    align-items:center;
    gap:10px;
    margin-bottom:16px;
    color:var(--text);
    font-size:22px;
    line-height:1.45;
    font-weight:900;
  }

  .id-panel-title i{
    width:44px;
    height:44px;
    display:grid;
    place-items:center;
    border-radius:17px;
    color:#fff;
    background:linear-gradient(135deg,var(--detail-color),#063B8F);
    box-shadow:0 16px 36px rgba(11,94,215,.22);
    flex:0 0 auto;
  }

  .id-rich-text{
    color:var(--muted);
    font-size:15px;
    line-height:2.18;
    font-weight:800;
    white-space:pre-line;
  }

  .id-rich-text strong{
    color:var(--text);
  }

  .id-meta-grid{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
  }

  .id-meta-pill{
    display:flex;
    align-items:flex-start;
    gap:10px;
    min-height:66px;
    padding:13px;
    border-radius:20px;
    background:rgba(11,94,215,.07);
    border:1px solid rgba(11,94,215,.11);
    color:var(--muted);
    font-size:13px;
    font-weight:900;
    line-height:1.65;
  }

  .id-meta-pill i{
    width:34px;
    height:34px;
    display:grid;
    place-items:center;
    border-radius:13px;
    color:#fff;
    background:linear-gradient(135deg,var(--detail-color),#0B5ED7);
    flex:0 0 auto;
  }

  .id-meta-pill span{display:block;color:var(--text);font-size:12px;margin-bottom:2px}

  .id-gallery{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:12px;
  }

  .id-gallery button{
    padding:0;
    border:0;
    background:transparent;
    cursor:pointer;
    overflow:hidden;
    border-radius:24px;
    box-shadow:0 18px 50px rgba(11,94,215,.13);
  }

  .id-gallery button:first-child{
    grid-column:1/-1;
  }

  .id-gallery img{
    width:100%;
    height:210px;
    object-fit:cover;
    border-radius:24px;
    border:1px solid rgba(11,94,215,.13);
    transition:.45s cubic-bezier(.2,.8,.2,1);
  }

  .id-gallery button:first-child img{
    height:370px;
  }

  .id-gallery button:hover img{
    transform:scale(1.045);
    filter:saturate(1.12) contrast(1.04);
  }

  .id-side{
    position:sticky;
    top:96px;
    display:grid;
    gap:14px;
  }

  .id-quick-card{
    display:grid;
    gap:10px;
  }

  .id-action-grid{
    display:grid;
    gap:10px;
  }

  .id-action-grid .btn{
    width:100%;
    justify-content:center;
    border-radius:19px;
    min-height:51px;
  }

  .id-data-list,
  .id-links-list{
    display:grid;
    gap:11px;
  }

  .id-data-card,
  .id-link-card{
    display:grid;
    grid-template-columns:48px 1fr auto;
    gap:12px;
    align-items:center;
    padding:13px;
    border-radius:22px;
    background:rgba(11,94,215,.06);
    border:1px solid rgba(11,94,215,.12);
    transition:.32s cubic-bezier(.2,.8,.2,1);
  }

  .id-data-card:hover,
  .id-link-card:hover{
    transform:translateY(-4px);
    background:rgba(11,94,215,.10);
  }

  .id-data-icon{
    width:48px;
    height:48px;
    display:grid;
    place-items:center;
    border-radius:18px;
    color:#fff;
    background:linear-gradient(135deg,var(--detail-color),#063B8F);
    box-shadow:0 14px 32px rgba(11,94,215,.19);
  }

  .id-data-card h4,
  .id-link-card h4{
    font-size:15px;
    line-height:1.5;
    color:var(--text);
    font-weight:900;
    margin:0 0 3px;
  }

  .id-data-card p,
  .id-link-card p{
    color:var(--muted);
    font-size:12.5px;
    line-height:1.75;
    font-weight:800;
    white-space:pre-line;
    margin:0;
  }

  .id-link-card .btn{
    padding:9px 12px;
    font-size:12px;
    border-radius:15px;
  }

  .id-task-list{
    display:grid;
    gap:9px;
  }

  .id-task-item{
    display:flex;
    gap:10px;
    align-items:flex-start;
    padding:12px;
    border-radius:19px;
    background:rgba(11,94,215,.06);
    color:var(--muted);
    font-weight:850;
    line-height:1.9;
  }

  .id-task-item i{
    margin-top:8px;
    color:var(--detail-color);
    font-size:9px;
  }

  .id-empty{
    padding:18px;
    border-radius:22px;
    border:1px dashed rgba(11,94,215,.22);
    text-align:center;
    color:var(--muted);
    font-weight:900;
    line-height:2;
  }

  .id-viewer{
    position:fixed;
    inset:0;
    z-index:5000;
    display:none;
    place-items:center;
    padding:18px;
    background:rgba(3,12,22,.82);
    backdrop-filter:blur(14px);
  }

  .id-viewer.show{display:grid}

  .id-viewer img{
    max-width:min(1120px,100%);
    max-height:86vh;
    object-fit:contain;
    border-radius:26px;
    box-shadow:0 32px 110px rgba(0,0,0,.55);
  }

  .id-viewer button{
    position:absolute;
    top:18px;
    left:18px;
    width:48px;
    height:48px;
    border:1px solid rgba(255,255,255,.24);
    border-radius:18px;
    background:rgba(255,255,255,.12);
    color:#fff;
    cursor:pointer;
  }

  .id-reveal{
    opacity:0;
    transform:translateY(36px);
    animation:idReveal .78s cubic-bezier(.2,.8,.2,1) forwards;
  }

  .id-delay-1{animation-delay:.08s}
  .id-delay-2{animation-delay:.16s}
  .id-delay-3{animation-delay:.24s}
  .id-delay-4{animation-delay:.32s}

  @keyframes idReveal{
    to{opacity:1;transform:translateY(0)}
  }

  @media(max-width:1080px){
    .id-hero-inner{grid-template-columns:1fr}
    .id-hero-media{transform:none}
    .id-layout{grid-template-columns:1fr}
    .id-side{position:relative;top:auto}
  }

  @media(max-width:760px){
    .id-premium-page{padding-top:82px}
    .id-hero-card{border-radius:30px;min-height:auto}
    .id-hero-inner{padding:22px;gap:18px;min-height:auto}
    .id-hero-title{font-size:clamp(30px,9.5vw,44px);letter-spacing:-.5px}
    .id-hero-desc{font-size:14px;line-height:2}
    .id-actions{display:grid;grid-template-columns:1fr}
    .id-actions .btn{width:100%}
    .id-main-image,.id-image-fallback{height:250px}
    .id-mini-stats{grid-template-columns:1fr}
    .id-body-section{padding-top:28px}
    .id-panel{padding:17px;border-radius:26px}
    .id-panel-title{font-size:19px}
    .id-meta-grid{grid-template-columns:1fr}
    .id-gallery{grid-template-columns:1fr}
    .id-gallery button:first-child img,.id-gallery img{height:230px}
    .id-data-card,.id-link-card{grid-template-columns:44px 1fr}
    .id-link-card .btn{grid-column:1/-1;width:100%;justify-content:center}
  }
</style>
`;

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
  if ([
    "created_at",
    "updated_at",
    "event_date",
    "activity_date",
    "start_date",
    "end_date",
    "achievement_date",
    "initiative_date"
  ].includes(key)) {
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

function buildMetaPills(row) {
  const pills = [];

  for (const key of PRIORITY_FIELDS) {
    const value = valueToText(key, row[key]);
    if (!value) continue;

    pills.push(`<div class="id-meta-pill">
      <i class="${metaIcon(key)}"></i>
      <div><span>${escapeHtml(FIELD_LABELS[key] || key)}</span>${escapeHtml(value)}</div>
    </div>`);
  }

  return pills.join("");
}

function buildMiniStats(row, sectionKey) {
  const stats = [];

  if (row.category) stats.push(["التصنيف", row.category]);
  if (row.status) stats.push(["الحالة", row.status]);
  if (row.location) stats.push(["الموقع", row.location]);
  if (row.event_date || row.activity_date || row.start_date || row.achievement_date || row.initiative_date) {
    stats.push(["التاريخ", prettyDate(row.event_date || row.activity_date || row.start_date || row.achievement_date || row.initiative_date)]);
  }
  if (row.seats_total || row.capacity) {
    stats.push(["المقاعد", `${row.seats_taken || row.registered_count || 0} / ${row.seats_total || row.capacity}`]);
  }

  if (!stats.length) {
    stats.push(["القسم", sectionKey]);
    stats.push(["آخر تحديث", prettyDate(row.updated_at || row.created_at || new Date())]);
  }

  return stats.slice(0, 4).map(([label, value]) => `<div class="id-mini-stat">${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></div>`).join("");
}

function buildInfoRows(row) {
  const rows = [];

  for (const [key, raw] of Object.entries(row)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (["title", "name", "description", "details", "ticker"].includes(key)) continue;
    if (PRIORITY_FIELDS.includes(key)) continue;

    const value = valueToText(key, raw);
    if (!value) continue;

    rows.push(`<div class="id-data-card">
      <div class="id-data-icon"><i class="fa-solid fa-database"></i></div>
      <div>
        <h4>${escapeHtml(FIELD_LABELS[key] || key)}</h4>
        <p>${escapeHtml(value)}</p>
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

  return `<div class="id-panel id-reveal id-delay-3">
    <h3 class="id-panel-title"><i class="fa-solid fa-link"></i> الروابط المهمة</h3>
    <div class="id-links-list">
      ${links.map((url, index) => `<article class="id-link-card">
        <div class="id-data-icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
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
    return `<div class="id-empty"><i class="fa-solid fa-image"></i><br>لا توجد صور إضافية لهذا العنصر حاليًا.</div>`;
  }

  return `<div class="id-gallery">
    ${all.map((src, index) => `<button type="button" onclick="openIdViewer('${escapeAttr(src)}')" aria-label="عرض الصورة ${index + 1}">
      <img src="${escapeAttr(src)}" alt="${escapeAttr(title)}" loading="lazy">
    </button>`).join("")}
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

  return `<div class="id-panel id-reveal id-delay-3">
    <h3 class="id-panel-title"><i class="fa-solid fa-list-check"></i> المهام والمسؤوليات</h3>
    <div class="id-task-list">
      ${tasks.map(task => `<div class="id-task-item"><i class="fa-solid fa-circle"></i><span>${escapeHtml(task)}</span></div>`).join("")}
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
      return `<div class="id-panel id-reveal id-delay-3">
        <h3 class="id-panel-title"><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h3>
        <div class="id-empty">لا توجد روابط مضافة لهذه اللجنة حاليًا.</div>
      </div>`;
    }

    return `<div class="id-panel id-reveal id-delay-3">
      <h3 class="id-panel-title"><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h3>
      <div class="id-links-list">
        ${links.map(link => {
          const linkUrl = link.url || "#";
          const isExternal = String(linkUrl).startsWith("http");
          return `<article class="id-link-card">
            <div class="id-data-icon"><i class="${escapeAttr(safeIcon(link.icon, "fa-solid fa-link"))}"></i></div>
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
    return `<div class="id-panel id-reveal id-delay-3">
      <h3 class="id-panel-title"><i class="fa-solid fa-link"></i> روابط اللجنة والقنوات</h3>
      <div class="id-empty">تعذر تحميل روابط اللجنة: ${escapeHtml(error.message)}</div>
    </div>`;
  }
}

function sectionSubtitle(sectionKey, row, section) {
  if (sectionKey === "news") return row.category || "خبر منشور";
  if (sectionKey === "courses") return row.category || row.status || "دورة تدريبية";
  if (sectionKey === "activities") return row.location || row.category || "نشاط طلابي";
  if (sectionKey === "events") return row.location || "فعالية قادمة";
  if (sectionKey === "committees") return "لجنة من لجان الملتقى";
  if (sectionKey === "achievements") return row.category || "إنجاز موثق";
  if (sectionKey === "initiatives") return row.category || row.status || "مبادرة طلابية";
  return section.singular || "تفاصيل";
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
    const metaPills = buildMetaPills(row);
    const miniStats = buildMiniStats(row, sectionKey);
    const infoRows = buildInfoRows(row);
    const linksHtml = buildExternalLinks(row, details);
    const tasksHtml = buildTasks(row);
    const committeeLinksHtml = await buildCommitteeLinks(sectionKey, id);
    const galleryHtml = buildGallery(image, images, title);
    const icon = safeIcon(row.icon, section.icon);
    const bgStyle = image ? `style="background-image:url('${escapeAttr(image)}')"` : "";
    const galleryLead = sectionSubtitle(sectionKey, row, section);

    const body = `
      ${premiumDetailCss}
      <main class="id-premium-page" style="--section-color:${escapeAttr(section.color || "#0B5ED7")};--detail-color:${escapeAttr(section.color || "#0B5ED7")}">

        <section class="id-hero-wrap">
          <div class="container">
            <div class="id-hero-card id-reveal">
              <div class="id-hero-bg" ${bgStyle}></div>
              <div class="id-hero-inner">
                <div>
                  <div class="id-breadcrumb">
                    <a href="/"><i class="fa-solid fa-house"></i> الرئيسية</a>
                    <span><i class="fa-solid fa-chevron-left"></i></span>
                    <a href="${escapeAttr(section.path)}"><i class="${escapeAttr(section.icon)}"></i> ${escapeHtml(section.label)}</a>
                  </div>

                  <div class="id-badge">
                    <i class="${escapeAttr(icon)}"></i>
                    <span>${escapeHtml(galleryLead)}</span>
                  </div>

                  <h1 class="id-hero-title">${escapeHtml(title)}</h1>
                  <p class="id-hero-desc">${escapeHtml(description)}</p>

                  <div class="id-actions">
                    <a class="btn btn-light" href="${escapeAttr(section.path)}"><i class="fa-solid fa-arrow-right"></i> كل ${escapeHtml(section.label)}</a>
                    <a class="btn btn-soft" href="${escapeAttr(section.mainAnchor || "/")}"><i class="fa-solid fa-location-arrow"></i> داخل الرئيسية</a>
                    <button class="btn btn-dark" type="button" onclick="navigator.clipboard && navigator.clipboard.writeText(location.href);this.innerHTML='<i class=&quot;fa-solid fa-check&quot;></i> تم نسخ الرابط'"><i class="fa-solid fa-link"></i> نسخ الرابط</button>
                  </div>
                </div>

                <aside class="id-hero-media id-reveal id-delay-1">
                  <div class="id-live-strip"><i class="fa-solid fa-circle"></i> ${escapeHtml(section.singular)}</div>
                  ${image ? `<img class="id-main-image" src="${escapeAttr(image)}" alt="${escapeAttr(title)}" onclick="openIdViewer('${escapeAttr(image)}')">` : `<div class="id-image-fallback"><i class="${escapeAttr(icon)}"></i></div>`}
                  <div class="id-mini-stats">${miniStats}</div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section class="id-body-section">
          <div class="container id-layout">

            <div class="id-main">

              <article class="id-panel id-reveal id-delay-1">
                <h2 class="id-panel-title"><i class="${escapeAttr(icon)}"></i> التفاصيل الكاملة</h2>
                <div class="id-rich-text">${escapeHtml(details)}</div>
              </article>

              ${metaPills ? `<section class="id-panel id-reveal id-delay-2">
                <h3 class="id-panel-title"><i class="fa-solid fa-circle-info"></i> معلومات مختصرة</h3>
                <div class="id-meta-grid">${metaPills}</div>
              </section>` : ""}

              ${tasksHtml}

              ${committeeLinksHtml}

              ${linksHtml}

              ${infoRows ? `<section class="id-panel id-reveal id-delay-4">
                <h3 class="id-panel-title"><i class="fa-solid fa-database"></i> بيانات إضافية</h3>
                <div class="id-data-list">${infoRows}</div>
              </section>` : ""}

            </div>

            <aside class="id-side">
              <section class="id-panel id-reveal id-delay-2">
                <h3 class="id-panel-title"><i class="fa-solid fa-images"></i> الصور والتغطية</h3>
                <p class="id-rich-text" style="font-size:14px">${escapeHtml(galleryLead)}</p>
                ${galleryHtml}
              </section>

              <section class="id-panel id-quick-card id-reveal id-delay-3">
                <h3 class="id-panel-title"><i class="fa-solid fa-compass"></i> تنقل سريع</h3>
                <div class="id-action-grid">
                  <a class="btn btn-dark" href="${escapeAttr(section.path)}"><i class="fa-solid fa-layer-group"></i> عرض القسم</a>
                  <a class="btn btn-light" href="/"><i class="fa-solid fa-house"></i> الصفحة الرئيسية</a>
                  <a class="btn btn-soft" href="/sitemap.xml"><i class="fa-solid fa-sitemap"></i> خريطة الموقع</a>
                </div>
              </section>
            </aside>

          </div>
        </section>

        <div class="id-viewer" id="idViewer" onclick="closeIdViewer()">
          <button type="button" onclick="closeIdViewer();event.stopPropagation()"><i class="fa-solid fa-xmark"></i></button>
          <img id="idViewerImage" src="" alt="عرض الصورة">
        </div>

        <script>
          function openIdViewer(src){
            var viewer = document.getElementById('idViewer');
            var img = document.getElementById('idViewerImage');
            if(!viewer || !img) return;
            img.src = src;
            viewer.classList.add('show');
          }
          function closeIdViewer(){
            var viewer = document.getElementById('idViewer');
            if(viewer) viewer.classList.remove('show');
          }
          document.addEventListener('keydown', function(e){
            if(e.key === 'Escape') closeIdViewer();
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
