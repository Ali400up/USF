const { adminGuard, ok, fail, telegram, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Method Not Allowed");
  if (!adminGuard(req, res)) return;

  const env = {
    BOT_TOKEN: Boolean(process.env.BOT_TOKEN),
    SECRET_TOKEN: Boolean(process.env.SECRET_TOKEN),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD)
  };

  let telegramCheck = { ok: false, message: "لم يتم الفحص" };
  let supabaseCheck = { ok: false, message: "لم يتم الفحص" };

  try {
    const me = await telegram("getMe", {});
    telegramCheck = me.ok ? { ok: true, bot: me.result } : { ok: false, message: me.description || "Telegram failed" };
  } catch (error) {
    telegramCheck = { ok: false, message: error.message };
  }

  try {
    const rows = await supabaseRequest("bot_channels?select=id&limit=1");
    supabaseCheck = { ok: true, message: "Supabase يعمل", test: rows };
  } catch (error) {
    supabaseCheck = { ok: false, message: error.message };
  }

  return ok(res, {
    message: "Central Scientific Committee Admin API is working",
    route: "/api/admin/health",
    time: new Date().toISOString(),
    env,
    telegram: telegramCheck,
    supabase: supabaseCheck
  });
};
