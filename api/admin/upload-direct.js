const { adminGuard, fail, normalizeTags, ok, supabaseRequest } = require("../_utils.js");

const BOT_TOKEN = process.env.BOT_TOKEN;

async function telegramUploadDocument(channelId, fileName, mimeType, buffer, caption) {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

  const form = new FormData();
  form.append("chat_id", channelId);
  form.append("caption", caption || fileName);
  form.append("document", new Blob([buffer], { type: mimeType || "application/octet-stream" }), fileName || "file.pdf");

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: form
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.description || "Telegram upload failed");
  }

  return result.result;
}

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const body = req.body || {};
    const required = ["title", "year_name", "term_name", "subject_name", "section_name", "channel_id", "file_base64", "file_name"];
    const missing = required.filter(key => !body[key]);

    if (missing.length) {
      return fail(res, 400, `حقول ناقصة: ${missing.join(", ")}`);
    }

    const cleanBase64 = String(body.file_base64).split(",").pop();
    const buffer = Buffer.from(cleanBase64, "base64");

    if (buffer.length > 4 * 1024 * 1024) {
      return fail(res, 400, "الملف كبير للرفع المباشر على Vercel. ارفعه داخل القناة ثم الصق رابط الرسالة.");
    }

    const telegramMessage = await telegramUploadDocument(
      body.channel_id,
      body.file_name,
      body.mime_type,
      buffer,
      body.title
    );

    const rows = await supabaseRequest("bot_files", {
      method: "POST",
      body: JSON.stringify({
        title: String(body.title || "").trim(),
        description: body.description || null,
        year_name: String(body.year_name || "").trim(),
        term_name: String(body.term_name || "").trim(),
        subject_name: String(body.subject_name || "").trim(),
        section_name: String(body.section_name || "").trim(),
        channel_id: String(body.channel_id || "").trim(),
        message_id: telegramMessage.message_id,
        telegram_link: null,
        file_type: body.file_type || "pdf",
        tags: normalizeTags(body.tags),
        sort_order: Number(body.sort_order || 0),
        is_active: true
      })
    });

    return ok(res, {
      telegram_message_id: telegramMessage.message_id,
      file: rows[0]
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
