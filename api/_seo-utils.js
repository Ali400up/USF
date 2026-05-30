// api/_seo-utils.js
// هذه النسخة تستخدم نفس CSS الأصلي للموقع الرئيسي حرفيًا عبر /assets/usf-main-style.css
// الهدف: صفحات /news و /courses و /activities وغيرها تظهر بنفس تنسيق الموقع الرئيسي وليس بتصميم مختلف.

const SITE_URL = (process.env.SITE_URL || "https://usf-flax.vercel.app").replace(/\/+$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://bvkcfdagsfmqrhyqspan.supabase.co").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const SITE_NAME = "ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا";
const DEFAULT_DESCRIPTION = "ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا: أخبار، أنشطة، دورات، لجان، فعاليات، ومتابعة لقضايا الطلاب.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const SECTIONS = {
  news: {
    label: "آخر الأخبار",
    singular: "خبر",
    table: "tv_news",
    path: "/news",
    mainAnchor: "/#latest-news",
    icon: "fa-solid fa-newspaper",
    color: "#0B5ED7",
    gridClass: "activities-grid",
    cardClass: "activity-card",
    description: "تابع آخر أخبار وإعلانات ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا.",
    order: "created_at.desc",
    schema: "NewsArticle",
    titleField: "title",
    textField: "description",
    detailField: "description",
    activeField: "is_active",
    changefreq: "daily",
    priority: "0.90"
  },
  activities: {
    label: "الأنشطة والرحلات",
    singular: "نشاط",
    table: "activities",
    path: "/activities",
    mainAnchor: "/#activities",
    icon: "fa-solid fa-calendar-check",
    color: "#0096C7",
    gridClass: "activities-grid",
    cardClass: "activity-card",
    description: "أنشطة ورحلات وفعاليات طلابية ينظمها ملتقى الطالب الجامعي.",
    order: "created_at.desc",
    schema: "Event",
    titleField: "title",
    textField: "description",
    detailField: "details",
    activeField: "is_active",
    changefreq: "weekly",
    priority: "0.85"
  },
  courses: {
    label: "الدورات",
    singular: "دورة",
    table: "courses",
    path: "/courses",
    mainAnchor: "/#courses",
    icon: "fa-solid fa-book-open-reader",
    color: "#1E88E5",
    gridClass: "courses-grid",
    cardClass: "course-card",
    description: "دورات تدريبية وتطويرية للطلاب والمهتمين بمختلف المجالات.",
    order: "created_at.desc",
    schema: "Course",
    titleField: "title",
    textField: "description",
    detailField: "details",
    activeField: "is_active",
    changefreq: "weekly",
    priority: "0.85"
  },
  committees: {
    label: "لجان الملتقى",
    singular: "لجنة",
    table: "committees",
    path: "/committees",
    mainAnchor: "/#committees",
    icon: "fa-solid fa-sitemap",
    color: "#1565C0",
    gridClass: "committees-grid",
    cardClass: "committee-card",
    description: "تعرف على لجان ملتقى الطالب الجامعي وأدوارها وروابطها.",
    order: "sort_order.asc",
    schema: "Organization",
    titleField: "name",
    textField: "description",
    detailField: "description",
    activeField: "is_active",
    changefreq: "monthly",
    priority: "0.75"
  },
  achievements: {
    label: "إنجازات الملتقى",
    singular: "إنجاز",
    table: "achievements",
    path: "/achievements",
    mainAnchor: "/#achievements",
    icon: "fa-solid fa-trophy",
    color: "#0288D1",
    gridClass: "achievements-grid",
    cardClass: "achievement-story-card",
    description: "إنجازات ملتقى الطالب الجامعي موثقة بالصور والتفاصيل والتواريخ.",
    order: "sort_order.asc,achievement_date.desc,created_at.desc",
    schema: "Article",
    titleField: "title",
    textField: "description",
    detailField: "details",
    activeField: "is_active",
    changefreq: "monthly",
    priority: "0.80"
  },
  initiatives: {
    label: "المبادرات الطلابية",
    singular: "مبادرة",
    table: "student_initiatives",
    path: "/initiatives",
    mainAnchor: "/#initiatives",
    icon: "fa-solid fa-hand-holding-heart",
    color: "#0B7FAB",
    gridClass: "activities-grid",
    cardClass: "initiative-card",
    description: "مبادرات طلابية ومقترحات تطوعية وخيرية وتعليمية يديرها ملتقى الطالب الجامعي.",
    order: "sort_order.asc,initiative_date.desc,created_at.desc",
    schema: "Article",
    titleField: "title",
    textField: "description",
    detailField: "details",
    activeField: "is_active",
    changefreq: "weekly",
    priority: "0.80"
  },
  events: {
    label: "الفعاليات القادمة",
    singular: "فعالية",
    table: "events",
    path: "/events",
    mainAnchor: "/#timeline",
    icon: "fa-solid fa-calendar-days",
    color: "#1976D2",
    gridClass: "timeline-wrap",
    cardClass: "timeline-card",
    description: "جدول الفعاليات القادمة والأنشطة المجدولة للطلاب.",
    order: "event_date.asc",
    schema: "Event",
    titleField: "title",
    textField: "location",
    detailField: "location",
    activeField: "is_active",
    changefreq: "weekly",
    priority: "0.80"
  }
};

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function escapeXml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(value = "") {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value = "", length = 155) {
  const text = stripHtml(value);
  if (text.length <= length) return text;
  return text.slice(0, length - 1).trim() + "…";
}

function isoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function absoluteUrl(path = "/") {
  if (String(path).startsWith("http")) return path;
  return SITE_URL + (String(path).startsWith("/") ? path : "/" + path);
}

function titleOf(row = {}, section = {}) {
  return row[section.titleField] || row.title || row.name || row.category || row.status || "عنصر";
}

function textOf(row = {}, section = {}) {
  return row[section.textField] || row[section.detailField] || row.description || row.details || row.location || row.title || row.name || "";
}

function detailOf(row = {}, section = {}) {
  return row[section.detailField] || row.description || row.details || row.location || row.title || row.name || "";
}

function parseImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
    return value.split(/\n|,|\|/).map(x => x.trim()).filter(Boolean);
  }
  return [];
}

function imageOf(row = {}) {
  if (row.image_url) return absoluteUrl(row.image_url);
  const gallery = parseImages(row.gallery_images);
  if (gallery.length) return absoluteUrl(gallery[0]);
  return DEFAULT_IMAGE;
}

function urlFor(sectionKey, row) {
  const section = SECTIONS[sectionKey];
  if (!section || !row || !row.id) return SITE_URL + "/";
  return `${SITE_URL}${section.path}/${encodeURIComponent(row.id)}`;
}

function responseHeaders(contentType = "text/html; charset=utf-8", cache = "s-maxage=300, stale-while-revalidate=3600") {
  return {
    "Content-Type": contentType,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
}

async function supabaseSelect(table, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_KEY in Vercel Environment Variables");
  }

  const params = new URLSearchParams();
  params.set("select", options.select || "*");

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, value);
    }
  }

  if (options.order) params.set("order", options.order);
  if (options.limit) params.set("limit", String(options.limit));

  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;

  const result = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json"
    }
  });

  const body = await result.text();

  if (!result.ok) {
    throw new Error(`Supabase error ${result.status}: ${body}`);
  }

  try {
    return JSON.parse(body);
  } catch (_) {
    return [];
  }
}

function navHtml(activePath = "") {
  // ناف مطابق للموقع الرئيسي، مع إضافة المبادرات والفعاليات في الأسفل.
  const links = [
    ["الرئيسية", "/", "fa-solid fa-house"],
    ["الأخبار", "/news", "fa-solid fa-newspaper"],
    ["الأنشطة", "/activities", "fa-solid fa-calendar-check"],
    ["الدورات", "/courses", "fa-solid fa-book-open-reader"],
    ["اللجان", "/committees", "fa-solid fa-sitemap"],
    ["المبادرات", "/initiatives", "fa-solid fa-hand-holding-heart"],
    ["الفعاليات", "/events", "fa-solid fa-calendar-days"]
  ];

  const topLinks = links.map(([label, href, icon]) => {
    const active = activePath === href ? "active" : "";
    return `<a class="${active}" href="${href}"><i class="${icon}"></i> ${escapeHtml(label)}</a>`;
  }).join("");

  const bottomLinks = [
    ["الرئيسية", "/", "fa-solid fa-house"],
    ["الأخبار", "/news", "fa-solid fa-newspaper"],
    ["الدورات", "/courses", "fa-solid fa-book-open-reader"],
    ["المبادرات", "/initiatives", "fa-solid fa-hand-holding-heart"],
    ["الفعاليات", "/events", "fa-solid fa-calendar-days"],
    ["اللجان", "/committees", "fa-solid fa-sitemap"]
  ].map(([label, href, icon]) => {
    const active = activePath === href ? "active" : "";
    return `<a class="${active}" href="${href}"><i class="${icon}"></i><span>${escapeHtml(label)}</span></a>`;
  }).join("");

  return `
<header class="topbar">
  <nav class="nav">
    <a class="brand" href="/">
      <div class="brand-logo">
        <img src="/logo.png" alt="ملتقى الطالب الجامعي" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
        <div class="brand-fallback"><i class="fa-solid fa-graduation-cap"></i></div>
      </div>
      <div class="brand-text">
        <strong>ملتقى الطالب الجامعي</strong>
        <span>جامعة العلوم والتكنولوجيا</span>
      </div>
    </a>
    <div class="nav-links">${topLinks}</div>
    <div class="nav-actions">
      <a class="btn btn-dark" href="/#issues"><i class="fa-solid fa-paper-plane"></i> تواصل معنا</a>
    </div>
  </nav>
</header>
<nav class="bottom-nav" style="grid-template-columns:repeat(6,1fr);">${bottomLinks}</nav>`;
}


function htmlLayout({ title, description, canonical, image, activePath, body, schema }) {
  const safeTitle = escapeAttr(title || SITE_NAME);
  const safeDescription = escapeAttr(truncate(description || DEFAULT_DESCRIPTION, 170));
  const safeCanonical = escapeAttr(canonical || SITE_URL + "/");
  const safeImage = escapeAttr(image || DEFAULT_IMAGE);
  const baseWebSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "ملتقى الطالب الجامعي",
    "alternateName": [
      "ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
      "USF UST",
      "University Student Forum"
    ],
    "url": SITE_URL + "/"
  };
  const jsonLd = schema
    ? `<script type="application/ld+json">${JSON.stringify(baseWebSiteSchema)}</script>\n  <script type="application/ld+json">${JSON.stringify(schema)}</script>`
    : `<script type="application/ld+json">${JSON.stringify(baseWebSiteSchema)}</script>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0B5ED7" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${safeCanonical}" />
  <!-- Favicons + App Icons -->
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest" />
  <meta property="og:locale" content="ar_AR" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeCanonical}" />
  <meta property="og:image" content="${safeImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css" />
  <link rel="stylesheet" href="/assets/usf-main-style.css" />
  ${jsonLd}
</head>
<body>
  <div class="bg-orb"><span></span><span></span></div>
  ${navHtml(activePath)}
  ${body}
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <div class="footer-logo"><img src="/logo.png" alt="ملتقى الطالب الجامعي" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=&quot;fa-solid fa-graduation-cap&quot;></i>'"></div>
        <div><strong>ملتقى الطالب الجامعي</strong><br><span>جامعة العلوم والتكنولوجيا</span></div>
      </div>
      <a class="btn btn-soft" href="/"><i class="fa-solid fa-house"></i> العودة للرئيسية</a>
    </div>
  </footer>
</body>
</html>`;
}

function errorPage(message = "الصفحة غير موجودة") {
  return htmlLayout({
    title: "الصفحة غير موجودة | ملتقى الطالب الجامعي",
    description: message,
    canonical: SITE_URL + "/404",
    activePath: "",
    body: `<main class="hero"><div class="container"><div class="hero-content"><div class="hero-badge"><i class="fa-solid fa-triangle-exclamation"></i> 404</div><h1>${escapeHtml(message)}</h1><p>الرابط قد يكون غير صحيح أو تم حذف العنصر من قاعدة البيانات.</p><div class="hero-actions"><a class="btn btn-dark" href="/"><i class="fa-solid fa-house"></i> العودة للرئيسية</a></div></div></div></main>`
  });
}

module.exports = {
  SITE_URL, SUPABASE_URL, SUPABASE_KEY, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SECTIONS,
  escapeHtml, escapeAttr, escapeXml, stripHtml, truncate, isoDate, absoluteUrl,
  titleOf, textOf, detailOf, parseImages, imageOf, urlFor,
  responseHeaders, supabaseSelect, htmlLayout, errorPage
};
