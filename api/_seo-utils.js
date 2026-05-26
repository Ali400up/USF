// api/_seo-utils.js
// أدوات مشتركة لتوليد صفحات SEO بنفس روح تصميم الموقع الرئيسي

const SITE_URL = (process.env.SITE_URL || "https://usf-flax.vercel.app").replace(/\/+$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://bvkcfdagsfmqrhyqspan.supabase.co").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

const SITE_NAME = "ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا";
const DEFAULT_DESCRIPTION = "الموقع الرسمي لملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا: الأخبار، الأنشطة، الدورات، اللجان، الإنجازات، الفعاليات وخدمات الطلاب.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

const SECTIONS = {
  news: {
    label: "آخر الأخبار",
    singular: "خبر",
    table: "tv_news",
    path: "/news",
    icon: "fa-solid fa-newspaper",
    color: "#0B5ED7",
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
    icon: "fa-solid fa-calendar-check",
    color: "#0096C7",
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
    icon: "fa-solid fa-book-open-reader",
    color: "#1E88E5",
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
    icon: "fa-solid fa-sitemap",
    color: "#1565C0",
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
    label: "الإنجازات",
    singular: "إنجاز",
    table: "achievements",
    path: "/achievements",
    icon: "fa-solid fa-trophy",
    color: "#0288D1",
    description: "أبرز إنجازات وأرقام ملتقى الطالب الجامعي.",
    order: "sort_order.asc",
    schema: "Article",
    titleField: "title",
    textField: "value",
    detailField: "title",
    activeField: "is_active",
    changefreq: "monthly",
    priority: "0.70"
  },
  events: {
    label: "الفعاليات القادمة",
    singular: "فعالية",
    table: "events",
    path: "/events",
    icon: "fa-solid fa-calendar-days",
    color: "#1976D2",
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
    if (value.includes(",")) return value.split(",").map(x => x.trim()).filter(Boolean);
    return [value];
  }
  return [];
}

function imageOf(row = {}, sectionKey = "") {
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

function sectionUrl(sectionKey) {
  const section = SECTIONS[sectionKey];
  return section ? `${SITE_URL}${section.path}` : SITE_URL + "/";
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

function navHtml(active = "") {
  const links = [
    ["الرئيسية", "/", "fa-solid fa-house"],
    ["الأخبار", "/news", "fa-solid fa-newspaper"],
    ["الأنشطة", "/activities", "fa-solid fa-calendar-check"],
    ["الدورات", "/courses", "fa-solid fa-book-open-reader"],
    ["اللجان", "/committees", "fa-solid fa-sitemap"],
    ["الفعاليات", "/events", "fa-solid fa-calendar-days"]
  ];

  const topLinks = links.map(([label, href, icon]) => {
    const isActive = active && href.includes(active);
    return `<a class="${isActive ? "active" : ""}" href="${href}"><i class="${icon}"></i> ${escapeHtml(label)}</a>`;
  }).join("");

  const bottom = links.slice(0, 5).map(([label, href, icon]) => {
    const isActive = active && href.includes(active);
    return `<a class="${isActive ? "active" : ""}" href="${href}"><i class="${icon}"></i><span>${escapeHtml(label)}</span></a>`;
  }).join("");

  return `
<header class="topbar">
  <nav class="nav" aria-label="التنقل الرئيسي">
    <a class="brand" href="/">
      <span class="brand-logo"><img src="/logo.png" alt="شعار ملتقى الطالب الجامعي" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="brand-fallback"><i class="fa-solid fa-graduation-cap"></i></span></span>
      <span class="brand-text"><strong>ملتقى الطالب الجامعي</strong><span>جامعة العلوم والتكنولوجيا</span></span>
    </a>
    <div class="nav-links">${topLinks}</div>
    <div class="nav-actions">
      <a class="btn btn-dark" href="/#issues"><i class="fa-solid fa-paper-plane"></i> تواصل معنا</a>
    </div>
  </nav>
</header>
<nav class="bottom-nav" aria-label="تنقل الهاتف">${bottom}</nav>`;
}

const pageCss = `
:root{
  --primary:#0B5ED7;--primary-dark:#063B8F;--primary-soft:#1E88E5;--primary-light:#64B5F6;
  --bg:#EEF7FF;--bg2:#DDEEFF;--white:#fff;--text:#07213F;--muted:#58728F;
  --border:rgba(11,94,215,.14);--border2:rgba(11,94,215,.25);
  --glass:rgba(255,255,255,.82);--glass2:rgba(255,255,255,.96);
  --shadow:0 22px 70px rgba(11,94,215,.14);--shadow2:0 35px 95px rgba(11,94,215,.24);
  --ease:cubic-bezier(.2,.8,.2,1);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:96px}
body{min-height:100vh;font-family:"Cairo","Tajawal",sans-serif;color:var(--text);overflow-x:hidden;background:radial-gradient(circle at 12% 8%,rgba(11,94,215,.18),transparent 28%),radial-gradient(circle at 85% 0%,rgba(30,136,229,.18),transparent 32%),radial-gradient(circle at 45% 80%,rgba(100,181,246,.18),transparent 30%),linear-gradient(135deg,#EEF7FF,#fff 48%,#DDEEFF)}
a{text-decoration:none;color:inherit}img{max-width:100%;display:block}.container{width:min(1180px,calc(100% - 28px));margin-inline:auto}
.bg-orb{position:fixed;inset:0;z-index:-2;overflow:hidden;pointer-events:none}.bg-orb span{position:absolute;width:360px;height:360px;border-radius:50%;filter:blur(28px);opacity:.22;background:var(--primary-soft);animation:orb 14s var(--ease) infinite alternate}.bg-orb span:nth-child(1){top:80px;right:-130px}.bg-orb span:nth-child(2){bottom:120px;left:-140px;background:var(--primary-light);animation-delay:1.5s}@keyframes orb{to{transform:translate3d(42px,-38px,0) scale(1.12)}}
.topbar{position:fixed;top:14px;right:0;left:0;z-index:1000}.nav{width:min(1180px,calc(100% - 22px));height:74px;margin:auto;padding:0 12px 0 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--border);border-radius:999px;background:var(--glass);backdrop-filter:blur(24px);box-shadow:0 16px 55px rgba(11,94,215,.12);transition:.35s var(--ease)}
.brand{display:flex;align-items:center;gap:10px;min-width:0}.brand-logo{width:54px;height:54px;flex:0 0 54px;padding:6px;border-radius:20px;overflow:hidden;background:linear-gradient(var(--white),var(--white)) padding-box,linear-gradient(135deg,var(--primary),var(--bg),var(--primary-soft)) border-box;border:2px solid transparent;box-shadow:0 14px 34px rgba(11,94,215,.22)}.brand-logo img{width:100%;height:100%;object-fit:contain;border-radius:15px}.brand-fallback{width:100%;height:100%;display:none;place-items:center;border-radius:15px;color:var(--bg);background:linear-gradient(135deg,var(--primary-soft),var(--primary))}.brand-text{display:grid;gap:2px;min-width:0}.brand-text strong{color:var(--primary);font-size:17px;line-height:1.2;font-weight:900;white-space:nowrap}.brand-text span{color:var(--muted);font-size:11px;font-weight:800;white-space:nowrap}
.nav-links{display:flex;align-items:center;gap:2px;color:var(--muted);font-size:13px;font-weight:900}.nav-links a{display:inline-flex;align-items:center;gap:6px;padding:10px;border-radius:999px;transition:.28s var(--ease)}.nav-links a:hover,.nav-links a.active{color:var(--primary);background:rgba(11,94,215,.08)}.nav-actions{display:flex;align-items:center;gap:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 19px;border:0;border-radius:999px;cursor:pointer;font-size:14px;font-weight:900;transition:.32s var(--ease);white-space:nowrap}.btn-dark{color:var(--bg);background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F);box-shadow:0 18px 42px rgba(11,94,215,.24)}.btn-light{color:#0B5ED7;background:linear-gradient(135deg,#EEF7FF,#fff);border:1px solid rgba(11,94,215,.15);box-shadow:0 14px 34px rgba(11,94,215,.12)}.btn-soft{color:#0B5ED7;background:rgba(11,94,215,.08);border:1px solid rgba(11,94,215,.16)}.btn:hover{transform:translateY(-4px)}
.hero-mini{padding:138px 0 54px}.hero-card{position:relative;overflow:hidden;padding:34px;border-radius:42px;color:#fff;background:radial-gradient(circle at 18% 14%,rgba(255,255,255,.26),transparent 24%),linear-gradient(135deg,var(--section-color,#0B5ED7),#0B5ED7 58%,#063B8F);box-shadow:var(--shadow2)}
.hero-card:before{content:"";position:absolute;inset:auto -80px -110px auto;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.14)}
.hero-kicker{display:inline-flex;align-items:center;gap:9px;margin-bottom:12px;padding:9px 13px;border-radius:999px;background:rgba(255,255,255,.14);font-weight:900;font-size:13px}.hero-card h1{position:relative;z-index:1;font-size:clamp(31px,5vw,58px);line-height:1.25;font-weight:900;margin-bottom:10px}.hero-card p{position:relative;z-index:1;max-width:790px;color:rgba(255,255,255,.86);font-size:16px;line-height:2;font-weight:800}.hero-actions{position:relative;z-index:1;display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
section{position:relative;padding:44px 0}.section-header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:24px}.section-kicker{display:inline-flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--section-color,var(--primary));font-size:14px;font-weight:900}.section-kicker:before{content:"";width:30px;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--section-color,var(--primary)),var(--primary-light))}.section-title{max-width:720px;font-size:clamp(28px,4vw,46px);line-height:1.35;font-weight:900}.section-desc{max-width:560px;color:var(--muted);font-size:15px;line-height:2;font-weight:700}
.cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:17px}.content-card{border:1px solid rgba(11,94,215,.14);border-radius:26px;background:var(--glass);backdrop-filter:blur(20px);box-shadow:0 22px 70px rgba(11,94,215,.13);transition:.35s var(--ease);overflow:hidden;display:flex;flex-direction:column;min-height:100%}.content-card:hover{transform:translateY(-8px);box-shadow:0 35px 95px rgba(11,94,215,.22)}
.cover{height:175px;display:flex;align-items:flex-end;padding:19px;position:relative;overflow:hidden;color:var(--bg);background:radial-gradient(circle at 18% 20%,rgba(255,255,255,.22),transparent 25%),linear-gradient(135deg,var(--section-color,var(--primary-soft)),var(--primary) 58%,var(--primary-dark))}.cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}.cover h3{position:relative;z-index:1;display:flex;align-items:center;gap:10px;font-size:22px;line-height:1.5;font-weight:900;text-shadow:0 10px 28px rgba(0,0,0,.25)}
.card-body{padding:21px;display:flex;flex-direction:column;flex:1}.card-body p{margin-bottom:16px;color:var(--muted);font-size:14px;line-height:1.9;font-weight:700}.tags{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px}.tag{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;color:var(--section-color,var(--primary));background:rgba(11,94,215,.08);font-size:12px;font-weight:900}.card-actions{display:flex;gap:9px;margin-top:auto}.card-actions .btn{width:100%;justify-content:center}
.empty-state{grid-column:1/-1;padding:32px;text-align:center;border:1px dashed var(--border2);border-radius:26px;color:var(--muted);background:var(--glass);font-weight:900;line-height:2}
.detail-layout{display:grid;grid-template-columns:1.05fr .95fr;gap:18px;align-items:start}.detail-box,.side-box{border:1px solid rgba(11,94,215,.14);border-radius:34px;background:var(--glass);box-shadow:var(--shadow);backdrop-filter:blur(20px);padding:24px}.detail-box h2{font-size:clamp(25px,3vw,40px);line-height:1.45;font-weight:900;margin-bottom:12px;color:var(--text)}.detail-text{white-space:pre-line;color:var(--muted);font-size:15px;line-height:2.15;font-weight:800}.detail-image{width:100%;max-height:460px;object-fit:cover;border-radius:30px;border:1px solid var(--border);box-shadow:0 22px 60px rgba(11,94,215,.18);margin-bottom:16px}.detail-meta{display:grid;gap:10px}.meta-item{display:flex;align-items:center;gap:9px;padding:12px 13px;border-radius:18px;background:rgba(11,94,215,.07);color:var(--muted);font-weight:900}.meta-item i{color:var(--section-color,var(--primary))}
.gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}.gallery img{height:170px;width:100%;object-fit:cover;border-radius:22px;border:1px solid var(--border)}
.footer{padding:42px 0 92px;border-top:1px solid var(--border);background:rgba(255,255,255,.34);backdrop-filter:blur(16px);margin-top:42px}.footer-inner{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;color:var(--muted);font-weight:800;line-height:1.8}.footer-inner strong{color:var(--primary);font-weight:900}
.bottom-nav{position:fixed;right:12px;bottom:12px;left:12px;z-index:1100;display:none;grid-template-columns:repeat(5,1fr);gap:6px;padding:8px;border:1px solid var(--border);border-radius:25px;background:var(--glass2);backdrop-filter:blur(22px);box-shadow:var(--shadow2)}.bottom-nav a{display:grid;place-items:center;gap:4px;min-height:50px;border-radius:18px;color:var(--muted);font-size:10px;font-weight:900}.bottom-nav a i{font-size:18px}.bottom-nav a.active{color:#0B5ED7;background:rgba(11,94,215,.10)}
@media(max-width:1080px){.nav-links{display:none}.cards-grid{grid-template-columns:repeat(2,1fr)}.detail-layout{grid-template-columns:1fr}.section-header{display:grid}}
@media(max-width:760px){.container,.nav{width:min(100% - 20px,1180px)}.topbar{top:10px}.nav{height:66px;padding-inline:10px}.brand-logo{width:48px;height:48px;flex-basis:48px}.brand-text strong{max-width:155px;overflow:hidden;text-overflow:ellipsis;font-size:14px}.brand-text span,.nav-actions{display:none}.hero-mini{padding:96px 0 28px}.hero-card{padding:24px 18px;border-radius:32px;text-align:center}.hero-card h1{font-size:clamp(29px,9vw,42px)}.hero-card p{font-size:14px}.hero-actions{display:grid;grid-template-columns:1fr}.hero-actions .btn{width:100%;min-height:56px;border-radius:23px}.cards-grid{grid-template-columns:1fr}.cover{height:160px}.section-title{font-size:28px}.bottom-nav{display:grid}.footer{padding-bottom:104px}.footer-inner{grid-template-columns:1fr;text-align:center}.gallery{grid-template-columns:1fr}.gallery img{height:220px}.detail-box,.side-box{padding:18px;border-radius:28px}}
`;

function htmlLayout({ title, description, canonical, image, active, body, schema, color }) {
  const safeTitle = escapeAttr(title || SITE_NAME);
  const safeDescription = escapeAttr(truncate(description || DEFAULT_DESCRIPTION, 170));
  const safeCanonical = escapeAttr(canonical || SITE_URL + "/");
  const safeImage = escapeAttr(image || DEFAULT_IMAGE);
  const jsonLd = schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : "";

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
  <link rel="icon" href="/logo.png" type="image/png" />
  <link rel="apple-touch-icon" href="/logo.png" />
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
  ${jsonLd}
  <style>${pageCss}</style>
</head>
<body style="--section-color:${escapeAttr(color || "#0B5ED7")}">
  <div class="bg-orb"><span></span><span></span></div>
  ${navHtml(active)}
  ${body}
  <footer class="footer">
    <div class="container footer-inner">
      <div>
        <strong>ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا</strong>
        <div>منصة طلابية للأخبار والدورات والأنشطة واللجان والفعاليات.</div>
      </div>
      <a class="btn btn-soft" href="/"><i class="fa-solid fa-house"></i> العودة للرئيسية</a>
    </div>
  </footer>
</body>
</html>`;
}

function notFoundPage(message = "الصفحة غير موجودة") {
  return htmlLayout({
    title: "الصفحة غير موجودة | ملتقى الطالب الجامعي",
    description: message,
    canonical: SITE_URL + "/404",
    active: "",
    body: `<main class="hero-mini"><div class="container"><div class="hero-card"><span class="hero-kicker"><i class="fa-solid fa-triangle-exclamation"></i> 404</span><h1>${escapeHtml(message)}</h1><p>الرابط قد يكون غير صحيح أو تم حذف العنصر من قاعدة البيانات.</p><div class="hero-actions"><a class="btn btn-light" href="/"><i class="fa-solid fa-house"></i> العودة للرئيسية</a></div></div></div></main>`,
    color: "#D32F2F"
  });
}

module.exports = {
  SITE_URL, SUPABASE_URL, SUPABASE_KEY, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SECTIONS,
  escapeHtml, escapeAttr, escapeXml, stripHtml, truncate, isoDate, absoluteUrl,
  titleOf, textOf, detailOf, parseImages, imageOf, urlFor, sectionUrl,
  responseHeaders, supabaseSelect, htmlLayout, notFoundPage
};
