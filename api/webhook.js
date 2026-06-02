// api/webhook.js
// Dynamic Telegram Webhook for UST Central Scientific Committee Bot.
// CommonJS - no type: module.

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res, status, data) {
  return res.status(status).json(data);
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
  if (!response.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

function keyboard(rows) {
  return {
    keyboard: rows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function chunk(items, size = 2) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

async function sendText(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

async function sendMenu(chatId, text, buttons) {
  return sendText(chatId, text, keyboard(buttons));
}

async function getSettings() {
  const rows = await supabase("bot_settings?select=*&limit=1");
  return rows[0] || {
    bot_title: "بوت اللجنة العلمية المركزية",
    welcome_text: "مرحباً بك في بوت اللجنة العلمية المركزية 👋\nاختر من القائمة بالأسفل.",
    empty_text: "لا توجد محتويات حالياً في هذا القسم.",
    home_button_text: "رجوع للرئيسية",
    is_maintenance: false,
    maintenance_text: "البوت تحت الصيانة حالياً."
  };
}

async function upsertUser(message) {
  if (!message || !message.chat) return;
  const from = message.from || {};
  const chatId = message.chat.id;

  try {
    await supabase("bot_users?on_conflict=chat_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify({
        chat_id: chatId,
        first_name: from.first_name || null,
        last_name: from.last_name || null,
        username: from.username || null,
        language_code: from.language_code || null,
        messages_count: 1,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error("User upsert error", e.message);
  }
}

async function logActivity(chatId, action, details = {}) {
  try {
    await supabase("bot_activity_logs", {
      method: "POST",
      body: JSON.stringify({ chat_id: chatId, action, details })
    });
  } catch (e) {
    console.error("Activity log error", e.message);
  }
}

async function getState(chatId) {
  const rows = await supabase(`bot_user_states?chat_id=eq.${chatId}&select=*&limit=1`);
  return rows[0] || null;
}

async function setState(chatId, data = {}) {
  return supabase("bot_user_states?on_conflict=chat_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: JSON.stringify({
      chat_id: chatId,
      current_node_id: data.current_node_id || null,
      path_titles: data.path_titles || [],
      updated_at: new Date().toISOString()
    })
  });
}

async function clearState(chatId) {
  return supabase(`bot_user_states?chat_id=eq.${chatId}`, { method: "DELETE" });
}

async function getRootNodes() {
  return supabase("bot_nodes?parent_id=is.null&is_active=eq.true&select=*&order=sort_order.asc,created_at.asc");
}

async function getChildNodes(parentId) {
  return supabase(`bot_nodes?parent_id=eq.${parentId}&is_active=eq.true&select=*&order=sort_order.asc,created_at.asc`);
}

async function getNode(nodeId) {
  const rows = await supabase(`bot_nodes?id=eq.${nodeId}&select=*&limit=1`);
  return rows[0] || null;
}

async function getActiveContents(nodeId) {
  return supabase(`bot_contents?node_id=eq.${nodeId}&is_active=eq.true&select=*&order=is_pinned.desc,sort_order.asc,created_at.desc`);
}

function buttonTitle(node) {
  return `${node.emoji ? node.emoji + " " : ""}${node.title}`;
}

async function showHome(chatId, settings) {
  await clearState(chatId);
  const roots = await getRootNodes();
  if (!roots.length) {
    return sendText(chatId, "لا توجد قوائم مضافة حالياً من لوحة التحكم.");
  }
  const rows = chunk(roots.map(buttonTitle), 2);
  await sendMenu(chatId, settings.welcome_text || "اختر من القائمة:", rows);
}

async function showNode(chatId, node, settings) {
  const children = await getChildNodes(node.id);
  const contents = await getActiveContents(node.id);

  const rows = [];
  if (children.length) rows.push(...chunk(children.map(buttonTitle), 2));
  if (contents.length) rows.push(["📦 عرض المحتوى"]);
  rows.push([settings.home_button_text || "رجوع للرئيسية"]);

  const text = `<b>${buttonTitle(node)}</b>\n${node.subtitle || "اختر من القائمة بالأسفل."}`;
  await sendMenu(chatId, text, rows);
  await setState(chatId, { current_node_id: node.id, path_titles: [node.title] });
}

async function sendContent(chatId, nodeId, settings) {
  const contents = await getActiveContents(nodeId);
  if (!contents.length) {
    await sendText(chatId, settings.empty_text || "لا توجد محتويات حالياً في هذا القسم.");
    return;
  }

  await sendText(chatId, `📦 جاري إرسال ${contents.length} عنصر...`);

  for (const item of contents) {
    const header = `<b>${item.title}</b>${item.description ? "\n" + item.description : ""}`;

    if (item.source_type === "text" || item.content_type === "text") {
      await sendText(chatId, header + (item.text_content ? "\n\n" + item.text_content : ""));
    } else if (item.source_type === "external_link" || item.external_url) {
      await sendText(chatId, `${header}\n\n🔗 ${item.external_url}`);
    } else if (item.source_type === "telegram_copy" && item.channel_id && item.message_id) {
      await sendText(chatId, header);
      const copied = await telegram("copyMessage", {
        chat_id: chatId,
        from_chat_id: item.channel_id,
        message_id: item.message_id,
        protect_content: false
      });
      if (!copied.ok) {
        await sendText(chatId, `تعذر إرسال هذا العنصر:\n${copied.description || "Unknown Telegram error"}`);
      } else {
        await supabase(`bot_contents?id=eq.${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            downloads_count: Number(item.downloads_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
        }).catch(() => null);
      }
    }
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();
  if (!text) return;

  await upsertUser(message);
  const settings = await getSettings();

  if (settings.is_maintenance) {
    await sendText(chatId, settings.maintenance_text || "البوت تحت الصيانة حالياً.");
    return;
  }

  const homeText = settings.home_button_text || "رجوع للرئيسية";

  if (text === "/start" || text === homeText || text === "الرئيسية" || text === "🏠 الرئيسية") {
    await logActivity(chatId, "start", { text });
    return showHome(chatId, settings);
  }

  const state = await getState(chatId);
  const currentNodeId = state?.current_node_id || null;

  if (text === "📦 عرض المحتوى" && currentNodeId) {
    await logActivity(chatId, "send_content", { node_id: currentNodeId });
    return sendContent(chatId, currentNodeId, settings);
  }

  // Find by displayed title under current parent, then root.
  const candidates = currentNodeId ? await getChildNodes(currentNodeId) : await getRootNodes();
  let node = candidates.find(n => buttonTitle(n) === text || n.title === text);

  if (!node) {
    const roots = await getRootNodes();
    node = roots.find(n => buttonTitle(n) === text || n.title === text);
  }

  if (node) {
    await logActivity(chatId, "open_node", { node_id: node.id, title: node.title });
    return showNode(chatId, node, settings);
  }

  await sendText(chatId, "اختر من الأزرار بالأسفل 👇");
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("UST Central Scientific Committee Telegram Bot is running.");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (SECRET_TOKEN && telegramSecret !== SECRET_TOKEN) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const update = req.body;
    if (update.message) await handleMessage(update.message);
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return send(res, 200, { ok: false, error: error.message });
  }
};
