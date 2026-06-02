// api/admin/[action].js
// CommonJS single-function API for Vercel Hobby plan.
// This file replaces many admin API files so the deployment stays under the Serverless Functions limit.

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function send(res, status, data) {
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
    return { ok: false, message: "ADMIN_PASSWORD is missing in Vercel Environment Variables" };
  }
  if (password !== ADMIN_PASSWORD) {
    return { ok: false, message: "Unauthorized" };
  }
  return { ok: true };
}

async function telegram(method, data = {}) {
  if (!BOT_TOKEN) return { ok: false, description: "BOT_TOKEN is missing" };
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return response.json();
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(msg || `Supabase error ${response.status}`);
  }
  return data;
}

function encodeFilter(value) {
  return encodeURIComponent(String(value ?? ""));
}

function parseTelegramMessageLink(link) {
  if (!link) return null;
  const text = String(link).trim();

  // Private channel link: https://t.me/c/3917305732/3 => -1003917305732 / 3
  let match = text.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (match) {
    return { channel_id: `-100${match[1]}`, message_id: Number(match[2]) };
  }

  // Public channel username link: https://t.me/channelname/25
  match = text.match(/t\.me\/([A-Za-z0-9_]+)\/(\d+)/);
  if (match) {
    return { channel_username: `@${match[1]}`, message_id: Number(match[2]) };
  }

  return null;
}

async function health(req, res) {
  const result = {
    ok: true,
    message: "Admin API is working",
    action: "health",
    env: {
      BOT_TOKEN: Boolean(BOT_TOKEN),
      SUPABASE_URL: Boolean(SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      ADMIN_PASSWORD: Boolean(ADMIN_PASSWORD)
    },
    telegram: { ok: false, message: "not checked" },
    supabase: { ok: false, message: "not checked" },
    time: new Date().toISOString()
  };

  try {
    const bot = await telegram("getMe");
    result.telegram = bot.ok
      ? { ok: true, bot: { id: bot.result.id, username: bot.result.username, first_name: bot.result.first_name } }
      : { ok: false, message: bot.description || "Telegram getMe failed" };
  } catch (e) {
    result.telegram = { ok: false, message: e.message };
  }

  try {
    const data = await supabase("bot_settings?select=id&limit=1");
    result.supabase = { ok: true, data };
  } catch (e) {
    result.supabase = { ok: false, message: e.message };
  }

  return send(res, 200, result);
}

async function dashboard(req, res) {
  const [channels, nodes, contents, users, logs] = await Promise.all([
    supabase("bot_channels?select=id,is_active"),
    supabase("bot_nodes?select=id,node_type,is_active,parent_id"),
    supabase("bot_contents?select=id,content_type,is_active,node_id,downloads_count"),
    supabase("bot_users?select=chat_id,last_seen"),
    supabase("bot_activity_logs?select=id&order=created_at.desc&limit=10")
  ]);

  const stats = {
    channels: channels.length,
    active_channels: channels.filter(x => x.is_active !== false).length,
    nodes: nodes.length,
    root_nodes: nodes.filter(x => !x.parent_id).length,
    contents: contents.length,
    active_contents: contents.filter(x => x.is_active !== false).length,
    users: users.length,
    downloads: contents.reduce((sum, x) => sum + Number(x.downloads_count || 0), 0),
    recent_logs: logs.length
  };

  return send(res, 200, { ok: true, stats });
}

async function listChannels(req, res) {
  if (req.method === "GET") {
    const channels = await supabase("bot_channels?select=*&order=sort_order.asc,created_at.desc");
    return send(res, 200, { ok: true, channels });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title || !body.channel_id) {
      return send(res, 400, { ok: false, message: "اسم القناة و Channel ID مطلوبان" });
    }

    const row = await supabase("bot_channels", {
      method: "POST",
      body: JSON.stringify({
        title: body.title,
        channel_id: body.channel_id,
        username: body.username || null,
        description: body.description || null,
        sort_order: Number(body.sort_order || 0),
        is_active: body.is_active === false ? false : true,
        updated_at: new Date().toISOString()
      })
    });

    return send(res, 200, { ok: true, channel: row[0] });
  }

  return send(res, 405, { ok: false, message: "Method Not Allowed" });
}

async function updateChannel(req, res) {
  const body = req.body || {};
  if (!body.id) return send(res, 400, { ok: false, message: "id is required" });
  const row = await supabase(`bot_channels?id=eq.${body.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: body.title,
      channel_id: body.channel_id,
      username: body.username || null,
      description: body.description || null,
      sort_order: Number(body.sort_order || 0),
      is_active: body.is_active === false ? false : true,
      updated_at: new Date().toISOString()
    })
  });
  return send(res, 200, { ok: true, channel: row[0] });
}

async function deleteChannel(req, res) {
  const body = req.body || {};
  const id = body.id || req.query.id;
  if (!id) return send(res, 400, { ok: false, message: "id is required" });
  await supabase(`bot_channels?id=eq.${id}`, { method: "DELETE" });
  return send(res, 200, { ok: true, message: "تم حذف القناة" });
}

async function listNodes(req, res) {
  if (req.method === "GET") {
    const nodes = await supabase("bot_nodes?select=*&order=sort_order.asc,created_at.asc");
    return send(res, 200, { ok: true, nodes });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title) return send(res, 400, { ok: false, message: "اسم العنصر مطلوب" });

    const row = await supabase("bot_nodes", {
      method: "POST",
      body: JSON.stringify({
        parent_id: body.parent_id || null,
        title: body.title,
        subtitle: body.subtitle || null,
        node_type: body.node_type || "custom",
        icon: body.icon || "fa-solid fa-folder",
        emoji: body.emoji || null,
        color: body.color || null,
        sort_order: Number(body.sort_order || 0),
        is_active: body.is_active === false ? false : true,
        updated_at: new Date().toISOString()
      })
    });

    return send(res, 200, { ok: true, node: row[0] });
  }

  return send(res, 405, { ok: false, message: "Method Not Allowed" });
}

async function updateNode(req, res) {
  const body = req.body || {};
  if (!body.id) return send(res, 400, { ok: false, message: "id is required" });

  const row = await supabase(`bot_nodes?id=eq.${body.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      parent_id: body.parent_id || null,
      title: body.title,
      subtitle: body.subtitle || null,
      node_type: body.node_type || "custom",
      icon: body.icon || "fa-solid fa-folder",
      emoji: body.emoji || null,
      color: body.color || null,
      sort_order: Number(body.sort_order || 0),
      is_active: body.is_active === false ? false : true,
      updated_at: new Date().toISOString()
    })
  });

  return send(res, 200, { ok: true, node: row[0] });
}

async function deleteNode(req, res) {
  const body = req.body || {};
  const id = body.id || req.query.id;
  if (!id) return send(res, 400, { ok: false, message: "id is required" });
  await supabase(`bot_nodes?id=eq.${id}`, { method: "DELETE" });
  return send(res, 200, { ok: true, message: "تم حذف العنصر" });
}

async function listContents(req, res) {
  if (req.method === "GET") {
    const contents = await supabase("bot_contents?select=*&order=sort_order.asc,created_at.desc");
    return send(res, 200, { ok: true, contents });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title || !body.node_id) {
      return send(res, 400, { ok: false, message: "العنوان والمكان داخل البوت مطلوبان" });
    }

    let finalChannelId = body.channel_id || null;
    let finalMessageId = body.message_id ? Number(body.message_id) : null;

    if (body.telegram_link) {
      const parsed = parseTelegramMessageLink(body.telegram_link);
      if (!parsed) {
        return send(res, 400, { ok: false, message: "رابط تليجرام غير صحيح. مثال: https://t.me/c/3917305732/3" });
      }
      finalChannelId = parsed.channel_id || finalChannelId;
      finalMessageId = parsed.message_id || finalMessageId;
    }

    const row = await supabase("bot_contents", {
      method: "POST",
      body: JSON.stringify({
        node_id: body.node_id,
        channel_id: finalChannelId,
        title: body.title,
        description: body.description || null,
        content_type: body.content_type || "file",
        source_type: body.source_type || "telegram_copy",
        message_id: finalMessageId,
        telegram_link: body.telegram_link || null,
        external_url: body.external_url || null,
        text_content: body.text_content || null,
        tags: Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",").map(x => x.trim()).filter(Boolean),
        sort_order: Number(body.sort_order || 0),
        is_pinned: body.is_pinned === true,
        is_active: body.is_active === false ? false : true,
        updated_at: new Date().toISOString()
      })
    });

    return send(res, 200, { ok: true, content: row[0] });
  }

  return send(res, 405, { ok: false, message: "Method Not Allowed" });
}

async function updateContent(req, res) {
  const body = req.body || {};
  if (!body.id) return send(res, 400, { ok: false, message: "id is required" });

  let finalChannelId = body.channel_id || null;
  let finalMessageId = body.message_id ? Number(body.message_id) : null;

  if (body.telegram_link) {
    const parsed = parseTelegramMessageLink(body.telegram_link);
    if (parsed) {
      finalChannelId = parsed.channel_id || finalChannelId;
      finalMessageId = parsed.message_id || finalMessageId;
    }
  }

  const row = await supabase(`bot_contents?id=eq.${body.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      node_id: body.node_id,
      channel_id: finalChannelId,
      title: body.title,
      description: body.description || null,
      content_type: body.content_type || "file",
      source_type: body.source_type || "telegram_copy",
      message_id: finalMessageId,
      telegram_link: body.telegram_link || null,
      external_url: body.external_url || null,
      text_content: body.text_content || null,
      tags: Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",").map(x => x.trim()).filter(Boolean),
      sort_order: Number(body.sort_order || 0),
      is_pinned: body.is_pinned === true,
      is_active: body.is_active === false ? false : true,
      updated_at: new Date().toISOString()
    })
  });

  return send(res, 200, { ok: true, content: row[0] });
}

async function deleteContent(req, res) {
  const body = req.body || {};
  const id = body.id || req.query.id;
  if (!id) return send(res, 400, { ok: false, message: "id is required" });
  await supabase(`bot_contents?id=eq.${id}`, { method: "DELETE" });
  return send(res, 200, { ok: true, message: "تم حذف المحتوى" });
}

async function listUsers(req, res) {
  const users = await supabase("bot_users?select=*&order=last_seen.desc&limit=300");
  return send(res, 200, { ok: true, users });
}

async function listLogs(req, res) {
  const logs = await supabase("bot_activity_logs?select=*&order=created_at.desc&limit=200");
  return send(res, 200, { ok: true, logs });
}

async function settings(req, res) {
  if (req.method === "GET") {
    let rows = await supabase("bot_settings?select=*&limit=1");
    if (!rows.length) {
      rows = await supabase("bot_settings", {
        method: "POST",
        body: JSON.stringify({
          bot_title: "بوت اللجنة العلمية المركزية",
          welcome_text: "مرحباً بك في بوت اللجنة العلمية المركزية 👋\nاختر من القائمة بالأسفل.",
          empty_text: "لا توجد محتويات حالياً في هذا القسم.",
          footer_text: "اللجنة العلمية المركزية - جامعة العلوم والتكنولوجيا",
          home_button_text: "رجوع للرئيسية",
          is_maintenance: false
        })
      });
    }
    return send(res, 200, { ok: true, settings: rows[0] });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const current = await supabase("bot_settings?select=id&limit=1");
    const payload = {
      bot_title: body.bot_title || "بوت اللجنة العلمية المركزية",
      welcome_text: body.welcome_text || "",
      empty_text: body.empty_text || "لا توجد محتويات حالياً في هذا القسم.",
      footer_text: body.footer_text || "",
      home_button_text: body.home_button_text || "رجوع للرئيسية",
      is_maintenance: body.is_maintenance === true,
      maintenance_text: body.maintenance_text || "البوت تحت الصيانة حالياً.",
      updated_at: new Date().toISOString()
    };

    let row;
    if (current.length) {
      row = await supabase(`bot_settings?id=eq.${current[0].id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    } else {
      row = await supabase("bot_settings", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    return send(res, 200, { ok: true, settings: row[0] });
  }

  return send(res, 405, { ok: false, message: "Method Not Allowed" });
}

async function seed(req, res) {
  // Safe seed data for the scientific bot. It will not delete anything.
  const existing = await supabase("bot_nodes?select=id&limit=1");
  if (existing.length) {
    return send(res, 200, { ok: true, message: "توجد بيانات مسبقاً، لم يتم إضافة بيانات تجريبية." });
  }

  const roots = await supabase("bot_nodes", {
    method: "POST",
    body: JSON.stringify([
      { title: "الكليات والتخصصات", node_type: "category", icon: "fa-solid fa-building-columns", emoji: "🏛️", sort_order: 1 },
      { title: "المواد العلمية", node_type: "subject_group", icon: "fa-solid fa-book-medical", emoji: "📚", sort_order: 2 },
      { title: "الدورات والبرامج", node_type: "courses", icon: "fa-solid fa-chalkboard-user", emoji: "🎓", sort_order: 3 },
      { title: "إعلانات اللجنة", node_type: "announcements", icon: "fa-solid fa-bullhorn", emoji: "📢", sort_order: 4 },
      { title: "روابط مهمة", node_type: "links", icon: "fa-solid fa-link", emoji: "🔗", sort_order: 5 }
    ])
  });

  return send(res, 200, { ok: true, message: "تمت إضافة بيانات البداية", roots });
}

async function sendTest(req, res) {
  const body = req.body || {};
  if (!body.chat_id && !body.channel_id) {
    return send(res, 400, { ok: false, message: "chat_id or channel_id is required" });
  }

  const result = await telegram("sendMessage", {
    chat_id: body.chat_id || body.channel_id,
    text: body.text || "✅ اختبار من لوحة تحكم بوت اللجنة العلمية المركزية"
  });

  return send(res, 200, { ok: result.ok, result });
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  try {
    // health can be checked without admin password, but it does not expose secret values.
    if (action === "health") return health(req, res);

    const admin = checkAdmin(req);
    if (!admin.ok) return send(res, 401, { ok: false, message: admin.message });

    if (action === "dashboard") return dashboard(req, res);

    if (action === "channels") return listChannels(req, res);
    if (action === "update-channel") return updateChannel(req, res);
    if (action === "delete-channel") return deleteChannel(req, res);

    if (action === "nodes") return listNodes(req, res);
    if (action === "update-node") return updateNode(req, res);
    if (action === "delete-node") return deleteNode(req, res);

    if (action === "contents") return listContents(req, res);
    if (action === "update-content") return updateContent(req, res);
    if (action === "delete-content") return deleteContent(req, res);

    if (action === "users") return listUsers(req, res);
    if (action === "logs") return listLogs(req, res);
    if (action === "settings") return settings(req, res);
    if (action === "seed") return seed(req, res);
    if (action === "send-test") return sendTest(req, res);

    return send(res, 404, {
      ok: false,
      message: "Admin action not found",
      action,
      available_actions: [
        "health", "dashboard", "channels", "update-channel", "delete-channel",
        "nodes", "update-node", "delete-node",
        "contents", "update-content", "delete-content",
        "users", "logs", "settings", "seed", "send-test"
      ]
    });
  } catch (error) {
    console.error("Admin API Error:", error);
    return send(res, 500, {
      ok: false,
      message: error.message || "حدث خطأ في الطلب",
      action
    });
  }
};
