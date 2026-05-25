const { SITE_URL, SECTIONS, headers, escapeHtml, safeText, truncate, imageOf, urlFor, supabaseSelect, baseLayout } = require('./_seo-utils');

function schemaFor(type, section, row, canonical, title, description, image) {
  const base = { '@context': 'https://schema.org', '@type': section.schema || 'Article', name: title, headline: title, description, url: canonical, image };
  if (section.schema === 'NewsArticle') {
    base.datePublished = row.created_at || new Date().toISOString();
    base.dateModified = row.updated_at || row.created_at || new Date().toISOString();
    base.author = { '@type':'Organization', name:'ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا' };
    base.publisher = { '@type':'Organization', name:'ملتقى الطالب الجامعي - جامعة العلوم والتكنولوجيا', logo:{ '@type':'ImageObject', url:`${SITE_URL}/logo.png` } };
  }
  if (section.schema === 'Course') {
    base['@type'] = 'Course';
    base.provider = { '@type':'CollegeOrUniversity', name:'جامعة العلوم والتكنولوجيا', sameAs: SITE_URL };
  }
  if (section.schema === 'Event') {
    base['@type'] = 'Event';
    base.startDate = row.event_date || row.activity_date || row.created_at || new Date().toISOString();
    base.eventStatus = 'https://schema.org/EventScheduled';
    base.eventAttendanceMode = 'https://schema.org/MixedEventAttendanceMode';
    base.location = { '@type':'Place', name: safeText(row.location, 'جامعة العلوم والتكنولوجيا') };
  }
  return base;
}

module.exports = async function handler(req, res) {
  const type = String(req.query.type || '').replace(/[^a-z_]/g, '');
  const id = String(req.query.id || '').trim();
  const section = SECTIONS[type];
  if (!section || !id) {
    res.writeHead(404, headers());
    return res.end('Not found');
  }

  let row;
  try {
    const rows = await supabaseSelect(section.table, { id, active: section.active, limit: 1 });
    row = Array.isArray(rows) ? rows[0] : null;
  } catch (error) {
    console.error(error.message);
  }

  if (!row) {
    res.writeHead(404, headers());
    return res.end(baseLayout({
      title: 'العنصر غير موجود | ملتقى الطالب الجامعي',
      description: 'لم يتم العثور على هذا العنصر أو أنه غير ظاهر حاليًا.',
      canonical: `${SITE_URL}${section.url}`,
      body: `<section class="hero"><h1>العنصر غير موجود</h1><p class="desc">قد يكون الرابط غير صحيح أو تم إخفاء العنصر من لوحة التحكم.</p><a class="btn" href="${section.url}">العودة إلى ${escapeHtml(section.label)}</a></section>`
    }));
  }

  const title = safeText(row[section.titleField], section.label);
  const description = truncate(row[section.descField] || row.details || row.ticker || row.location || title, 160);
  const canonical = urlFor(type, row);
  const image = imageOf(row, section.imageField);
  const longText = safeText(row.details || row.description || row.ticker || row.location || title);

  const body = `<section class="hero">
    <span class="tag">${escapeHtml(section.label)}</span>
    <h1>${escapeHtml(title)}</h1>
    <p class="desc">${escapeHtml(description)}</p>
    ${image ? `<img class="cover" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />` : ''}
    <div class="content">${escapeHtml(longText)}</div>
    <div class="nav"><a href="${section.url}">المزيد من ${escapeHtml(section.label)}</a><a href="/">فتح الموقع الرئيسي</a></div>
  </section>`;

  const schema = schemaFor(type, section, row, canonical, title, description, image);
  res.writeHead(200, headers());
  res.end(baseLayout({ title: `${title} | ملتقى الطالب الجامعي`, description, canonical, image, body, schema }));
};
