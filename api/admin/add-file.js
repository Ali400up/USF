const { readJson, requireAdmin, supabase, parseTelegramMessageLink, safeKey, json } = require("../_utils.js");

async function getChannel(id) {
  const rows = await supabase(`bot_channels?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

    const body = await readJson(req);
    if (!requireAdmin(req, res, body)) return;

    const channel = await getChannel(body.channel_db_id);
    if (!channel) return json(res, 404, { ok: false, error: "القناة غير موجودة في لوحة التحكم" });

    const parsed = parseTelegramMessageLink(body.message_link || body.message_id);

    if (parsed.channel_id && parsed.channel_id !== channel.channel_id) {
      return json(res, 400, {
        ok: false,
        error: `رابط الرسالة يتبع قناة ${parsed.channel_id} لكنك اخترت ${channel.channel_id}`
      });
    }

    const row = {
      channel_db_id: channel.id,
      channel_id: channel.channel_id,
      message_id: parsed.message_id,
      year_key: safeKey(body.year_key),
      year_label: String(body.year_label || "").trim(),
      term_key: safeKey(body.term_key),
      term_label: String(body.term_label || "").trim(),
      subject_key: safeKey(body.subject_key),
      subject_label: String(body.subject_label || "").trim(),
      section_key: safeKey(body.section_key),
      section_label: String(body.section_label || "").trim(),
      title: String(body.title || "").trim(),
      original_name: String(body.original_name || "").trim() || null,
      mime_type: String(body.mime_type || "").trim() || null,
      telegram_method: "copyMessage",
      sort_order: Number(body.sort_order || 0),
      is_active: true
    };

    for (const key of ["year_label", "term_label", "subject_label", "section_label", "title"]) {
      if (!row[key]) return json(res, 400, { ok: false, error: `الحقل ${key} مطلوب` });
    }

    const inserted = await supabase("bot_files", {
      method: "POST",
      body: JSON.stringify([row])
    });

    return json(res, 200, { ok: true, file: inserted?.[0] });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
