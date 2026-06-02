const { readJson, requireAdmin, supabase, json } = require("../_utils.js");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const body = await readJson(req);
      if (!requireAdmin(req, res, body)) return;

      const channels = await supabase("bot_channels?select=*&order=id.desc", { method: "GET" });
      return json(res, 200, { ok: true, channels });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      if (!requireAdmin(req, res, body)) return;

      const channel_title = String(body.channel_title || "").trim();
      const channel_id = String(body.channel_id || "").trim();
      const channel_username = String(body.channel_username || "").trim() || null;
      const description = String(body.description || "").trim() || null;

      if (!channel_title || !channel_id) {
        return json(res, 400, { ok: false, error: "اسم القناة و CHANNEL_ID مطلوبان" });
      }

      const inserted = await supabase("bot_channels", {
        method: "POST",
        body: JSON.stringify([{ channel_title, channel_id, channel_username, description, is_active: true }])
      });

      return json(res, 200, { ok: true, channel: inserted?.[0] });
    }

    return json(res, 405, { ok: false, error: "Method Not Allowed" });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
