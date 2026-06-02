const { adminGuard, fail, ok, telegram } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "Method Not Allowed");

  try {
    const { channel_id, text } = req.body || {};
    if (!channel_id || !text) return fail(res, 400, "channel_id و text مطلوبان");

    const result = await telegram("sendMessage", {
      chat_id: channel_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false
    });

    if (!result.ok) return fail(res, 400, result.description || "Telegram failed");
    return ok(res, { message: "تم الإرسال للقناة", telegram: result.result });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
