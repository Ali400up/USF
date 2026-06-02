const { adminGuard, fail, ok, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "Method Not Allowed");

  try {
    const { id, is_active, is_pinned } = req.body || {};
    if (!id) return fail(res, 400, "id مطلوب");
    const patch = { updated_at: new Date().toISOString() };
    if (typeof is_active === "boolean") patch.is_active = is_active;
    if (typeof is_pinned === "boolean") patch.is_pinned = is_pinned;

    const rows = await supabaseRequest(`bot_contents?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return ok(res, { content: rows[0] });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
