# حزمة SEO كاملة بنفس تصميم الموقع الرئيسي

## ماذا تحتوي الحزمة؟

- index.html
- robots.txt
- site.webmanifest
- 404.html
- vercel.json
- api/_seo-utils.js
- api/section-page.js
- api/seo-page.js
- api/sitemap.js
- api/feed.js

## ما الذي تفعله؟

تعطيك صفحات ديناميكية بنفس روح وتصميم الموقع الرئيسي:

- /news
- /news/:id
- /activities
- /activities/:id
- /courses
- /courses/:id
- /committees
- /committees/:id
- /achievements
- /achievements/:id
- /events
- /events/:id
- /sitemap.xml
- /feed.xml

## مهم

احذف ملف sitemap.xml الثابت إذا كان موجودًا؛ لأن /sitemap.xml الآن يأتي من api/sitemap.js.

## متغيرات Vercel المطلوبة

SITE_URL=https://usf-flax.vercel.app

SUPABASE_URL=https://bvkcfdagsfmqrhyqspan.supabase.co

SUPABASE_ANON_KEY=ضع مفتاح Supabase العام

إذا RLS يمنع قراءة البيانات:
SUPABASE_SERVICE_ROLE_KEY=ضع service role داخل Vercel فقط

لا تضع service role داخل index.html أبدًا.

## بعد النشر اختبر

https://usf-flax.vercel.app/news
https://usf-flax.vercel.app/courses
https://usf-flax.vercel.app/activities
https://usf-flax.vercel.app/events
https://usf-flax.vercel.app/sitemap.xml
https://usf-flax.vercel.app/feed.xml

## ملاحظة

كل صفحة قسم وكل صفحة تفاصيل مصممة بنفس ألوان، هيدر، كروت، أزرار، وخلفية الموقع الرئيسي.
