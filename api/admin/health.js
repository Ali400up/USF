// api/admin/health.js
// CommonJS version - بدون type: module

module.exports = async function handler(req, res) {
  // السماح فقط بـ GET
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const SECRET_TOKEN = process.env.SECRET_TOKEN;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  const result = {
    ok: true,
    message: "Admin health route is working",
    route: "/api/admin/health",
    time: new Date().toISOString(),

    env: {
      BOT_TOKEN: Boolean(BOT_TOKEN),
      SECRET_TOKEN: Boolean(SECRET_TOKEN),
      SUPABASE_URL: Boolean(SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      ADMIN_PASSWORD: Boolean(ADMIN_PASSWORD)
    },

    telegram: {
      ok: false,
      message: "Not checked"
    },

    supabase: {
      ok: false,
      message: "Not checked"
    }
  };

  // فحص Telegram Bot Token
  try {
    if (!BOT_TOKEN) {
      result.telegram = {
        ok: false,
        message: "BOT_TOKEN is missing"
      };
    } else {
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
      );

      const telegramData = await telegramResponse.json();

      if (telegramData.ok) {
        result.telegram = {
          ok: true,
          message: "Telegram bot is working",
          bot: {
            id: telegramData.result.id,
            first_name: telegramData.result.first_name,
            username: telegramData.result.username
          }
        };
      } else {
        result.telegram = {
          ok: false,
          message: telegramData.description || "Telegram check failed"
        };
      }
    }
  } catch (
