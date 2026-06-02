const { readJson, requireAdmin, supabase, json } = require("../_utils.js");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

    const body = await readJson(req);
    if (!requireAdmin(req, res, body)) return;

    const id = Number(body.id);
    if (!id) return json(res, 400, { ok: false, error: "file id is required" });

    const updated = await supabase(`bot_files?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: Boolean(body.is_active) })
    });

    return json(res, 200, { ok: true, file: updated?.[0] });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
}
