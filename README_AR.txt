# حزمة SEO بنفس تصميم الموقع الرئيسي تمامًا

## الفرق في هذه النسخة

هذه النسخة لا تستخدم تصميمًا جديدًا لصفحات SEO.
تم استخراج CSS الأصلي من index.html ووضعه كما هو في:

assets/usf-main-style.css

ثم كل صفحات /news و /courses و /activities و /events وغيرها تستخدم نفس ملف CSS الأصلي.

## الملفات

- index.html
- assets/usf-main-style.css
- robots.txt
- site.webmanifest
- 404.html
- vercel.json
- api/_seo-utils.js
- api/section-page.js
- api/seo-page.js
- api/sitemap.js
- api/feed.js

## الروابط التي تعمل

/news
/news/:id
/activities
/activities/:id
/courses
/courses/:id
/committees
/committees/:id
/achievements
/achievements/:id
/events
/events/:id
/sitemap.xml
/feed.xml

## مهم

احذف sitemap.xml الثابت إذا كان موجودًا.

## Vercel Environment Variables

SITE_URL=https://usf-flax.vercel.app
SUPABASE_URL=https://bvkcfdagsfmqrhyqspan.supabase.co
SUPABASE_ANON_KEY=مفتاح Supabase العام

إذا RLS يمنع القراءة:
SUPABASE_SERVICE_ROLE_KEY=Service Role Key داخل Vercel فقط
