// public/admin/app.js
// Universal admin panel for Telegram bot.
// The frontend never stores BOT_TOKEN or SUPABASE_SERVICE_ROLE_KEY. It only sends ADMIN_PASSWORD to the server API.

const ADMIN_KEY = "UST_SCIENTIFIC_BOT_ADMIN_PASSWORD";
const state = {
  password: localStorage.getItem(ADMIN_KEY) || "",
  view: "dashboard",
  dashboard: null,
  channels: [],
  nodes: [],
  contents: [],
  users: [],
  logs: [],
  settings: null,
  search: ""
};

const views = [
  { id: "dashboard", title: "الرئيسية", desc: "إحصائيات وفحص سريع للنظام.", icon: "fa-gauge-high" },
  { id: "structure", title: "هيكل البوت", desc: "أضف أي قائمة أو مادة أو قسم أو عنصر مخصص بدون قيود.", icon: "fa-sitemap" },
  { id: "contents", title: "المحتوى", desc: "PDF، فيديو، تسجيل، صورة، رابط، نص، اختبار أو أي محتوى.", icon: "fa-folder-open" },
  { id: "channels", title: "القنوات", desc: "إدارة قنوات تليجرام التي تحتوي الملفات.", icon: "fa-tower-broadcast" },
  { id: "users", title: "المستخدمون", desc: "عرض الطلاب والمستخدمين الذين دخلوا البوت.", icon: "fa-users" },
  { id: "settings", title: "الإعدادات", desc: "تعديل رسالة الترحيب والصيانة ونصوص البوت.", icon: "fa-gears" },
  { id: "logs", title: "السجل", desc: "آخر حركات المستخدمين داخل البوت.", icon: "fa-clock-rotate-left" }
];

const nodeTypes = [
  ["custom", "مخصص"],
  ["college", "كلية"],
  ["major", "تخصص"],
  ["level", "مستوى"],
  ["year", "سنة"],
  ["term", "ترم"],
  ["subject", "مادة"],
  ["section", "قسم"],
  ["lecture", "محاضرة"],
  ["lab", "عملي"],
  ["course", "دورة"],
  ["announcement", "إعلان"],
  ["links", "روابط"],
  ["quiz", "اختبارات"],
  ["library", "مكتبة"]
];

const contentTypes = [
  ["file", "ملف"],
  ["pdf", "PDF"],
  ["video", "فيديو"],
  ["audio", "تسجيل صوتي"],
  ["image", "صورة"],
  ["link", "رابط"],
  ["text", "نص"],
  ["quiz", "اختبار"],
  ["playlist", "قائمة تشغيل"],
  ["announcement", "إعلان"],
  ["other", "أخرى"]
];

const sourceTypes = [
  ["telegram_copy", "نسخ من قناة تليجرام"],
  ["external_link", "رابط خارجي"],
  ["text", "نص مباشر"]
];

const icons = [
  "fa-solid fa-folder","fa-solid fa-folder-open","fa-solid fa-book","fa-solid fa-book-medical",
  "fa-solid fa-graduation-cap","fa-solid fa-building-columns","fa-solid fa-microscope","fa-solid fa-flask",
  "fa-solid fa-video","fa-solid fa-headphones","fa-solid fa-file-pdf","fa-solid fa-link",
  "fa-solid fa-bullhorn","fa-solid fa-list-check","fa-solid fa-chalkboard-user","fa-solid fa-sitemap",
  "fa-solid fa-brain","fa-solid fa-stethoscope","fa-solid fa-laptop-code","fa-solid fa-robot",
  "fa-brands fa-telegram","fa-solid fa-heart-pulse","fa-solid fa-vial","fa-solid fa-dna"
];

const $ = (id) => document.getElementById(id);

function safe(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message, type = "info") {
  const box = $("toast");
  box.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-triangle-exclamation" : type === "success" ? "fa-circle-check" : "fa-circle-info"}"></i> ${safe(message)}`;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 3500);
}

async function api(url, options = {}) {
  const password = localStorage.getItem(ADMIN_KEY) || state.password || "";
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": password,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    localStorage.removeItem(ADMIN_KEY);
    state.password = "";
    renderLogin();
    throw new Error("Unauthorized: كلمة السر غير صحيحة أو لم يتم ضبط ADMIN_PASSWORD في Vercel");
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || "حدث خطأ في الطلب");
  }

  return data;
}

function icon(cls) {
  return `<i class="${safe(cls)}"></i>`;
}

function showApp() {
  $("loginWrap").classList.add("hidden");
  $("app").classList.remove("hidden");
  renderTabs();
  render();
}

function renderLogin() {
  $("app").classList.add("hidden");
  $("loginWrap").classList.remove("hidden");
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = $("password").value.trim();
  if (!password) return toast("اكتب كلمة السر", "error");
  state.password = password;
  localStorage.setItem(ADMIN_KEY, password);
  try {
    await api("/api/admin/dashboard");
    toast("تم تسجيل الدخول بنجاح", "success");
    showApp();
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(ADMIN_KEY);
  state.password = "";
  renderLogin();
});

$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("UST_PANEL_DARK", document.body.classList.contains("dark") ? "1" : "0");
});

$("reloadAllBtn").addEventListener("click", () => loadAll(true));
$("modalClose").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

function renderTabs() {
  const counts = {
    dashboard: "",
    structure: state.nodes.length,
    contents: state.contents.length,
    channels: state.channels.length,
    users: state.users.length,
    settings: "",
    logs: state.logs.length
  };

  $("tabs").innerHTML = views.map(v => `
    <button class="tab ${state.view === v.id ? "active" : ""}" data-view="${v.id}" type="button">
      <span>${icon("fa-solid " + v.icon)} ${safe(v.title)}</span>
      <small>${counts[v.id] ?? ""}</small>
    </button>
  `).join("");

  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.onclick = () => {
      state.view = btn.dataset.view;
      renderTabs();
      render();
    };
  });
}

async function loadAll(showMessage = false) {
  try {
    $("statusLine").textContent = "جاري تحميل البيانات...";
    const [dashboard, channels, nodes, contents, settings] = await Promise.all([
      api("/api/admin/dashboard"),
      api("/api/admin/channels"),
      api("/api/admin/nodes"),
      api("/api/admin/contents"),
      api("/api/admin/settings")
    ]);

    state.dashboard = dashboard.stats || {};
    state.channels = channels.channels || [];
    state.nodes = nodes.nodes || [];
    state.contents = contents.contents || [];
    state.settings = settings.settings || null;

    if (state.view === "users") await loadUsers();
    if (state.view === "logs") await loadLogs();

    $("statusLine").textContent = "تم تحميل البيانات";
    renderTabs();
    render();
    if (showMessage) toast("تم تحديث البيانات", "success");
  } catch (error) {
    $("statusLine").textContent = "فشل تحميل البيانات";
    toast(error.message, "error");
    console.error(error);
  }
}

async function loadUsers() {
  const result = await api("/api/admin/users");
  state.users = result.users || [];
}

async function loadLogs() {
  const result = await api("/api/admin/logs");
  state.logs = result.logs || [];
}

function renderStats() {
  const s = state.dashboard || {};
  const items = [
    ["fa-tower-broadcast", s.channels || state.channels.length, "القنوات"],
    ["fa-sitemap", s.nodes || state.nodes.length, "عناصر البوت"],
    ["fa-folder-open", s.contents || state.contents.length, "المحتويات"],
    ["fa-users", s.users || state.users.length, "المستخدمون"],
    ["fa-download", s.downloads || 0, "مرات الإرسال"],
    ["fa-circle-check", s.active_contents || 0, "محتوى مفعل"]
  ];
  $("statsGrid").innerHTML = items.map(([ic, num, label]) => `
    <div class="stat-card">${icon("fa-solid " + ic)}<strong>${safe(num)}</strong><span>${safe(label)}</span></div>
  `).join("");
}

function setViewHeader(title, desc, actions = "") {
  $("viewTitle").textContent = title;
  $("viewDesc").textContent = desc;
  $("viewActions").innerHTML = actions;
}

function render() {
  renderStats();
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "structure") renderStructure();
  if (state.view === "contents") renderContents();
  if (state.view === "channels") renderChannels();
  if (state.view === "users") renderUsers();
  if (state.view === "settings") renderSettings();
  if (state.view === "logs") renderLogs();
}

function renderDashboard() {
  setViewHeader("الرئيسية", "تحكم كامل في بوت تليجرام الخاص باللجنة العلمية المركزية.", `
    <button class="btn btn-soft" onclick="checkHealth()">${icon("fa-solid fa-heart-pulse")} فحص النظام</button>
    <button class="btn btn-success" onclick="seedData()">${icon("fa-solid fa-wand-magic-sparkles")} بيانات بداية</button>
  `);

  $("viewBody").innerHTML = `
    <div class="quick-grid">
      <div class="quick-card">
        ${icon("fa-solid fa-sitemap")}
        <h3>هيكل غير محدود</h3>
        <p>لا يوجد تقييد بسنة أو مادة. يمكنك إضافة: كلية، تخصص، مستوى، مادة، قسم، دورة، إعلان، روابط أو أي شيء.</p>
        <button class="btn btn-primary" onclick="openNodeModal()">${icon("fa-solid fa-plus")} إضافة عنصر</button>
      </div>
      <div class="quick-card">
        ${icon("fa-solid fa-folder-open")}
        <h3>محتوى متعدد الأنواع</h3>
        <p>أضف PDF، فيديو، تسجيل، صورة، رابط خارجي، نص مباشر، اختبار، أو ملف من قناة تليجرام.</p>
        <button class="btn btn-primary" onclick="openContentModal()">${icon("fa-solid fa-cloud-arrow-up")} إضافة محتوى</button>
      </div>
      <div class="quick-card">
        ${icon("fa-brands fa-telegram")}
        <h3>قنوات كثيرة</h3>
        <p>أضف أكثر من قناة، ثم اختر القناة المناسبة عند إضافة الملفات أو الفيديوهات.</p>
        <button class="btn btn-primary" onclick="openChannelModal()">${icon("fa-solid fa-tower-broadcast")} إضافة قناة</button>
      </div>
      <div class="quick-card">
        ${icon("fa-solid fa-gears")}
        <h3>إعدادات البوت</h3>
        <p>غيّر رسالة الترحيب ونص الصيانة وزر الرجوع من اللوحة مباشرة.</p>
        <button class="btn btn-primary" onclick="goView('settings')">${icon("fa-solid fa-pen")} تعديل الإعدادات</button>
      </div>
    </div>
  `;
}

function getNodeTitle(id) {
  if (!id) return "رئيسي";
  const node = state.nodes.find(n => String(n.id) === String(id));
  return node ? node.title : `#${id}`;
}

function nodeOptions(selected = "", excludeId = null) {
  return `<option value="">رئيسي بدون أب</option>` + state.nodes
    .filter(n => String(n.id) !== String(excludeId))
    .map(n => `<option value="${n.id}" ${String(selected) === String(n.id) ? "selected" : ""}>${safe(makeNodePath(n))}</option>`)
    .join("");
}

function makeNodePath(node) {
  const parts = [node.title];
  let current = node;
  let limit = 0;
  while (current.parent_id && limit < 10) {
    const parent = state.nodes.find(n => String(n.id) === String(current.parent_id));
    if (!parent) break;
    parts.unshift(parent.title);
    current = parent;
    limit++;
  }
  return parts.join(" ← ");
}

function renderStructure() {
  setViewHeader("هيكل البوت", "هنا تبني القوائم التي تظهر للمستخدم في تليجرام. ليست مقيدة بسنة أو مادة.", `
    <button class="btn btn-primary" onclick="openNodeModal()">${icon("fa-solid fa-plus")} إضافة عنصر</button>
    <button class="btn btn-soft" onclick="loadAll(true)">${icon("fa-solid fa-rotate")} تحديث</button>
  `);

  const q = (state.search || "").toLowerCase();
  const rows = state.nodes.filter(n => JSON.stringify(n).toLowerCase().includes(q));

  $("viewBody").innerHTML = `
    <div class="help-strip">
      ${icon("fa-solid fa-circle-info")}
      مثال: أضف "1st Year" كعنصر رئيسي، ثم تحته "Term 1"، ثم "Anatomy"، ثم "PDF". أو أضف "الدورات" و"روابط مهمة" و"إعلانات" بدون سنة.
    </div>
    ${toolbar("بحث في عناصر البوت...")}
    <div class="tree-list">
      ${rows.length ? rows.map(n => nodeCard(n)).join("") : `<div class="empty">لا توجد عناصر. اضغط إضافة عنصر.</div>`}
    </div>
  `;
  bindSearch();
}

function nodeCard(n) {
  return `
    <div class="tree-node">
      <div>
        <div class="node-title">${icon(n.icon || "fa-solid fa-folder")} ${safe(n.emoji || "")} ${safe(n.title)}</div>
        <div class="depth">${safe(makeNodePath(n))}</div>
        <div class="record-meta">
          <div><b>النوع:</b> ${safe(n.node_type || "custom")}</div>
          <div><b>الأب:</b> ${safe(getNodeTitle(n.parent_id))}</div>
          <div><b>الحالة:</b> <span class="badge ${n.is_active === false ? "off" : ""}">${n.is_active === false ? "مخفي" : "ظاهر"}</span></div>
        </div>
      </div>
      <div class="row-actions">
        <button class="btn btn-soft" onclick="openNodeModal(${n.id})">${icon("fa-solid fa-pen")} تعديل</button>
        <button class="btn btn-danger" onclick="deleteNode(${n.id})">${icon("fa-solid fa-trash")} حذف</button>
      </div>
    </div>
  `;
}

function toolbar(placeholder) {
  return `
    <div class="toolbar">
      <div class="field search-box">
        ${icon("fa-solid fa-magnifying-glass")}
        <input id="searchInput" type="search" value="${safe(state.search)}" placeholder="${safe(placeholder)}" />
      </div>
      <div class="field">
        <select id="quickFilter">
          <option>كل العناصر</option>
          <option>المفعلة</option>
          <option>المخفية</option>
        </select>
      </div>
      <button class="btn btn-soft" onclick="exportJson()">${icon("fa-solid fa-code")} تصدير JSON</button>
    </div>
  `;
}

function bindSearch() {
  const input = $("searchInput");
  if (!input) return;
  input.oninput = () => {
    state.search = input.value;
    render();
  };
}

function renderContents() {
  setViewHeader("المحتوى", "أضف محتوى لأي عنصر داخل البوت: ملفات، فيديوهات، روابط، نصوص، تسجيلات.", `
    <button class="btn btn-primary" onclick="openContentModal()">${icon("fa-solid fa-plus")} إضافة محتوى</button>
    <button class="btn btn-soft" onclick="loadAll(true)">${icon("fa-solid fa-rotate")} تحديث</button>
  `);

  const q = (state.search || "").toLowerCase();
  const rows = state.contents.filter(c => JSON.stringify(c).toLowerCase().includes(q));

  $("viewBody").innerHTML = `
    ${toolbar("بحث في المحتوى...")}
    <div class="record-cards">
      ${rows.length ? rows.map(c => contentCard(c)).join("") : `<div class="empty">لا توجد محتويات بعد.</div>`}
    </div>
  `;
  bindSearch();
}

function contentCard(c) {
  return `
    <div class="record-card">
      <h3>${icon(typeIcon(c.content_type))} ${safe(c.title)}</h3>
      <div class="record-meta">
        <div><b>المكان:</b> ${safe(getNodeTitle(c.node_id))}</div>
        <div><b>النوع:</b> ${safe(c.content_type || "file")} / ${safe(c.source_type || "")}</div>
        <div><b>القناة:</b> ${safe(c.channel_id || "-")}</div>
        <div><b>الرسالة:</b> ${safe(c.message_id || "-")}</div>
        <div><b>الحالة:</b> <span class="badge ${c.is_active === false ? "off" : ""}">${c.is_active === false ? "مخفي" : "ظاهر"}</span></div>
      </div>
      <div class="row-actions">
        <button class="btn btn-soft" onclick="openContentModal(${c.id})">${icon("fa-solid fa-pen")} تعديل</button>
        <button class="btn btn-danger" onclick="deleteContent(${c.id})">${icon("fa-solid fa-trash")} حذف</button>
      </div>
    </div>
  `;
}

function typeIcon(type) {
  const map = { pdf: "fa-solid fa-file-pdf", video: "fa-solid fa-video", audio: "fa-solid fa-headphones", link: "fa-solid fa-link", text: "fa-solid fa-file-lines", image: "fa-solid fa-image", quiz: "fa-solid fa-list-check" };
  return map[type] || "fa-solid fa-file";
}

function renderChannels() {
  setViewHeader("القنوات", "أضف قنوات تليجرام الخاصة التي يخزن فيها البوت الملفات.", `
    <button class="btn btn-primary" onclick="openChannelModal()">${icon("fa-solid fa-plus")} إضافة قناة</button>
    <button class="btn btn-soft" onclick="loadAll(true)">${icon("fa-solid fa-rotate")} تحديث</button>
  `);

  $("viewBody").innerHTML = `
    <div class="record-cards">
      ${state.channels.length ? state.channels.map(ch => `
        <div class="record-card">
          <h3>${icon("fa-brands fa-telegram")} ${safe(ch.title)}</h3>
          <div class="record-meta">
            <div><b>Channel ID:</b> ${safe(ch.channel_id)}</div>
            <div><b>Username:</b> ${safe(ch.username || "-")}</div>
            <div><b>الوصف:</b> ${safe(ch.description || "-")}</div>
            <div><b>الحالة:</b> <span class="badge ${ch.is_active === false ? "off" : ""}">${ch.is_active === false ? "مخفية" : "مفعلة"}</span></div>
          </div>
          <div class="row-actions">
            <button class="btn btn-soft" onclick="openChannelModal(${ch.id})">${icon("fa-solid fa-pen")} تعديل</button>
            <button class="btn btn-danger" onclick="deleteChannel(${ch.id})">${icon("fa-solid fa-trash")} حذف</button>
          </div>
        </div>
      `).join("") : `<div class="empty">لا توجد قنوات. أضف قناة أولاً.</div>`}
    </div>
  `;
}

async function renderUsers() {
  if (!state.users.length) {
    try { await loadUsers(); } catch(e) { toast(e.message, "error"); }
  }
  setViewHeader("المستخدمون", "آخر الطلاب والمستخدمين الذين دخلوا البوت.", `
    <button class="btn btn-soft" onclick="refreshUsers()">${icon("fa-solid fa-rotate")} تحديث</button>
  `);

  $("viewBody").innerHTML = `
    <div class="table-wrap">
      <table class="table-lite">
        <thead><tr><th>Chat ID</th><th>الاسم</th><th>Username</th><th>آخر ظهور</th></tr></thead>
        <tbody>
          ${state.users.length ? state.users.map(u => `
            <tr>
              <td>${safe(u.chat_id)}</td>
              <td>${safe([u.first_name, u.last_name].filter(Boolean).join(" "))}</td>
              <td>${safe(u.username ? "@" + u.username : "-")}</td>
              <td>${safe(u.last_seen || "-")}</td>
            </tr>
          `).join("") : `<tr><td colspan="4" class="empty">لا يوجد مستخدمون بعد.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

async function refreshUsers() {
  await loadUsers();
  renderUsers();
  toast("تم تحديث المستخدمين", "success");
}

async function renderLogs() {
  if (!state.logs.length) {
    try { await loadLogs(); } catch(e) { toast(e.message, "error"); }
  }
  setViewHeader("السجل", "آخر العمليات التي حدثت داخل البوت.", `
    <button class="btn btn-soft" onclick="refreshLogs()">${icon("fa-solid fa-rotate")} تحديث</button>
  `);

  $("viewBody").innerHTML = `
    <div class="record-cards">
      ${state.logs.length ? state.logs.map(l => `
        <div class="record-card">
          <h3>${icon("fa-solid fa-clock-rotate-left")} ${safe(l.action)}</h3>
          <div class="record-meta">
            <div><b>Chat ID:</b> ${safe(l.chat_id || "-")}</div>
            <div><b>التاريخ:</b> ${safe(l.created_at)}</div>
            <div><b>التفاصيل:</b> ${safe(JSON.stringify(l.details || {}))}</div>
          </div>
        </div>
      `).join("") : `<div class="empty">لا يوجد سجل بعد.</div>`}
    </div>
  `;
}

async function refreshLogs() {
  await loadLogs();
  renderLogs();
  toast("تم تحديث السجل", "success");
}

function renderSettings() {
  setViewHeader("الإعدادات", "تعديل نصوص البوت ووضع الصيانة.", `
    <button class="btn btn-soft" onclick="loadAll(true)">${icon("fa-solid fa-rotate")} تحديث</button>
  `);

  const s = state.settings || {};
  $("viewBody").innerHTML = `
    <form id="settingsForm">
      <div class="grid-form">
        <div class="field half"><label>اسم البوت</label><input name="bot_title" value="${safe(s.bot_title || "")}" /></div>
        <div class="field half"><label>نص زر الرجوع</label><input name="home_button_text" value="${safe(s.home_button_text || "رجوع للرئيسية")}" /></div>
        <div class="field full"><label>رسالة الترحيب</label><textarea name="welcome_text">${safe(s.welcome_text || "")}</textarea></div>
        <div class="field full"><label>رسالة القسم الفارغ</label><textarea name="empty_text">${safe(s.empty_text || "")}</textarea></div>
        <div class="field full"><label>نص الصيانة</label><textarea name="maintenance_text">${safe(s.maintenance_text || "")}</textarea></div>
        <div class="field half"><label>تفعيل الصيانة</label><select name="is_maintenance"><option value="false">لا</option><option value="true" ${s.is_maintenance ? "selected" : ""}>نعم</option></select></div>
        <div class="field half"><label>تذييل</label><input name="footer_text" value="${safe(s.footer_text || "")}" /></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${icon("fa-solid fa-floppy-disk")} حفظ الإعدادات</button>
      </div>
    </form>
  `;

  $("settingsForm").onsubmit = saveSettings;
}

async function saveSettings(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.is_maintenance = payload.is_maintenance === "true";
  try {
    const result = await api("/api/admin/settings", { method: "POST", body: JSON.stringify(payload) });
    state.settings = result.settings;
    toast("تم حفظ الإعدادات", "success");
    renderSettings();
  } catch (error) {
    toast(error.message, "error");
  }
}

function openModal(title, body) {
  $("modalTitle").innerHTML = title;
  $("modalBody").innerHTML = body;
  $("modal").classList.add("show");
}

function closeModal() {
  $("modal").classList.remove("show");
}

function booleanValue(value) {
  return value === true || value === "true" || value === "on";
}

function iconPicker(name, value = "fa-solid fa-folder") {
  return `
    <div class="field half"><label>الأيقونة</label>
      <select name="${name}">
        ${icons.map(i => `<option value="${i}" ${i === value ? "selected" : ""}>${i}</option>`).join("")}
      </select>
    </div>
  `;
}

function openNodeModal(id = null) {
  const n = id ? state.nodes.find(x => String(x.id) === String(id)) : {};
  openModal(id ? "تعديل عنصر في البوت" : "إضافة عنصر جديد", `
    <form id="nodeForm">
      <input type="hidden" name="id" value="${safe(n.id || "")}" />
      <div class="grid-form">
        <div class="field half"><label>العنصر الأب</label><select name="parent_id">${nodeOptions(n.parent_id || "", n.id)}</select></div>
        <div class="field half"><label>نوع العنصر</label><select name="node_type">${nodeTypes.map(([v,l]) => `<option value="${v}" ${n.node_type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field half"><label>العنوان</label><input name="title" value="${safe(n.title || "")}" required placeholder="مثال: Anatomy أو الدورات" /></div>
        <div class="field half"><label>إيموجي اختياري</label><input name="emoji" value="${safe(n.emoji || "")}" placeholder="📚" /></div>
        <div class="field full"><label>وصف صغير</label><textarea name="subtitle" placeholder="يظهر عند فتح القسم">${safe(n.subtitle || "")}</textarea></div>
        ${iconPicker("icon", n.icon || "fa-solid fa-folder")}
        <div class="field half"><label>لون اختياري</label><input name="color" value="${safe(n.color || "")}" placeholder="#0B5ED7" /></div>
        <div class="field half"><label>الترتيب</label><input type="number" name="sort_order" value="${safe(n.sort_order || 0)}" /></div>
        <div class="field half"><label>الحالة</label><select name="is_active"><option value="true">ظاهر</option><option value="false" ${n.is_active === false ? "selected" : ""}>مخفي</option></select></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${icon("fa-solid fa-floppy-disk")} حفظ</button>
        <button class="btn btn-soft" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </form>
  `);
  $("nodeForm").onsubmit = saveNode;
}

async function saveNode(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.is_active = payload.is_active === "true";
  payload.parent_id = payload.parent_id || null;
  const url = payload.id ? "/api/admin/update-node" : "/api/admin/nodes";
  try {
    await api(url, { method: "POST", body: JSON.stringify(payload) });
    closeModal();
    toast("تم حفظ العنصر", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function deleteNode(id) {
  if (!confirm("حذف هذا العنصر سيحذف ما تحته من محتوى. متأكد؟")) return;
  try {
    await api("/api/admin/delete-node", { method: "POST", body: JSON.stringify({ id }) });
    toast("تم حذف العنصر", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

function channelOptions(selected = "") {
  return `<option value="">بدون قناة</option>` + state.channels.map(ch =>
    `<option value="${safe(ch.channel_id)}" ${String(selected) === String(ch.channel_id) ? "selected" : ""}>${safe(ch.title)} - ${safe(ch.channel_id)}</option>`
  ).join("");
}

function openContentModal(id = null) {
  const c = id ? state.contents.find(x => String(x.id) === String(id)) : {};
  openModal(id ? "تعديل محتوى" : "إضافة محتوى جديد", `
    <form id="contentForm">
      <input type="hidden" name="id" value="${safe(c.id || "")}" />
      <div class="grid-form">
        <div class="field half"><label>مكان المحتوى داخل البوت</label><select name="node_id" required>${state.nodes.map(n => `<option value="${n.id}" ${String(c.node_id) === String(n.id) ? "selected" : ""}>${safe(makeNodePath(n))}</option>`).join("")}</select></div>
        <div class="field half"><label>نوع المحتوى</label><select name="content_type">${contentTypes.map(([v,l]) => `<option value="${v}" ${c.content_type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field half"><label>مصدر المحتوى</label><select name="source_type">${sourceTypes.map(([v,l]) => `<option value="${v}" ${c.source_type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field half"><label>القناة</label><select name="channel_id">${channelOptions(c.channel_id || "")}</select></div>
        <div class="field half"><label>العنوان</label><input name="title" required value="${safe(c.title || "")}" /></div>
        <div class="field half"><label>Message ID</label><input name="message_id" type="number" value="${safe(c.message_id || "")}" placeholder="3" /></div>
        <div class="field full"><label>رابط رسالة تليجرام اختياري</label><input name="telegram_link" value="${safe(c.telegram_link || "")}" placeholder="https://t.me/c/3917305732/3" /></div>
        <div class="field full"><label>رابط خارجي اختياري</label><input name="external_url" value="${safe(c.external_url || "")}" placeholder="https://..." /></div>
        <div class="field full"><label>الوصف</label><textarea name="description">${safe(c.description || "")}</textarea></div>
        <div class="field full"><label>نص مباشر اختياري</label><textarea name="text_content">${safe(c.text_content || "")}</textarea></div>
        <div class="field half"><label>وسوم مفصولة بفواصل</label><input name="tags" value="${safe(Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || ""))}" /></div>
        <div class="field third"><label>الترتيب</label><input type="number" name="sort_order" value="${safe(c.sort_order || 0)}" /></div>
        <div class="field third"><label>مثبت</label><select name="is_pinned"><option value="false">لا</option><option value="true" ${c.is_pinned ? "selected" : ""}>نعم</option></select></div>
        <div class="field third"><label>الحالة</label><select name="is_active"><option value="true">ظاهر</option><option value="false" ${c.is_active === false ? "selected" : ""}>مخفي</option></select></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${icon("fa-solid fa-floppy-disk")} حفظ</button>
        <button class="btn btn-soft" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </form>
  `);
  $("contentForm").onsubmit = saveContent;
}

async function saveContent(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.is_active = payload.is_active === "true";
  payload.is_pinned = payload.is_pinned === "true";
  const url = payload.id ? "/api/admin/update-content" : "/api/admin/contents";
  try {
    await api(url, { method: "POST", body: JSON.stringify(payload) });
    closeModal();
    toast("تم حفظ المحتوى", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function deleteContent(id) {
  if (!confirm("هل تريد حذف هذا المحتوى؟")) return;
  try {
    await api("/api/admin/delete-content", { method: "POST", body: JSON.stringify({ id }) });
    toast("تم حذف المحتوى", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

function openChannelModal(id = null) {
  const ch = id ? state.channels.find(x => String(x.id) === String(id)) : {};
  openModal(id ? "تعديل قناة" : "إضافة قناة", `
    <form id="channelForm">
      <input type="hidden" name="id" value="${safe(ch.id || "")}" />
      <div class="grid-form">
        <div class="field half"><label>اسم القناة</label><input name="title" value="${safe(ch.title || "")}" required /></div>
        <div class="field half"><label>Channel ID</label><input name="channel_id" value="${safe(ch.channel_id || "")}" required placeholder="-1003917305732" /></div>
        <div class="field half"><label>Username اختياري</label><input name="username" value="${safe(ch.username || "")}" placeholder="@channel" /></div>
        <div class="field half"><label>الترتيب</label><input name="sort_order" type="number" value="${safe(ch.sort_order || 0)}" /></div>
        <div class="field full"><label>الوصف</label><textarea name="description">${safe(ch.description || "")}</textarea></div>
        <div class="field half"><label>الحالة</label><select name="is_active"><option value="true">مفعلة</option><option value="false" ${ch.is_active === false ? "selected" : ""}>مخفية</option></select></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${icon("fa-solid fa-floppy-disk")} حفظ</button>
        <button class="btn btn-soft" type="button" onclick="closeModal()">إلغاء</button>
      </div>
    </form>
  `);
  $("channelForm").onsubmit = saveChannel;
}

async function saveChannel(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.is_active = payload.is_active === "true";
  const url = payload.id ? "/api/admin/update-channel" : "/api/admin/channels";
  try {
    await api(url, { method: "POST", body: JSON.stringify(payload) });
    closeModal();
    toast("تم حفظ القناة", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function deleteChannel(id) {
  if (!confirm("هل تريد حذف القناة؟ لن يحذف هذا ملفات تليجرام.")) return;
  try {
    await api("/api/admin/delete-channel", { method: "POST", body: JSON.stringify({ id }) });
    toast("تم حذف القناة", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function checkHealth() {
  try {
    const h = await api("/api/admin/health");
    console.log("Health", h);
    toast("النظام يعمل. افتح Console لمشاهدة التفاصيل.", "success");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function seedData() {
  try {
    const result = await api("/api/admin/seed", { method: "POST", body: JSON.stringify({}) });
    toast(result.message || "تمت العملية", "success");
    await loadAll();
  } catch (error) {
    toast(error.message, "error");
  }
}

function exportJson() {
  const data = state.view === "structure" ? state.nodes : state.view === "contents" ? state.contents : state.channels;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ust-bot-${state.view}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function goView(view) {
  state.view = view;
  renderTabs();
  render();
}

window.openNodeModal = openNodeModal;
window.openContentModal = openContentModal;
window.openChannelModal = openChannelModal;
window.deleteNode = deleteNode;
window.deleteContent = deleteContent;
window.deleteChannel = deleteChannel;
window.checkHealth = checkHealth;
window.seedData = seedData;
window.exportJson = exportJson;
window.goView = goView;
window.refreshUsers = refreshUsers;
window.refreshLogs = refreshLogs;
window.loadAll = loadAll;

document.addEventListener("DOMContentLoaded", async () => {
  if (localStorage.getItem("UST_PANEL_DARK") === "1") document.body.classList.add("dark");

  if (!state.password) {
    renderLogin();
    return;
  }

  showApp();
  await loadAll();
});
