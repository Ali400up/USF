const {
  adminGuard,
  fail,
  normalizeTags,
  ok,
  parseTelegramMessageLink,
  supabaseRequest
} = require("../_utils.js");

function cleanFileBody(body) {
  const parsed = parseTelegramMessageLink(body.telegram_link || "");
  let channel_id = String(body.channel_id || "").trim();
  let message_id = body.message_id ? Number(body.message_id) : null;

  if (parsed?.channel_id) {
    channel_id = parsed.channel_id;
    message_id = parsed.message_id;
  }

  return {
    title: String(body.title || "").trim(),
    description: body.description || null,
    year_name: String(body.year_name || "").trim(),
    term_name: String(body.term_name || "").trim(),
    subject_name: String(body.subject_name || "").trim(),
    section_name: String(body.section_name || "").trim(),
    channel_id,
    message_id,
    telegram_link: body.telegram_link || null,
    file_type: body.file_type || "pdf",
    tags: normalizeTags(body.tags),
    sort_order: Number(body.sort_order || 0),
    is_active: body.is_active !== false,
    updated_at: new Date().toISOString()
  };
}

function validateFile(file) {
  const required = ["title", "year_name", "term_name", "subject_name", "section_name", "channel_id", "message_id"];
  const missing = required.filter(key => !file[key]);
  return missing;
}

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  try {
    if (req.method === "GET") {
      const files = await supabaseRequest("bot_files?select=*&order=created_at.desc");
      return ok(res, { files });
    }

    if (req.method === "POST") {
      const file = cleanFileBody(req.body || {});
      const missing = validateFile(file);

      if (missing.length) {
        return fail(res, 400, `حقول ناقصة: ${missing.join(", ")}`);
      }

      const rows = await supabaseRequest("bot_files", {
        method: "POST",
        body: JSON.stringify(file)
      });

      return ok(res, { file: rows[0] });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      if (!body.id) return fail(res, 400, "id is required");

      const file = cleanFileBody(body);
      const missing = validateFile(file);
      if (missing.length) return fail(res, 400, `حقول ناقصة: ${missing.join(", ")}`);

      const rows = await supabaseRequest(`bot_files?id=eq.${body.id}`, {
        method: "PATCH",
        body: JSON.stringify(file)
      });

      return ok(res, { file: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) return fail(res, 400, "id is required");
      await supabaseRequest(`bot_files?id=eq.${id}`, { method: "DELETE" });
      return ok(res, { deleted: true });
    }

    return res.status(405).send("Method Not Allowed");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
