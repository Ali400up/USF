const { readJson, requireAdmin, supabase, json } = require("../_utils.js");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method Not Allowed" });

    const body = await readJson(req);
    if (!requireAdmin(req, res, body)) return;

    const files = await supabase("bot_files?select=*&order=created_at.desc&limit=500", { method: "GET" });
    return json(res, 200, { ok: true, files });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
