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
    title: "أخبار ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا",
    description: "آخر أخبار وإعلانات ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا، أخبار الجامعة، التعميمات الطلابية، المستجدات الأكاديمية، الأنشطة، المبادرات، والدورات التي تهم طلاب جامعة العلوم والتكنولوجيا.",
    keywords: "أخبار ملتقى الطالب الجامعي, أخبار جامعة العلوم والتكنولوجيا, جامعة العلوم والتكنولوجيا, USF UST, أخبار الطلاب, إعلانات الجامعة, البوابة الإلكترونية للملتقى"
  },
  activities: {
    id: "activities",
    path: "/activities",
    title: "الأنشطة الطلابية والرحلات | ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
    description: "أنشطة وفعاليات ورحلات ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا، برامج طلابية، فعاليات جامعية، زيارات ميدانية، أنشطة ثقافية وعلمية واجتماعية تخدم طلاب الجامعة.",
    keywords: "الأنشطة الطلابية, فعاليات جامعة العلوم والتكنولوجيا, رحلات طلابية, ملتقى الطالب الجامعي, الأنشطة الجامعية, برامج طلابية"
  },
  courses: {
    id: "courses",
    path: "/courses",
    title: "الدورات التدريبية | ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
    description: "دورات تدريبية وعلمية ومهارية يقدمها ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا لتطوير مهارات الطلاب في المجالات العلمية، التقنية، الإعلامية، الثقافية، والتدريبية.",
    keywords: "دورات جامعة العلوم والتكنولوجيا, دورات ملتقى الطالب الجامعي, دورات تدريبية للطلاب, دورات علمية, تدريب طلابي, جامعة العلوم والتكنولوجيا"
  },
  committees: {
    id: "committees",
    path: "/committees",
    title: "لجان ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا",
    description: "تعرف على لجان ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا: اللجنة العلمية، الإعلامية، الثقافية، الأنشطة، المبادرات، شؤون الطلبة، والتدريب الطلابي وروابطها الرسمية.",
    keywords: "لجان ملتقى الطالب الجامعي, اللجنة العلمية, اللجنة الإعلامية, اللجنة الثقافية, لجنة الأنشطة, لجنة المبادرات, لجنة شؤون الطلبة, لجنة التدريب, جامعة العلوم والتكنولوجيا"
  },
  achievements: {
    id: "achievements",
    path: "/achievements",
    title: "إنجازات ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا",
    description: "إنجازات وأعمال ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا موثقة بالصور والتفاصيل، تشمل إنجازات خدمية، علمية، تدريبية، إعلامية، وثقافية لصالح الطلاب.",
    keywords: "إنجازات ملتقى الطالب الجامعي, إنجازات جامعة العلوم والتكنولوجيا, أعمال الملتقى, مبادرات الطلاب, إنجازات طلابية"
  },

  initiatives: {
    id: "initiatives",
    path: "/initiatives",
    title: "المبادرات الطلابية | ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
    description: "المبادرات الطلابية في ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا، أفكار ومقترحات ومشاريع تطوعية وتعليمية وخدمية تهدف إلى خدمة الطلاب وتطوير البيئة الجامعية.",
    keywords: "المبادرات الطلابية, مبادرات جامعة العلوم والتكنولوجيا, مقترحات طلابية, مشاريع تطوعية, ملتقى الطالب الجامعي"
  },
  events: {
    id: "timeline",
    path: "/events",
    title: "الفعاليات القادمة | ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
    description: "جدول الفعاليات القادمة والبرامج المجدولة لملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا، مواعيد الأنشطة، الدورات، اللقاءات، والفعاليات الطلابية.",
    keywords: "فعاليات جامعة العلوم والتكنولوجيا, الفعاليات القادمة, مواعيد الأنشطة, ملتقى الطالب الجامعي, برامج طلابية"
  },

  join: {
    id: "join",
    path: "/join",
    title: "طلب الانضمام إلى ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا",
    description: "صفحة التسجيل والانضمام إلى ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا للطلاب الراغبين بالعمل في لجان الملتقى: اللجنة العلمية، لجنة المبادرات، لجنة الأنشطة، اللجنة الإعلامية، اللجنة الثقافية، لجنة شؤون الطلبة، ولجنة التدريب الطلابية.",
    keywords: "الانضمام إلى ملتقى الطالب الجامعي, طلب انضمام الملتقى, تسجيل في ملتقى الطالب الجامعي, جامعة العلوم والتكنولوجيا, كود التسجيل, اللجنة العلمية, لجنة المبادرات الطلابية, لجنة الأنشطة الطلابية, اللجنة الإعلامية الطلابية, اللجنة الثقافية الطلابية, لجنة شؤون الطلبة, لجنة التدريب الطلابية"
  },
  issues: {
    id: "issues",
    path: "/issues",
    title: "الشكاوى والمقترحات الطلابية | ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
    description: "صفحة استقبال الشكاوى والمقترحات الطلابية في ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا لمتابعة الإشكالات الطلابية والطلبات والملاحظات ورفعها للجهات المختصة.",
    keywords: "شكاوى الطلاب, مقترحات الطلاب, شؤون الطلبة, إشكالات طلابية, جامعة العلوم والتكنولوجيا, ملتقى الطالب الجامعي"
  },
  about: {
    id: "about",
    path: "/about",
    title: "عن ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا",
    description: "تعريف ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا، رسالته وأدواره في خدمة الطلاب وتنظيم الأنشطة والدورات واللجان والمبادرات الطلابية داخل الجامعة.",
    keywords: "عن ملتقى الطالب الجامعي, جامعة العلوم والتكنولوجيا, USF UST, البوابة الإلكترونية للملتقى, خدمة الطلاب"
  },
  goals: {
    id: "goals",
    path: "/goals",
    title: "أهداف ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا",
    description: "أهداف ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا في خدمة الطالب، تطوير العمل الطلابي، دعم المبادرات، تنظيم الأنشطة، تعزيز التواصل، ومتابعة قضايا الطلاب.",
    keywords: "أهداف ملتقى الطالب الجامعي, أهداف الملتقى, جامعة العلوم والتكنولوجيا, خدمة الطلاب, العمل الطلابي"
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
  const keywords = escapeHtml(section.keywords || "ملتقى الطالب الجامعي, جامعة العلوم والتكنولوجيا, USF UST, البوابة الإلكترونية للملتقى, خدمات الطلاب");

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}" />`);
  html = html.replace(/<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${keywords}" />`);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}" />`);
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}" />`);
  html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}" />`);
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}" />`);

  if (!/<meta\s+name=["']robots["']/i.test(html)) {
    html = html.replace("</head>", `  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />\n</head>`);
  }

  const sectionSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": section.title,
    "description": section.description,
    "url": canonical,
    "inLanguage": "ar",
    "keywords": section.keywords || "ملتقى الطالب الجامعي, جامعة العلوم والتكنولوجيا",
    "audience": { "@type": "Audience", "audienceType": "طلاب جامعة العلوم والتكنولوجيا" },
    "provider": { "@type": "CollegeOrUniversity", "name": "جامعة العلوم والتكنولوجيا" },
    "about": [
      { "@type": "Thing", "name": "ملتقى الطالب الجامعي" },
      { "@type": "Thing", "name": "جامعة العلوم والتكنولوجيا" },
      { "@type": "Thing", "name": section.title }
    ],
    "isPartOf": {
      "@type": "WebSite",
      "name": "ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا",
      "url": SITE_URL + "/"
    }
  };

  html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(sectionSchema)}</script>\n</head>`);

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
        "#join":"/join",
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
