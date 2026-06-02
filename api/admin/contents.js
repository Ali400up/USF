const {
  adminGuard,
  fail,
  ok,
  supabaseRequest,
  parseTelegramMessageLink,
  normalizeTags,
  cleanString
} = require("../_utils.js");

function cleanContentBody(body = {}) {
  const parsed = parseTelegramMessageLink(body.telegram_link || "");
  let channel_id = cleanString(body.channel_id);
  let message_id = body.message_id ? Number(body.message_id) : null;

  if (parsed?.channel_id) {
    channel_id = parsed.channel_id;
    message_id = parsed.message_id;
  } else if (parsed?.channel_username) {
    channel_id = parsed.channel_username;
    message_id = parsed.message_id;
  }

  return {
    title: cleanString(body.title),
    description: cleanString(body.description) || null,
    year_name: cleanString(body.year_name) || null,
    term_name: cleanString(body.term_name) || null,
    subject_name: cleanString(body.subject_name) || null,
    section_name: cleanString(body.section_name) || null,
    content_type: cleanString(body.content_type) || "pdf",
    channel_id: channel_id || null,
    message_id: message_id || null,
    telegram_link: cleanString(body.telegram_link) || null,
    external_url: cleanString(body.external_url) || null,
    text_content: cleanString(body.text_content) || null,
    thumbnail_url: cleanString(body.thumbnail_url) || null,
    icon: cleanString(body.icon) || "fa-solid fa-file-lines",
    color: cleanString(body.color) || "#0B5ED7",
    tags: normalizeTags(body.tags),
    sort_order: Number(body.sort_order || 0),
    is_pinned: body.is_pinned === true,
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString()
  };
}

function validateContent(item) {
  const missing = [];
  if (!item.title) missing.push("title");
  if (!item.year_name) missing.push("year_name");
  if (!item.term_name) missing.push("term_name");
  if (!item.subject_name) missing.push("subject_name");
  if (!item.section_name) missing.push("section_name");

  const hasTelegram = item.channel_id && item.message_id;
  const hasUrl = item.external_url;
  const hasText = item.text_content;

  if (!hasTelegram && !hasUrl && !hasText) {
    missing.push("telegram message أو external_url أو text_content");
  }

  return missing;
}

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  try {
    if (req.method === "GET") {
      const contents = await supabaseRequest("bot_contents?select=*&order=is_pinned.desc,sort_order.asc,created_at.desc");
      return ok(res, { contents });
    }

    if (req.method === "POST") {
      const item = cleanContentBody(req.body || {});
      const missing = validateContent(item);
      if (missing.length) return fail(res, 400, `حقول ناقصة: ${missing.join(", ")}`);

      const rows = await supabaseRequest("bot_contents", {
        method: "POST",
        body: JSON.stringify(item)
      });
      return ok(res, { content: rows[0] });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      if (!body.id) return fail(res, 400, "id مطلوب");
      const item = cleanContentBody(body);
      const missing = validateContent(item);
      if (missing.length) return fail(res, 400, `حقول ناقصة: ${missing.join(", ")}`);

      const rows = await supabaseRequest(`bot_contents?id=eq.${body.id}`, {
        method: "PATCH",
        body: JSON.stringify(item)
      });
      return ok(res, { content: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) return fail(res, 400, "id مطلوب");
      await supabaseRequest(`bot_contents?id=eq.${id}`, { method: "DELETE" });
      return ok(res, { deleted: true });
    }

    return fail(res, 405, "Method Not Allowed");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
