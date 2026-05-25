حزمة تحسين ظهور موقع ملتقى الطالب الجامعي في Google
====================================================

الموقع المستهدف:
https://usf-flax.vercel.app/

ما الذي أضفناه؟
----------------
1) index.html محسّن:
   - عنوان ووصف أقوى لمحركات البحث.
   - Open Graph و Twitter Card.
   - روابط sitemap.xml و feed.xml.
   - Schema JSON-LD للموقع، المؤسسة، وأقسام التنقل.
   - روابط noscript تساعد الزاحف والزائر إذا تعطّل JavaScript.

2) robots.txt:
   - يسمح بفهرسة الموقع.
   - يضع رابط sitemap.xml.
   - يمنع زحف صفحات الأدمن غير المهمة لمحركات البحث.

3) site.webmanifest:
   - يجعل أيقونة الموقع واسم التطبيق أفضل على الجوال والأجهزة المختلفة.

4) vercel.json:
   - ينشئ روابط SEO حقيقية للأقسام:
     /news
     /activities
     /courses
     /committees
     /achievements
     /events
     /issues
     /about
   - ينشئ روابط لكل عنصر من قاعدة البيانات مثل:
     /news/ID
     /courses/ID
     /activities/ID

5) مجلد api:
   - /api/sitemap: ينشئ sitemap.xml مباشرة من قاعدة Supabase.
   - /api/section-page: ينشئ صفحة HTML لكل قسم من قاعدة البيانات.
   - /api/seo-page: ينشئ صفحة HTML لكل خبر/دورة/نشاط/فعالية من قاعدة البيانات.
   - /api/feed: ينشئ RSS feed للأخبار.

طريقة التركيب على Vercel
-------------------------
1) افتح مشروعك في محرر الملفات أو GitHub.
2) انسخ الملفات التالية إلى جذر المشروع:
   index.html
   robots.txt
   site.webmanifest
   vercel.json
   404.html
   مجلد api كامل

3) في Vercel > Project Settings > Environment Variables أضف:
   SITE_URL=https://usf-flax.vercel.app
   SUPABASE_URL=https://bvkcfdagsfmqrhyqspan.supabase.co
   SUPABASE_ANON_KEY=ضع المفتاح العام أو publishable key

   إذا كانت RLS تمنع قراءة الجداول من السيرفر، أضف مفتاح الخدمة فقط في Vercel وليس داخل HTML:
   SUPABASE_SERVICE_ROLE_KEY=ضع service role key هنا

   تنبيه مهم: لا تضع service_role داخل index.html أو أي ملف يظهر للزوار.

4) تأكد أن الجداول العامة التي تريد ظهورها في Google يمكن قراءتها:
   tv_news
   activities
   courses
   committees
   achievements
   events

5) بعد النشر جرّب الروابط:
   https://usf-flax.vercel.app/sitemap.xml
   https://usf-flax.vercel.app/news
   https://usf-flax.vercel.app/courses
   https://usf-flax.vercel.app/feed.xml

6) افتح Google Search Console وأضف الموقع ثم أرسل:
   https://usf-flax.vercel.app/sitemap.xml

ملاحظات مهمة
-------------
- Google لا يظهر التغييرات فورًا. عندما تغير شيئًا في قاعدة البيانات سيظهر في صفحات SEO و sitemap مباشرة، لكن ظهوره في نتائج Google يعتمد على وقت إعادة الزحف.
- روابط الأقسام التي تظهر تحت نتيجة الموقع في Google تسمى Sitelinks، ولا يمكن إجبار Google عليها، لكن هذه الحزمة تجعل بنية الموقع أوضح حتى يختارها Google غالبًا مع الوقت.
- إذا أردت ظهور كل خبر أو دورة بعنوان مستقل في Google، الأفضل أن يكون لكل عنصر رابط حقيقي مثل /news/id و /courses/id وهذا ما أضفناه.
