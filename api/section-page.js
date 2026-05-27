// api/section-page.js
// صفحات الأقسام العامة:
// لا نعيد تصميم الأقسام هنا، بل نعرض نفس index.html الأصلي ونخفي كل شيء إلا القسم المطلوب.
// لذلك /news هو واجهة الأخبار، و /committees هو كروت اللجان وروابطها، وهكذا.

const fs = require("fs");
const path = require("path");

const SITE_URL = (process.env.SITE_URL || "https://usf-flax.vercel.app").replace(/\/+$/, "");

const SECTION_MAP = {
  news: {
    id: "latest-news",
    path: "/news",
    title: "آخر الأخبار | ملتقى الطالب الجامعي",
    description: "آخر أخبار الملتقى وما يهم الطالب أولًا."
  },
  activities: {
    id: "activities",
    path: "/activities",
    title: "الأنشطة والرحلات | ملتقى الطالب الجامعي",
    description: "أنشطة الملتقى وبرامجه الطلابية."
  },
  courses: {
    id: "courses",
    path: "/courses",
    title: "الدورات | ملتقى الطالب الجامعي",
    description: "دورات تصنع مهارة وفرصة بالواجهة العامة."
  },
  committees: {
    id: "committees",
    path: "/committees",
    title: "لجان الملتقى | ملتقى الطالب الجامعي",
    description: "لجان الملتقى وروابطها الرسمية للطلاب."
  },
  achievements: {
    id: "achievements",
    path: "/achievements",
    title: "الإنجازات | ملتقى الطالب الجامعي",
    description: "إنجازات الملتقى الموثقة."
  },

  initiatives: {
    id: "initiatives",
    path: "/initiatives",
    title: "المبادرات الطلابية | ملتقى الطالب الجامعي",
    description: "المبادرات الطلابية ومقترحات الطلاب."
  },
  events: {
    id: "timeline",
    path: "/events",
    title: "الفعاليات القادمة | ملتقى الطالب الجامعي",
    description: "المواعيد والفعاليات القادمة بتصميم الفعاليات القادمة في الصفحة الرئيسية."
  },
  issues: {
    id: "issues",
    path: "/issues",
    title: "الشكاوى والمقترحات | ملتقى الطالب الجامعي",
    description: "قناة الشكاوى والمقترحات الطلابية."
  },
  about: {
    id: "about",
    path: "/about",
    title: "عن الملتقى | ملتقى الطالب الجامعي",
    description: "التعريف بملتقى الطالب الجامعي."
  },
  goals: {
    id: "goals",
    path: "/goals",
    title: "أهداف الملتقى | ملتقى الطالب الجامعي",
    description: "أهداف ملتقى الطالب الجامعي."
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function findIndexFile() {
  const candidates = [
    path.join(process.cwd(), "index.html"),
    path.join(process.cwd(), "public", "index.html"),
    path.join(__dirname, "..", "index.html")
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }

  throw new Error("index.html not found. ضع index.html في جذر المشروع بجانب vercel.json");
}

function injectSeo(html, section) {
  const title = escapeHtml(section.title);
  const description = escapeHtml(section.description);
  const canonical = `${SITE_URL}${section.path}`;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}" />`);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`);
  html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}" />`);
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}" />`);

  if (!/<meta\s+name=["']robots["']/i.test(html)) {
    html = html.replace("</head>", `  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />\n</head>`);
  }

  return html;
}

function injectCrop(html, key, section) {
  const target = section.id;
  const canonical = `${SITE_URL}${section.path}`;

  const cropCss = `
  <style id="usf-exact-cropped-section-style">
    /* عرض القسم المطلوب فقط */
    body.usf-exact-crop main > section,
    body.usf-exact-crop main > .ticker,
    body.usf-exact-crop .ticker {
      display: none !important;
    }

    body.usf-exact-crop main > section#${target} {
      display: block !important;
      padding-top: 126px !important;
      min-height: calc(100svh - 96px);
    }

    body.usf-exact-crop .reveal {
      opacity: 1 !important;
      transform: none !important;
      transition-delay: 0s !important;
    }

    body.usf-exact-crop .topbar .nav {
      box-shadow: var(--shadow) !important;
    }

    body.usf-exact-crop .footer {
      margin-top: 0 !important;
    }

    body.usf-exact-crop .bottom-nav a[href="#home"] {
      display: grid;
    }

    @media(max-width:760px){
      body.usf-exact-crop main > section#${target} {
        padding-top: 96px !important;
      }
    }
  </style>`;

  const cropScript = `
  <script id="usf-exact-cropped-section-script">
    (function(){
      const sectionKey = ${JSON.stringify(key)};
      const targetId = ${JSON.stringify(target)};
      const sectionPath = ${JSON.stringify(section.path)};
      const mainUrl = "/#" + targetId;

      document.body.classList.add("usf-exact-crop", "usf-exact-crop-" + sectionKey);
      document.body.setAttribute("data-section", sectionKey);

      // اجعل الشعار يرجع للرئيسية بدل #home داخل صفحة القسم.
      document.querySelectorAll(".brand").forEach(a => a.setAttribute("href", "/"));

      // عدّل روابط القائمة حتى لا تذهب إلى أقسام مخفية داخل الصفحة الحالية.
      const pageMap = {
        "#home":"/",
        "#about":"/about",
        "#latest-news":"/news",
        "#activities":"/activities",
        "#courses":"/courses",
        "#committees":"/committees",
        "#achievements":"/achievements",
        "#initiatives":"/initiatives",
        "#issues":"/issues",
        "#timeline":"/events",
        "#goals":"/goals"
      };

      document.querySelectorAll('a[href^="#"]').forEach(a => {
        const old = a.getAttribute("href");
        if (pageMap[old]) a.setAttribute("href", pageMap[old]);
      });

      // فعل رابط القسم الحالي في الهيدر والقائمة السفلية.
      document.querySelectorAll(".nav-links a, .bottom-nav a").forEach(a => {
        const href = a.getAttribute("href") || "";
        if (href === sectionPath || href === mainUrl || href === "/#" + targetId) a.classList.add("active");
        else a.classList.remove("active");
      });

      // اجعل زر موجز الأخبار وروابط اللجان والمودالات تعمل كما هي لأننا لم نغير كود الصفحة الأصلي.
      setTimeout(() => {
        const target = document.getElementById(targetId);
        if (target) window.scrollTo({ top: 0, behavior: "auto" });
      }, 60);
    })();
  </script>`;

  html = html.replace("</head>", `${cropCss}\n</head>`);
  html = html.replace(/<body([^>]*)>/i, `<body$1 class="usf-exact-crop usf-exact-crop-${key}" data-section="${key}">`);
  html = html.replace("</body>", `${cropScript}\n</body>`);

  // أضف structured data بسيط للقسم.
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": section.title,
    "description": section.description,
    "url": canonical,
    "isPartOf": {
      "@type": "WebSite",
      "name": "ملتقى الطالب الجامعي",
      "url": SITE_URL + "/"
    }
  };

  html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`);

  return html;
}

module.exports = async function handler(req, res) {
  try {
    const key = String(req.query.section || "news").trim();
    const section = SECTION_MAP[key];

    if (!section) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>القسم غير موجود</title></head><body><h1>القسم غير موجود</h1><p>هذا القسم غير معرف.</p><a href="/">العودة للرئيسية</a></body></html>`);
      return;
    }

    const indexFile = findIndexFile();
    let html = fs.readFileSync(indexFile, "utf8");

    html = injectSeo(html, section);
    html = injectCrop(html, key, section);

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.end(html);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>خطأ</title></head><body><h1>تعذر تحميل القسم</h1><pre>${escapeHtml(error.message)}</pre></body></html>`);
  }
};
