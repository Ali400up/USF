const { adminGuard, fail, ok, supabaseRequest, telegram } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

  try {
    const checks = {
      vercel: true,
      supabase: false,
      telegram: false,
      time: new Date().toISOString()
    };

    try {
      await supabaseRequest("bot_files?select=id&limit=1");
      checks.supabase = true;
    } catch (error) {
      checks.supabase_error = error.message;
    }

    try {
      const bot = await telegram("getMe", {});
      checks.telegram = Boolean(bot.ok);
      checks.bot = bot.ok ? bot.result : bot;
    } catch (error) {
      checks.telegram_error = error.message;
    }

    return ok(res, { checks });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
