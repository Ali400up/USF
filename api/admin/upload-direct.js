const { readJson, requireAdmin, supabase, telegramMultipart, safeKey, json } = require("../_utils.js");

const MAX_BASE64_CHARS = 4_000_000; // Keep below Vercel Function request limits after JSON/base64 overhead.

async function getChannel(id) {
  const rows = await supabase(`bot_channels?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: "GET" });
  return rows?.[0] || null;
}

function chooseTelegramMethod(mimeType = "") {
  if (mimeType.startsWith("audio/")) return { method: "sendAudio", field: "audio" };
  if (mimeType.startsWith("image/")) return { method: "sendPhoto", field: "photo" };
  if (mimeType.startsWith("video/")) return { method: "sendVideo", field: "video" };
  return { method: "sendDocument", field: "document" };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

    const body = await readJson(req);
    if (!requireAdmin(req, res, body)) return;

    const channel = await getChannel(body.channel_db_id);
    if (!channel) return json(res, 404, { ok: false, error: "القناة غير موجودة في لوحة التحكم" });

    const fileBase64 = String(body.file_base64 || "");
    if (!fileBase64) return json(res, 400, { ok: false, error: "لم يصل الملف" });
    if (fileBase64.length > MAX_BASE64_CHARS) {
      return json(res, 413, {
        ok: false,
        error: "الملف كبير على الرفع المباشر في Vercel. ارفعه في القناة ثم أضفه من رابط الرسالة."
      });
    }

    const filename = String(body.filename || "file").trim();
    const mimeType = String(body.mime_type || "application/octet-stream").trim();
    const buffer = Buffer.from(fileBase64, "base64");
    const { method, field } = chooseTelegramMethod(mimeType);

    const form = new FormData();
    form.append("chat_id", channel.channel_id);
    form.append("caption", String(body.title || filename).trim());
    form.append(field, new Blob([buffer], { type: mimeType }), filename);

    const sent = await telegramMultipart(method, form);
    const messageId = sent?.result?.message_id;

    const row = {
      channel_db_id: channel.id,
      channel_id: channel.channel_id,
      message_id: messageId,
      year_key: safeKey(body.year_key),
      year_label: String(body.year_label || "").trim(),
      term_key: safeKey(body.term_key),
      term_label: String(body.term_label || "").trim(),
      subject_key: safeKey(body.subject_key),
      subject_label: String(body.subject_label || "").trim(),
      section_key: safeKey(body.section_key),
      section_label: String(body.section_label || "").trim(),
      title: String(body.title || filename).trim(),
      original_name: filename,
      mime_type: mimeType,
      file_size: buffer.length,
      telegram_method: method,
      sort_order: Number(body.sort_order || 0),
      is_active: true
    };

    const inserted = await supabase("bot_files", {
      method: "POST",
      body: JSON.stringify([row])
    });

    return json(res, 200, { ok: true, file: inserted?.[0] });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
