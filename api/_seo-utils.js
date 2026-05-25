const SITE_URL = (process.env.SITE_URL || 'https://usf-flax.vercel.app').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bvkcfdagsfmqrhyqspan.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_3b3QXm3I6MMBqfkRx_m4Yw_98KC6_tr';

const SECTIONS = {
  news: {
    table: 'tv_news', label: 'آخر الأخبار', icon: 'fa-tv', url: '/news', itemUrl: '/news', titleField: 'title', descField: 'description', imageField: 'image_url', dateField: 'created_at', active: true, schema: 'NewsArticle', order: 'sort_order.asc'
  },
  activities: {
    table: 'activities', label: 'الأنشطة والرحلات', icon: 'fa-calendar-check', url: '/activities', itemUrl: '/activities', titleField: 'title', descField: 'description', imageField: 'gallery_images', dateField: 'created_at', active: true, schema: 'Event', order: 'created_at.desc'
  },
  courses: {
    table: 'courses', label: 'الدورات التدريبية', icon: 'fa-book-open-reader', url: '/courses', itemUrl: '/courses', titleField: 'title', descField: 'description', imageField: '', dateField: 'created_at', active: true, schema: 'Course', order: 'created_at.desc'
  },
  committees: {
    table: 'committees', label: 'لجان الملتقى', icon: 'fa-sitemap', url: '/committees', itemUrl: '/committees', titleField: 'name', descField: 'description', imageField: '', dateField: 'sort_order', active: true, schema: 'Organization', order: 'sort_order.asc'
  },
  achievements: {
    table: 'achievements', label: 'الإنجازات', icon: 'fa-trophy', url: '/achievements', itemUrl: '/achievements', titleField: 'title', descField: 'title', imageField: '', dateField: 'sort_order', active: true, schema: 'Article', order: 'sort_order.asc'
  },
  events: {
    table: 'events', label: 'الفعاليات القادمة', icon: 'fa-calendar-days', url: '/events', itemUrl: '/events', titleField: 'title', descField: 'location', imageField: '', dateField: 'event_date', active: true, schema: 'Event', order: 'event_date.asc'
  }
};

const STATIC_PAGES = [
  { loc: '/', label: 'الرئيسية', priority: '1.0' },
  { loc: '/about', label: 'عن الملتقى', priority: '0.8' },
  { loc: '/news', label: 'آخر الأخبار', priority: '0.9' },
  { loc: '/activities', label: 'الأنشطة والرحلات', priority: '0.9' },
  { loc: '/courses', label: 'الدورات التدريبية', priority: '0.9' },
  { loc: '/committees', label: 'لجان الملتقى', priority: '0.8' },
  { loc: '/achievements', label: 'الإنجازات', priority: '0.7' },
  { loc: '/events', label: 'الفعاليات القادمة', priority: '0.8' },
  { loc: '/issues', label: 'الشكاوى والمقترحات', priority: '0.5' }
];

function headers(type = 'text/html; charset=utf-8') {
  return {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    'X-Robots-Tag': 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  };
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeText(value, fallback = '') {
  const v = value === null || value === undefined ? '' : String(value).trim();
  return v || fallback;
}

function stripHtml(value = '') {
  return safeText(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value = '', length = 155) {
  const text = stripHtml(value);
  return text.length > length ? text.slice(0, length - 1).trim() + '…' : text;
}

function imageOf(row, field) {
  if (!field) return `${SITE_URL}/og-image.png`;
  const value = row?.[field];
  if (!value) return `${SITE_URL}/og-image.png`;
  if (Array.isArray(value)) return value[0] || `${SITE_URL}/og-image.png`;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed[0] || `${SITE_URL}/og-image.png`;
    } catch (_) {}
    return value.startsWith('http') ? value : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
  }
  return `${SITE_URL}/og-image.png`;
}

function urlFor(sectionKey, row) {
  const section = SECTIONS[sectionKey];
  const id = encodeURIComponent(row?.id ?? row?.slug ?? row?.[section.titleField] ?? 'item');
  return `${SITE_URL}${section.itemUrl}/${id}`;
}

async function supabaseSelect(table, params = {}) {
  const search = new URLSearchParams();
  search.set('select', params.select || '*');
  if (params.active) search.set('is_active', 'eq.true');
  if (params.id !== undefined && params.id !== null) search.set('id', `eq.${params.id}`);
  if (params.order) search.set('order', params.order);
  if (params.limit) search.set('limit', String(params.limit));
  const url = `${SUPABASE_URL}/rest/v1/${table}?${search.toString()}`;
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase ${table} ${response.status}: ${body}`);
  }
  return response.json();
}

function baseLayout({ title, description, canonical, image, body, schema }) {
  const jsonLd = Array.isArray(schema) ? schema : [schema].filter(Boolean);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0B5ED7" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:locale" content="ar_AR" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(image || `${SITE_URL}/og-image.png`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/logo.png" type="image/png" />
  <link rel="apple-touch-icon" href="/logo.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="alternate" type="application/rss+xml" title="آخر أخبار ملتقى الطالب الجامعي" href="/feed.xml" />
  ${jsonLd.map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join('\n  ')}
  <style>
    :root{--primary:#0B5ED7;--dark:#063B8F;--text:#07213F;--muted:#58728F;--bg:#EEF7FF;--card:#fff;--border:rgba(11,94,215,.16)}
    *{box-sizing:border-box} body{margin:0;font-family:Tahoma,Arial,sans-serif;background:linear-gradient(135deg,#EEF7FF,#fff,#DDEEFF);color:var(--text);line-height:1.9} a{color:inherit;text-decoration:none}.wrap{width:min(1050px,calc(100% - 28px));margin:auto;padding:24px 0 46px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0}.brand{display:flex;align-items:center;gap:10px;font-weight:900;color:var(--primary)}.brand img{width:48px;height:48px;object-fit:contain;border-radius:14px;background:#fff;padding:4px}.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:10px 16px;background:linear-gradient(135deg,#1E88E5,#0B5ED7,#063B8F);color:#fff;font-weight:800}.hero{padding:26px;border:1px solid var(--border);border-radius:30px;background:rgba(255,255,255,.82);box-shadow:0 22px 70px rgba(11,94,215,.13)}h1{font-size:clamp(25px,4vw,44px);line-height:1.35;margin:0 0 10px}.desc{color:var(--muted);font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:18px}.item{display:block;padding:17px;border:1px solid var(--border);border-radius:22px;background:rgba(255,255,255,.86);transition:.2s}.item:hover{transform:translateY(-4px);box-shadow:0 18px 44px rgba(11,94,215,.14)}.tag{display:inline-flex;margin-bottom:7px;padding:5px 10px;border-radius:999px;background:rgba(11,94,215,.08);color:var(--primary);font-size:12px;font-weight:900}.item h2{font-size:19px;line-height:1.5;margin:0 0 6px}.item p{margin:0;color:var(--muted);font-size:14px}.content{white-space:pre-line;margin-top:18px;padding:18px;border:1px solid var(--border);border-radius:24px;background:rgba(255,255,255,.72)}.cover{width:100%;max-height:430px;object-fit:contain;border-radius:24px;background:#061525;margin-top:16px}.nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.nav a{padding:8px 12px;border:1px solid var(--border);border-radius:999px;background:#fff;color:var(--primary);font-weight:800;font-size:13px}@media(max-width:650px){.top{display:grid}.hero{padding:18px;border-radius:24px}}
  </style>
</head>
<body>
  <main class="wrap">
    <div class="top"><a class="brand" href="/"><img src="/logo.png" alt="شعار ملتقى الطالب الجامعي" /> ملتقى الطالب الجامعي</a><a class="btn" href="/">فتح الموقع الرئيسي</a></div>
    ${body}
  </main>
</body>
</html>`;
}

module.exports = {
  SITE_URL,
  SECTIONS,
  STATIC_PAGES,
  headers,
  escapeHtml,
  escapeXml,
  safeText,
  stripHtml,
  truncate,
  imageOf,
  urlFor,
  supabaseSelect,
  baseLayout
};
