// api/webhook.js
// UST Central Scientific Committee Telegram Bot
// CommonJS - بدون type: module
// نسخة بدون Cache نهائيًا: كل البيانات تُقرأ مباشرة من Supabase

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, data) {
  return res.status(status).json(data);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function replyKeyboard(rows) {
  return {
    keyboard: rows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

function chunk(items, size = 2) {
  const rows = [];

  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }

  return rows;
}

async function sendText(chatId, text, replyMarkup = null) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

async function sendMenu(chatId, text, buttons) {
  return sendText(chatId, text, replyKeyboard(buttons));
}

function defaultSettings() {
  return {
    bot_title: "بوت اللجنة العلمية المركزية",
    welcome_text: "مرحباً بك في بوت اللجنة العلمية المركزية 👋\nاختر من القائمة بالأسفل.",
    empty_text: "لا توجد محتويات حالياً في هذا القسم.",
    footer_text: "اللجنة العلمية المركزية - جامعة العلوم والتكنولوجيا",
    home_button_text: "رجوع للرئيسية",
    is_maintenance: false,
    maintenance_text: "البوت تحت الصيانة حالياً."
  };
}

// =========================
// Supabase Direct Functions
// بدون كاش: كل دالة تقرأ مباشرة من قاعدة البيانات
// =========================

async function getSettings() {
  const rows = await supabase("bot_settings?select=*&limit=1");
  return rows[0] || defaultSettings();
}

async function getRootNodes() {
  return supabase(
    "bot_nodes?parent_id=is.null&is_active=eq.true&select=*&order=sort_order.asc,created_at.asc"
  );
}

async function getChildNodes(parentId) {
  return supabase(
    `bot_nodes?parent_id=eq.${parentId}&is_active=eq.true&select=*&order=sort_order.asc,created_at.asc`
  );
}

async function getNode(nodeId) {
  const rows = await supabase(`bot_nodes?id=eq.${nodeId}&select=*&limit=1`);
  return rows[0] || null;
}

async function getActiveContents(nodeId) {
  return supabase(
    `bot_contents?node_id=eq.${nodeId}&is_active=eq.true&select=*&order=is_pinned.desc,sort_order.asc,created_at.desc`
  );
}

// =========================
// User State بدون كاش
// =========================

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
  return supabase(`bot_user_states?chat_id=eq.${chatId}`, {
    method: "DELETE"
  });
}

// =========================
// Background Logging
// =========================

function saveUserInBackground(message) {
  if (!message || !message.chat) return;

  const from = message.from || {};
  const chatId = message.chat.id;

  supabase("bot_users?on_conflict=chat_id", {
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
  }).catch(error => {
    console.error("User save error:", error.message);
  });
}

function logActivityInBackground(chatId, action, details = {}) {
  supabase("bot_activity_logs", {
    method: "POST",
    body: JSON.stringify({
      chat_id: chatId,
      action,
      details
    })
  }).catch(error => {
    console.error("Activity log error:", error.message);
  });
}

// =========================
// Bot Menus
// =========================

function buttonTitle(node) {
  return `${node.emoji ? node.emoji + " " : ""}${node.title}`;
}

function homeText(settings) {
  return settings.home_button_text || "رجوع للرئيسية";
}

async function showHome(chatId, settings) {
  await clearState(chatId);

  const roots = await getRootNodes();

  if (!roots.length) {
    return sendText(chatId, "لا توجد قوائم مضافة حالياً من لوحة التحكم.");
  }

  const rows = chunk(roots.map(buttonTitle), 2);

  await sendMenu(
    chatId,
    settings.welcome_text || "مرحباً بك 👋\nاختر من القائمة:",
    rows
  );
}

async function showNode(chatId, node, settings) {
  const children = await getChildNodes(node.id);
  const contents = await getActiveContents(node.id);

  const rows = [];

  if (children.length) {
    rows.push(...chunk(children.map(buttonTitle), 2));
  }

  if (contents.length) {
    rows.push(["📦 عرض المحتوى"]);
  }

  if (node.parent_id) {
    rows.push(["⬅️ رجوع", homeText(settings)]);
  } else {
    rows.push([homeText(settings)]);
  }

  const title = escapeHtml(buttonTitle(node));
  const subtitle = escapeHtml(node.subtitle || "اختر من القائمة بالأسفل.");

  const text = `<b>${title}</b>\n${subtitle}`;

  await setState(chatId, {
    current_node_id: node.id,
    path_titles: [node.title]
  });

  await sendMenu(chatId, text, rows);
}

async function goBack(chatId, settings) {
  const state = await getState(chatId);

  if (!state || !state.current_node_id) {
    return showHome(chatId, settings);
  }

  const currentNode = await getNode(state.current_node_id);

  if (!currentNode || !currentNode.parent_id) {
    return showHome(chatId, settings);
  }

  const parentNode = await getNode(currentNode.parent_id);

  if (!parentNode) {
    return showHome(chatId, settings);
  }

  return showNode(chatId, parentNode, settings);
}

async function sendContent(chatId, nodeId, settings) {
  const contents = await getActiveContents(nodeId);

  if (!contents.length) {
    await sendText(chatId, settings.empty_text || "لا توجد محتويات حالياً في هذا القسم.");
    return;
  }

  await sendText(chatId, `📦 جاري إرسال ${contents.length} عنصر...`);

  for (const item of contents) {
    const title = escapeHtml(item.title || "محتوى");
    const description = item.description ? `\n${escapeHtml(item.description)}` : "";
    const header = `<b>${title}</b>${description}`;

    const sourceType = item.source_type || "";
    const contentType = item.content_type || "";

    if (sourceType === "text" || contentType === "text") {
      const body = item.text_content ? `\n\n${escapeHtml(item.text_content)}` : "";
      await sendText(chatId, header + body);
      continue;
    }

    if (sourceType === "external_link" || item.external_url) {
      await sendText(chatId, `${header}\n\n🔗 ${escapeHtml(item.external_url)}`);
      continue;
    }

    if (
      sourceType === "telegram_copy" ||
      item.channel_id ||
      item.message_id
    ) {
      if (!item.channel_id || !item.message_id) {
        await sendText(chatId, `${header}\n\n⚠️ هذا العنصر ناقص: channel_id أو message_id غير موجود.`);
        continue;
      }

      await sendText(chatId, header);

      const copied = await telegram("copyMessage", {
        chat_id: chatId,
        from_chat_id: item.channel_id,
        message_id: item.message_id,
        protect_content: false
      });

      if (!copied.ok) {
        await sendText(
          chatId,
          `تعذر إرسال هذا العنصر:\n${escapeHtml(copied.description || "Unknown Telegram error")}`
        );
      } else {
        supabase(`bot_contents?id=eq.${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            downloads_count: Number(item.downloads_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
        }).catch(() => null);
      }

      continue;
    }

    await sendText(chatId, header);
  }
}

// =========================
// Message Handler
// =========================

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (!text) return;

  saveUserInBackground(message);

  const settings = await getSettings();

  if (settings.is_maintenance) {
    await sendText(chatId, settings.maintenance_text || "البوت تحت الصيانة حالياً.");
    return;
  }

  const mainButton = homeText(settings);

  if (
    text === "/start" ||
    text === mainButton ||
    text === "الرئيسية" ||
    text === "🏠 الرئيسية"
  ) {
    logActivityInBackground(chatId, "start", { text });
    return showHome(chatId, settings);
  }

  if (text === "/reload" || text === "/refresh") {
    await sendText(chatId, "✅ تم تحديث البيانات مباشرة من قاعدة البيانات.\nلا يوجد كاش في هذه النسخة.");
    return showHome(chatId, settings);
  }

  if (text === "⬅️ رجوع") {
    logActivityInBackground(chatId, "back", {});
    return goBack(chatId, settings);
  }

  const state = await getState(chatId);
  const currentNodeId = state?.current_node_id || null;

  if (text === "📦 عرض المحتوى" && currentNodeId) {
    logActivityInBackground(chatId, "send_content", {
      node_id: currentNodeId
    });

    return sendContent(chatId, currentNodeId, settings);
  }

  const candidates = currentNodeId
    ? await getChildNodes(currentNodeId)
    : await getRootNodes();

  let node = candidates.find(item => {
    return buttonTitle(item) === text || item.title === text;
  });

  if (!node) {
    const roots = await getRootNodes();

    node = roots.find(item => {
      return buttonTitle(item) === text || item.title === text;
    });
  }

  if (node) {
    logActivityInBackground(chatId, "open_node", {
      node_id: node.id,
      title: node.title
    });

    return showNode(chatId, node, settings);
  }

  await sendText(chatId, "اختر من الأزرار بالأسفل 👇");
}

// =========================
// Vercel Handler
// =========================

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

    if (update.message) {
      await handleMessage(update.message);
    }

    return json(res, 200, {
      ok: true
    });
  } catch (error) {
    console.error("Webhook Error:", error);

    return json(res, 200, {
      ok: false,
      error: error.message
    });
  }
};
