const { adminGuard, fail, ok, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { id, is_active } = req.body || {};
    if (!id) return fail(res, 400, "id is required");

    const rows = await supabaseRequest(`bot_files?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: Boolean(is_active), updated_at: new Date().toISOString() })
    });

    return ok(res, { file: rows[0] });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
