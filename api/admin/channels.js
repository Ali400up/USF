const { adminGuard, fail, ok, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  try {
    if (req.method === "GET") {
      const channels = await supabaseRequest("bot_channels?select=*&order=created_at.desc");
      return ok(res, { channels });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const title = String(body.title || "").trim();
      const channel_id = String(body.channel_id || "").trim();

      if (!title || !channel_id) {
        return fail(res, 400, "اسم القناة و Channel ID مطلوبان");
      }

      const rows = await supabaseRequest("bot_channels", {
        method: "POST",
        body: JSON.stringify({
          title,
          channel_id,
          username: body.username || null,
          category: body.category || "main",
          color: body.color || "#2563eb",
          icon: body.icon || "fa-solid fa-broadcast-tower",
          notes: body.notes || null,
          is_active: body.is_active !== false
        })
      });

      return ok(res, { channel: rows[0] });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      if (!body.id) return fail(res, 400, "id is required");

      const rows = await supabaseRequest(`bot_channels?id=eq.${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: body.title,
          channel_id: body.channel_id,
          username: body.username || null,
          category: body.category || "main",
          color: body.color || "#2563eb",
          icon: body.icon || "fa-solid fa-broadcast-tower",
          notes: body.notes || null,
          is_active: body.is_active !== false,
          updated_at: new Date().toISOString()
        })
      });

      return ok(res, { channel: rows[0] });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || req.body?.id;
      if (!id) return fail(res, 400, "id is required");
      await supabaseRequest(`bot_channels?id=eq.${id}`, { method: "DELETE" });
      return ok(res, { deleted: true });
    }

    return res.status(405).send("Method Not Allowed");
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
