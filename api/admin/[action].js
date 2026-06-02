// api/admin/[action].js
// CommonJS - بدون type: module
// ملف واحد يجمع كل API الخاصة بلوحة التحكم حتى لا تتجاوز حد Vercel Hobby

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function json(res, status, data) {
  return res.status(status).json(data);
}

function getAction(req) {
  if (req.query && req.query.action) {
    return Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;
  }

  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  return parts[parts.length - 1] || "";
}

function checkAdmin(req) {
  const password = req.headers["x-admin-password"];

  if (!ADMIN_PASSWORD) {
    return {
      ok: false,
      message: "ADMIN_PASSWORD is missing in Vercel Environment Variables"
    };
  }

  if (password !== ADMIN_PASSWORD) {
    return {
      ok: false,
      message: "Unauthorized"
    };
  }

  return {
    ok: true
  };
}

async function telegram(method, data = {}) {
  if (!BOT_TOKEN) {
    return {
      ok: false,
      description: "BOT_TOKEN is missing"
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  return response.json();
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }

  return data;
}

function parseTelegramMessageLink(link) {
  if (!link) return null;

  const match = String(link).match(/t\.me\/c\/(\d+)\/(\d+)/);

  if (!match) return null;

  return {
    channel_id: `-100${match[1]}`,
    message_id: Number(match[2])
  };
}

async function handleHealth(req, res) {
  const result = {
    ok: true,
    message: "Admin API is working",
    route: "/api/admin/health",
    time: new Date().toISOString(),
    env: {
      BOT_TOKEN: Boolean(BOT_TOKEN),
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

  try {
    if (!BOT_TOKEN) {
      result.telegram = {
        ok: false,
        message: "BOT_TOKEN is missing"
      };
    } else {
      const bot = await telegram("getMe");

      if (bot.ok) {
        result.telegram = {
          ok: true,
          message: "Telegram bot is working",
          bot: {
            id: bot.result.id,
            first_name: bot.result.first_name,
            username: bot.result.username
          }
        };
      } else {
        result.telegram = {
          ok: false,
          message: bot.description || "Telegram check failed"
        };
      }
    }
  } catch (error) {
    result.telegram = {
      ok: false,
      message: error.message
    };
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      result.supabase = {
        ok: false,
        message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing"
      };
    } else {
      const test = await supabaseRequest("bot_channels?select=id&limit=1");

      result.supabase = {
        ok: true,
        message: "Supabase connection is working",
        test
      };
    }
  } catch (error) {
    result.supabase = {
      ok: false,
      message: error.message
    };
  }

  return json(res, 200, result);
}

async function handleChannels(req, res) {
  if (req.method === "GET") {
    const channels = await supabaseRequest(
      "bot_channels?select=*&order=created_at.desc"
    );

    return json(res, 200, {
      ok: true,
      channels
    });
  }

  if (req.method === "POST") {
    const body = req.body || {};

    if (!body.title || !body.channel_id) {
      return json(res, 400, {
        ok: false,
        message: "اسم القناة و Channel ID مطلوبان"
      });
    }

    const channel = await supabaseRequest("bot_channels", {
      method: "POST",
      body: JSON.stringify({
        title: body.title,
        channel_id: body.channel_id,
        notes: body.notes || null
      })
    });

    return json(res, 200, {
      ok: true,
      channel: channel[0]
    });
  }

  return json(res, 405, {
    ok: false,
    message: "Method Not Allowed"
  });
}

async function handleFiles(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const files = await supabaseRequest(
    "bot_files?select=*&order=sort_order.asc,created_at.desc"
  );

  return json(res, 200, {
    ok: true,
    files
  });
}

async function handleAddFile(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const body = req.body || {};

  let finalChannelId = body.channel_id || null;
  let finalMessageId = body.message_id ? Number(body.message_id) : null;

  if (body.telegram_link) {
    const parsed = parseTelegramMessageLink(body.telegram_link);

    if (!parsed) {
      return json(res, 400, {
        ok: false,
        message: "رابط تليجرام غير صحيح. مثال: https://t.me/c/3917305732/3"
      });
    }

    finalChannelId = parsed.channel_id;
    finalMessageId = parsed.message_id;
  }

  if (
    !body.title ||
    !body.year_name ||
    !body.term_name ||
    !body.subject_name ||
    !body.section_name ||
    !finalChannelId ||
    !finalMessageId
  ) {
    return json(res, 400, {
      ok: false,
      message: "أكمل البيانات الأساسية: العنوان، السنة، الترم، المادة، القسم، القناة، رقم الرسالة"
    });
  }

  const file = await supabaseRequest("bot_files", {
    method: "POST",
    body: JSON.stringify({
      title: body.title,
      description: body.description || null,
      year_name: body.year_name,
      term_name: body.term_name,
      subject_name: body.subject_name,
      section_name: body.section_name,
      channel_id: finalChannelId,
      message_id: finalMessageId,
      telegram_link: body.telegram_link || null,
      file_type: body.file_type || body.content_type || "file",
      sort_order: Number(body.sort_order || 0),
      is_active: body.is_active === false ? false : true
    })
  });

  return json(res, 200, {
    ok: true,
    file: file[0]
  });
}

async function handleToggleFile(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const body = req.body || {};

  if (!body.id) {
    return json(res, 400, {
      ok: false,
      message: "id is required"
    });
  }

  const file = await supabaseRequest(`bot_files?id=eq.${body.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      is_active: Boolean(body.is_active),
      updated_at: new Date().toISOString()
    })
  });

  return json(res, 200, {
    ok: true,
    file: file[0]
  });
}

async function handleDeleteFile(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return json(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const body = req.body || {};
  const id = body.id || req.query.id;

  if (!id) {
    return json(res, 400, {
      ok: false,
      message: "id is required"
    });
  }

  await supabaseRequest(`bot_files?id=eq.${id}`, {
    method: "DELETE"
  });

  return json(res, 200, {
    ok: true,
    message: "تم حذف الملف"
  });
}

async function handleStats(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const channels = await supabaseRequest("bot_channels?select=id");
  const files = await supabaseRequest("bot_files?select=id,is_active,file_type,year_name,subject_name");

  const activeFiles = files.filter(item => item.is_active !== false).length;
  const inactiveFiles = files.filter(item => item.is_active === false).length;

  const years = [...new Set(files.map(item => item.year_name).filter(Boolean))];
  const subjects = [...new Set(files.map(item => item.subject_name).filter(Boolean))];

  return json(res, 200, {
    ok: true,
    stats: {
      channels: channels.length,
      files: files.length,
      active_files: activeFiles,
      inactive_files: inactiveFiles,
      years: years.length,
      subjects: subjects.length
    }
  });
}

async function handleSendTest(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const body = req.body || {};

  if (!body.chat_id && !body.channel_id) {
    return json(res, 400, {
      ok: false,
      message: "chat_id or channel_id is required"
    });
  }

  const target = body.chat_id || body.channel_id;

  const result = await telegram("sendMessage", {
    chat_id: target,
    text: body.text || "✅ اختبار من لوحة تحكم بوت اللجنة العلمية المركزية"
  });

  return json(res, 200, {
    ok: result.ok,
    result
  });
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  try {
    if (action === "health") {
      return handleHealth(req, res);
    }

    const admin = checkAdmin(req);

    if (!admin.ok) {
      return json(res, 401, {
        ok: false,
        message: admin.message
      });
    }

    if (action === "channels") {
      return handleChannels(req, res);
    }

    if (action === "files") {
      return handleFiles(req, res);
    }

    if (action === "add-file") {
      return handleAddFile(req, res);
    }

    if (action === "toggle-file") {
      return handleToggleFile(req, res);
    }

    if (action === "delete-file") {
      return handleDeleteFile(req, res);
    }

    if (action === "stats") {
      return handleStats(req, res);
    }

    if (action === "send-test") {
      return handleSendTest(req, res);
    }

    return json(res, 404, {
      ok: false,
      message: "Admin action not found",
      action,
      available_actions: [
        "health",
        "channels",
        "files",
        "add-file",
        "toggle-file",
        "delete-file",
        "stats",
        "send-test"
      ]
    });
  } catch (error) {
    console.error("Admin API Error:", error);

    return json(res, 500, {
      ok: false,
      message: error.message
    });
  }
};
