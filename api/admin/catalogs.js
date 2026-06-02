const { adminGuard, fail, ok, supabaseRequest, cleanString } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  try {
    if (req.method === "GET") {
      const catalogs = await supabaseRequest("bot_catalogs?select=*&order=item_type.asc,sort_order.asc,created_at.desc");
      return ok(res, { catalogs });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const item_type = cleanString(body.item_type);
      const name = cleanString(body.name);
      if (!item_type || !name) return fail(res, 400, "النوع والاسم مطلوبان");

      const rows = await supabaseRequest("bot_catalogs", {
        method: "POST",
        body: JSON.stringify({
          item_type,
          name,
          display_name: cleanString(body.display_name) || name,
          icon: cleanString(body.icon) || "fa-solid fa-circle-dot",
          color: cleanString(body.color) || "#0B5ED7",
          parent_name: cleanString(body.parent_name) || null,
          sort_order: Number(body.sort_order || 0),
          notes: cleanString(body.notes) || null,
          is_active: body.is_active !== false
        })
      });
      return ok(res, { catalog: rows[0] });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      if (!body.id) return fail(res, 400, "id مطلوب");
      const rows = await supabaseRequest(`bot_catalogs?id=eq.${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          item_type: cleanString(body.item_type),
          name: cleanString(body.name),
          display_name: cleanString(body.display_name) || cleanString(body.name),
          icon: cleanString(body.icon) || "fa-solid fa-circle-dot",
          color: cleanString(body.color) || "#0B5ED7",
          parent_name: cleanString(body.parent_name) || null,
          sort_order: Number(body.sort_order || 0),
          notes: cleanString(body.notes) || null,
          is_active: body.is_active !== false,
          updated_at: new Date().toISOString()
        })
      });
      return ok(res, { catalog: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) return fail(res, 400, "id مطلوب");
      await supabaseRequest(`bot_catalogs?id=eq.${id}`, { method: "DELETE" });
      return ok(res, { deleted: true });
    }

    return fail(res, 405, "Method Not Allowed");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
