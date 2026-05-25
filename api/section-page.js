const { SITE_URL, SECTIONS, STATIC_PAGES, headers, escapeHtml, safeText, truncate, urlFor, supabaseSelect, baseLayout } = require('./_seo-utils');

module.exports = async function handler(req, res) {
  const sectionKey = String(req.query.section || '').replace(/[^a-z_]/g, '');
  if (sectionKey === 'about') {
    const title = 'عن ملتقى الطالب الجامعي | جامعة العلوم والتكنولوجيا';
    const description = 'تعرف على ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا وأهدافه وأنشطته وخدماته للطلاب.';
    const body = `<section class="hero"><h1>${title}</h1><p class="desc">${description}</p><div class="nav">${STATIC_PAGES.map(p => `<a href="${p.loc}">${escapeHtml(p.label)}</a>`).join('')}</div><div class="content">ملتقى الطالب الجامعي منصة طلابية تهدف إلى خدمة الطلاب، نشر الأخبار، عرض الدورات والفعاليات، والتعريف باللجان والأنشطة الطلابية داخل جامعة العلوم والتكنولوجيا.</div></section>`;
    res.writeHead(200, headers());
    return res.end(baseLayout({ title, description, canonical: `${SITE_URL}/about`, body, schema: { '@context':'https://schema.org', '@type':'AboutPage', name:title, url:`${SITE_URL}/about`, description } }));
  }
  if (sectionKey === 'issues') {
    const title = 'الشكاوى والمقترحات | ملتقى الطالب الجامعي';
    const description = 'صفحة الشكاوى والمقترحات وخدمات الطلاب في ملتقى الطالب الجامعي.';
    const body = `<section class="hero"><h1>${title}</h1><p class="desc">${description}</p><div class="nav">${STATIC_PAGES.map(p => `<a href="${p.loc}">${escapeHtml(p.label)}</a>`).join('')}</div><div class="content">يمكن للطلاب إرسال الشكاوى والمقترحات من خلال الموقع الرئيسي ليتم متابعتها من الجهات المختصة.</div></section>`;
    res.writeHead(200, headers());
    return res.end(baseLayout({ title, description, canonical: `${SITE_URL}/issues`, body, schema: { '@context':'https://schema.org', '@type':'ContactPage', name:title, url:`${SITE_URL}/issues`, description } }));
  }

  const section = SECTIONS[sectionKey];
  if (!section) {
    res.writeHead(404, headers());
    return res.end('Not found');
  }

  let rows = [];
  try {
    rows = await supabaseSelect(section.table, { active: section.active, order: section.order, limit: 500 });
  } catch (error) {
    console.error(error.message);
  }

  const title = `${section.label} | ملتقى الطالب الجامعي`;
  const description = `استعرض ${section.label} في ملتقى الطالب الجامعي بجامعة العلوم والتكنولوجيا، ويتم تحديث هذه الصفحة تلقائيًا من قاعدة البيانات.`;
  const canonical = `${SITE_URL}${section.url}`;

  const items = (rows || []).map((row, index) => {
    const name = safeText(row[section.titleField], section.label);
    const desc = truncate(row[section.descField] || row.details || row.location || name, 145);
    return `<a class="item" href="${urlFor(sectionKey, row)}">
      <span class="tag">${escapeHtml(section.label)}</span>
      <h2>${escapeHtml(name)}</h2>
      <p>${escapeHtml(desc)}</p>
    </a>`;
  }).join('') || `<div class="item"><h2>لا توجد عناصر منشورة حاليًا</h2><p>عند إضافة عناصر ظاهرة في قاعدة البيانات ستظهر هنا تلقائيًا.</p></div>`;

  const body = `<section class="hero">
    <h1>${escapeHtml(title)}</h1>
    <p class="desc">${escapeHtml(description)}</p>
    <div class="nav">${STATIC_PAGES.map(p => `<a href="${p.loc}">${escapeHtml(p.label)}</a>`).join('')}</div>
    <div class="grid">${items}</div>
  </section>`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: (rows || []).slice(0, 100).map((row, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: safeText(row[section.titleField], section.label),
        url: urlFor(sectionKey, row)
      }))
    }
  };

  res.writeHead(200, headers());
  res.end(baseLayout({ title, description, canonical, body, schema }));
};
