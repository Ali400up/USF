// api/webhook.js
// UST Central Scientific Committee Telegram Bot
// CommonJS - بدون type: module
// نسخة محسنة: أزرار دائمة + قائمة رئيسية + بحث + مساعدة + تصميم رسائل أجمل
// بدون Cache نهائيًا: كل البيانات تُقرأ مباشرة من Supabase

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUTTONS = {
  HOME: "🏠 الرئيسية",
  MENU: "📋 القائمة",
  BACK: "⬅️ رجوع",
  CONTENT: "📦 عرض المحتوى",
  SEARCH: "🔎 بحث",
  HELP: "🆘 مساعدة",
  ABOUT: "ℹ️ عن البوت"
};

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

function truncate(value, max = 900) {
  const text = String(value || "");
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
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
  const finalRows = [...rows];

  finalRows.push([BUTTONS.HOME, BUTTONS.MENU]);
  finalRows.push([BUTTONS.SEARCH, BUTTONS.HELP, BUTTONS.ABOUT]);

  return {
    keyboard: finalRows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
    input_field_placeholder: "اختر من القائمة أو اكتب أمرًا..."
  };
}

function chunk(items, size = 2) {
  const rows = [];

  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }

  return rows;
}

async function sendChatAction(chatId, action = "typing") {
  return telegram("sendChatAction", {
    chat_id: chatId,
    action
  });
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
    home_button_text: BUTTONS.HOME,
    is_maintenance: false,
    maintenance_text: "البوت تحت الصيانة حالياً."
  };
}

// =========================
// Supabase Direct Functions
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

async function searchContents(query) {
  const q = encodeURIComponent(`*${query}*`);

  return supabase(
    `bot_contents?is_active=eq.true&or=(title.ilike.${q},description.ilike.${q},text_content.ilike.${q})&select=*&order=is_pinned.desc,created_at.desc&limit=10`
  );
}

// =========================
// User State
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
// Text Design
// =========================

function buttonTitle(node) {
  return `${node.emoji ? node.emoji + " " : ""}${node.title}`;
}

function cleanButtonText(text) {
  return String(text || "")
    .replace("🏠 ", "")
    .replace("📋 ", "")
    .trim();
}

function homeText(settings) {
  return settings.home_button_text || BUTTONS.HOME;
}

function makeHeader(title, subtitle = "") {
  return [
    "━━━━━━━━━━━━━━",
    `✨ <b>${escapeHtml(title)}</b>`,
    subtitle ? `\n${escapeHtml(subtitle)}` : "",
    "━━━━━━━━━━━━━━"
  ].join("\n");
}

function footerText(settings) {
  return `\n\n<b>━━━━━━━━━━━━━━</b>\n${escapeHtml(settings.footer_text || "اللجنة العلمية المركزية")}`;
}

function makeWelcome(settings) {
  const title = settings.bot_title || "بوت اللجنة العلمية المركزية";
  const welcome = settings.welcome_text || "مرحباً بك 👋\nاختر من القائمة بالأسفل.";

  return [
    "🎓 <b>أهلاً بك في</b>",
    `<b>${escapeHtml(title)}</b>`,
    "",
    escapeHtml(welcome),
    "",
    "اختر من الأزرار بالأسفل 👇"
  ].join("\n");
}

// =========================
// Bot Menus
// =========================

async function showHome(chatId, settings) {
  await clearState(chatId);

  const roots = await getRootNodes();

  if (!roots.length) {
    return sendMenu(
      chatId,
      makeHeader("لا توجد قوائم حالياً", "أضف القوائم من لوحة التحكم أولاً.") + footerText(settings),
      []
    );
  }

  const rows = chunk(roots.map(buttonTitle), 2);

  await sendMenu(chatId, makeWelcome(settings), rows);
}

async function showMainMenu(chatId, settings) {
  const state = await getState(chatId);

  if (!state || !state.current_node_id) {
    return showHome(chatId, settings);
  }

  const node = await getNode(state.current_node_id);

  if (!node) {
    return showHome(chatId, settings);
  }

  return showNode(chatId, node, settings);
}

async function showNode(chatId, node, settings) {
  const children = await getChildNodes(node.id);
  const contents = await getActiveContents(node.id);

  const rows = [];

  if (children.length) {
    rows.push(...chunk(children.map(buttonTitle), 2));
  }

  if (contents.length) {
    rows.push([BUTTONS.CONTENT]);
  }

  if (node.parent_id) {
    rows.push([BUTTONS.BACK]);
  }

  const title = buttonTitle(node);
  const subtitle = node.subtitle || node.description || "اختر من القائمة بالأسفل.";

  const text = [
    makeHeader(title, subtitle),
    "",
    children.length ? `📂 الأقسام المتاحة: <b>${children.length}</b>` : "📂 لا توجد أقسام فرعية.",
    contents.length ? `📦 المحتوى المتاح: <b>${contents.length}</b>` : "📦 لا يوجد محتوى مباشر هنا.",
    footerText(settings)
  ].join("\n");

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
    await sendMenu(
      chatId,
      makeHeader("لا توجد محتويات", settings.empty_text || "لا توجد محتويات حالياً في هذا القسم.") + footerText(settings),
      [[BUTTONS.BACK]]
    );
    return;
  }

  await sendChatAction(chatId, "typing");

  await sendText(
    chatId,
    [
      "📦 <b>جاري إرسال المحتوى...</b>",
      "",
      `عدد العناصر: <b>${contents.length}</b>`,
      "انتظر قليلًا 👇"
    ].join("\n")
  );

  for (const item of contents) {
    const title = escapeHtml(item.title || "محتوى");
    const description = item.description ? `\n${escapeHtml(truncate(item.description, 500))}` : "";
    const header = `📌 <b>${title}</b>${description}`;

    const sourceType = item.source_type || "";
    const contentType = item.content_type || "";

    if (sourceType === "text" || contentType === "text") {
      const body = item.text_content ? `\n\n${escapeHtml(truncate(item.text_content, 3000))}` : "";
      await sendText(chatId, header + body);
      continue;
    }

    if (sourceType === "external_link" || item.external_url) {
      await sendText(chatId, `${header}\n\n🔗 <b>الرابط:</b>\n${escapeHtml(item.external_url)}`);
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
          [
            "⚠️ <b>تعذر إرسال هذا العنصر</b>",
            "",
            escapeHtml(copied.description || "Unknown Telegram error")
          ].join("\n")
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

async function showHelp(chatId, settings) {
  const text = [
    makeHeader("مساعدة البوت", "هذه الأوامر تساعدك على استخدام البوت بسرعة."),
    "",
    "🏠 <b>الرئيسية</b>",
    "للرجوع إلى بداية البوت.",
    "",
    "📋 <b>القائمة</b>",
    "لعرض القائمة الحالية مرة أخرى.",
    "",
    "⬅️ <b>رجوع</b>",
    "للرجوع خطوة للخلف.",
    "",
    "🔎 <b>بحث</b>",
    "للبحث اكتب:",
    "<code>/search anatomy</code>",
    "",
    "📦 <b>عرض المحتوى</b>",
    "لعرض الملفات أو الفيديوهات أو الروابط داخل القسم.",
    "",
    "ℹ️ <b>عن البوت</b>",
    "معلومات مختصرة عن البوت.",
    footerText(settings)
  ].join("\n");

  await sendMenu(chatId, text, [[BUTTONS.HOME, BUTTONS.MENU]]);
}

async function showAbout(chatId, settings) {
  const text = [
    makeHeader("عن البوت", settings.bot_title || "بوت اللجنة العلمية المركزية"),
    "",
    "🎓 هذا البوت مخصص لتنظيم محتوى اللجنة العلمية المركزية.",
    "",
    "يمكن من خلاله عرض:",
    "📚 ملفات PDF",
    "🎧 تسجيلات",
    "🎬 فيديوهات",
    "🔗 روابط",
    "📝 نصوص وملاحظات",
    "🧪 عملي ومختبرات",
    "",
    "يتم تحديث محتوى البوت من لوحة التحكم مباشرة.",
    footerText(settings)
  ].join("\n");

  await sendMenu(chatId, text, [[BUTTONS.HOME, BUTTONS.MENU]]);
}

async function showSearchInstructions(chatId, settings) {
  const text = [
    makeHeader("البحث داخل البوت", "اكتب كلمة البحث بعد الأمر /search"),
    "",
    "مثال:",
    "<code>/search anatomy</code>",
    "<code>/search microbiology</code>",
    "<code>/search محاضرة</code>",
    "",
    "سيبحث البوت داخل العناوين والوصف والنصوص.",
    footerText(settings)
  ].join("\n");

  await sendMenu(chatId, text, [[BUTTONS.HOME, BUTTONS.MENU]]);
}

async function doSearch(chatId, query, settings) {
  const q = String(query || "").trim();

  if (!q) {
    return showSearchInstructions(chatId, settings);
  }

  await sendChatAction(chatId, "typing");

  let results = [];

  try {
    results = await searchContents(q);
  } catch (error) {
    console.error("Search error:", error.message);
    await sendText(chatId, "حدث خطأ أثناء البحث. تأكد أن أعمدة البحث موجودة في قاعدة البيانات.");
    return;
  }

  if (!results.length) {
    return sendMenu(
      chatId,
      makeHeader("لا توجد نتائج", `لم أجد نتائج عن: ${q}`) + footerText(settings),
      [[BUTTONS.HOME, BUTTONS.MENU]]
    );
  }

  const lines = [
    makeHeader("نتائج البحث", `تم العثور على ${results.length} نتيجة عن: ${q}`),
    ""
  ];

  results.forEach((item, index) => {
    lines.push(`${index + 1}. 📌 <b>${escapeHtml(item.title || "بدون عنوان")}</b>`);

    if (item.description) {
      lines.push(`   ${escapeHtml(truncate(item.description, 120))}`);
    }

    if (item.external_url) {
      lines.push(`   🔗 ${escapeHtml(item.external_url)}`);
    }

    lines.push("");
  });

  lines.push("افتح القسم المناسب من القائمة لعرض المحتوى كاملًا.");
  lines.push(footerText(settings));

  await sendMenu(chatId, lines.join("\n"), [[BUTTONS.HOME, BUTTONS.MENU]]);
}

async function setupCommands(chatId) {
  const result = await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "بدء البوت" },
      { command: "menu", description: "عرض القائمة الحالية" },
      { command: "search", description: "بحث داخل محتوى البوت" },
      { command: "help", description: "المساعدة" },
      { command: "about", description: "عن البوت" }
    ]
  });

  if (result.ok) {
    await sendText(chatId, "✅ تم ضبط أوامر البوت بنجاح.");
  } else {
    await sendText(chatId, `⚠️ فشل ضبط الأوامر:\n${escapeHtml(result.description || "Unknown error")}`);
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

  if (text === "/setup_commands") {
    return setupCommands(chatId);
  }

  if (
    text === "/start" ||
    text === BUTTONS.HOME ||
    text === "الرئيسية" ||
    text === "🏠 الرئيسية" ||
    text === homeText(settings)
  ) {
    logActivityInBackground(chatId, "start", { text });
    return showHome(chatId, settings);
  }

  if (
    text === "/menu" ||
    text === BUTTONS.MENU ||
    text === "القائمة" ||
    text === "📋 القائمة"
  ) {
    logActivityInBackground(chatId, "menu", { text });
    return showMainMenu(chatId, settings);
  }

  if (
    text === "/help" ||
    text === BUTTONS.HELP ||
    text === "مساعدة" ||
    text === "🆘 مساعدة"
  ) {
    logActivityInBackground(chatId, "help", {});
    return showHelp(chatId, settings);
  }

  if (
    text === "/about" ||
    text === BUTTONS.ABOUT ||
    text === "عن البوت" ||
    text === "ℹ️ عن البوت"
  ) {
    logActivityInBackground(chatId, "about", {});
    return showAbout(chatId, settings);
  }

  if (
    text === BUTTONS.SEARCH ||
    text === "بحث" ||
    text === "🔎 بحث"
  ) {
    logActivityInBackground(chatId, "search_help", {});
    return showSearchInstructions(chatId, settings);
  }

  if (text.startsWith("/search")) {
    const query = text.replace("/search", "").trim();
    logActivityInBackground(chatId, "search", { query });
    return doSearch(chatId, query, settings);
  }

  if (text === "/reload" || text === "/refresh") {
    await sendText(chatId, "✅ تم تحديث البيانات مباشرة من قاعدة البيانات.\nهذه النسخة لا تستخدم كاش.");
    return showHome(chatId, settings);
  }

  if (text === BUTTONS.BACK || text === "رجوع" || text === "⬅️ رجوع") {
    logActivityInBackground(chatId, "back", {});
    return goBack(chatId, settings);
  }

  const state = await getState(chatId);
  const currentNodeId = state?.current_node_id || null;

  if (text === BUTTONS.CONTENT && currentNodeId) {
    logActivityInBackground(chatId, "send_content", {
      node_id: currentNodeId
    });

    return sendContent(chatId, currentNodeId, settings);
  }

  const candidates = currentNodeId
    ? await getChildNodes(currentNodeId)
    : await getRootNodes();

  let node = candidates.find(item => {
    return buttonTitle(item) === text || item.title === text || item.title === cleanButtonText(text);
  });

  if (!node) {
    const roots = await getRootNodes();

    node = roots.find(item => {
      return buttonTitle(item) === text || item.title === text || item.title === cleanButtonText(text);
    });
  }

  if (node) {
    logActivityInBackground(chatId, "open_node", {
      node_id: node.id,
      title: node.title
    });

    return showNode(chatId, node, settings);
  }

  await sendMenu(
    chatId,
    [
      "لم أفهم اختيارك.",
      "",
      "استخدم الأزرار بالأسفل أو اضغط:",
      "🏠 الرئيسية",
      "📋 القائمة"
    ].join("\n"),
    [[BUTTONS.HOME, BUTTONS.MENU]]
  );
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
