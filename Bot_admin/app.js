const state = {
  password: localStorage.getItem("ust_admin_password") || "",
  channels: [],
  files: [],
  stats: null,
  recentUsers: [],
  recentLogs: [],
  topFiles: [],
  currentView: "dashboardView",
  editingChannelId: null,
  editingFileId: null,
  filters: {
    search: "",
    year: "",
    subject: "",
    section: ""
  }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const els = {
  loginScreen: $("#loginScreen"),
  appShell: $("#appShell"),
  loginForm: $("#loginForm"),
  passwordInput: $("#passwordInput"),
  togglePassword: $("#togglePassword"),
  logoutBtn: $("#logoutBtn"),
  refreshBtn: $("#refreshBtn"),
  healthBtn: $("#healthBtn"),
  healthBtn2: $("#healthBtn2"),
  pageTitle: $("#pageTitle"),
  globalSearch: $("#globalSearch"),
  mobileMenuBtn: $("#mobileMenuBtn"),
  toastZone: $("#toastZone"),
  modal: $("#modal"),
  modalContent: $("#modalContent"),
  modalClose: $("#modalClose"),
  statFiles: $("#statFiles"),
  statActiveFiles: $("#statActiveFiles"),
  statChannels: $("#statChannels"),
  statUsers: $("#statUsers"),
  topFilesList: $("#topFilesList"),
  recentLogsList: $("#recentLogsList"),
  channelsGrid: $("#channelsGrid"),
  channelsCount: $("#channelsCount"),
  filesTable: $("#filesTable"),
  usersList: $("#usersList"),
  logsList: $("#logsList"),
  fileChannel: $("#fileChannel"),
  channelForm: $("#channelForm"),
  fileForm: $("#fileForm"),
  seedBtn: $("#seedBtn"),
  filterYear: $("#filterYear"),
  filterSubject: $("#filterSubject"),
  filterSection: $("#filterSection"),
  copyWebhookBtn: $("#copyWebhookBtn"),
  runHealthBtn: $("#runHealthBtn"),
  exportFilesBtn: $("#exportFilesBtn"),
  clearLocalBtn: $("#clearLocalBtn"),
  parseLinkBtn: $("#parseLinkBtn"),
  directFileInput: $("#directFileInput"),
  directUploadBtn: $("#directUploadBtn"),
  resetFileForm: $("#resetFileForm"),
  resetChannelForm: $("#resetChannelForm")
};

const titles = {
  dashboardView: "الرئيسية",
  channelsView: "إدارة القنوات",
  filesView: "مكتبة الملفات",
  addFileView: "إضافة ملف",
  usersView: "الطلاب والنشاط",
  settingsView: "الأدوات"
};

function iconForType(type) {
  const icons = {
    pdf: "fa-solid fa-file-pdf",
    recording: "fa-solid fa-headphones",
    lab: "fa-solid fa-vial",
    summary: "fa-solid fa-note-sticky",
    question: "fa-solid fa-circle-question",
    other: "fa-solid fa-paperclip"
  };
  return icons[type] || icons.other;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("ar", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function unique(list, key) {
  return [...new Set(list.map(item => item[key]).filter(Boolean))];
}

function toast(message, type = "info") {
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-xmark",
    info: "fa-circle-info"
  };

  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <div>${escapeHtml(message)}</div>
  `;

  els.toastZone.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateX(-16px)";
    setTimeout(() => node.remove(), 220);
  }, 3600);
}

function openModal(html) {
  els.modalContent.innerHTML = html;
  els.modal.classList.remove("hidden");
}

function closeModal() {
  els.modal.classList.add("hidden");
  els.modalContent.innerHTML = "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": state.password,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: false, message: text };
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `Request failed: ${response.status}`);
  }

  return data;
}

function showApp() {
  els.loginScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
}

function showLogin() {
  els.appShell.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
}

function requirePassword() {
  if (state.password) {
    els.passwordInput.value = state.password;
    showApp();
    refreshAll();
  } else {
    showLogin();
  }
}

function setView(viewId) {
  state.currentView = viewId;
  $$(".view").forEach(view => view.classList.toggle("active-view", view.id === viewId));
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === viewId));
  els.pageTitle.textContent = titles[viewId] || "لوحة التحكم";
  document.body.classList.remove("sidebar-open");

  if (viewId === "filesView") renderFiles();
  if (viewId === "channelsView") renderChannels();
  if (viewId === "addFileView") populateFileFormLists();
  if (viewId === "usersView") renderUsersAndLogs();
}

function setLoadingButton(button, loading, text) {
  if (!button) return;
  if (loading) {
    button.dataset.oldHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text || "جاري التنفيذ..."}`;
  } else {
    button.disabled = false;
    if (button.dataset.oldHtml) button.innerHTML = button.dataset.oldHtml;
  }
}

async function refreshAll() {
  try {
    setLoadingButton(els.refreshBtn, true);
    await Promise.all([loadStats(), loadChannels(), loadFiles()]);
    renderDashboard();
    renderChannels();
    renderFiles();
    populateFileFormLists();
    toast("تم تحديث البيانات", "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoadingButton(els.refreshBtn, false);
  }
}

async function loadStats() {
  const data = await api("/api/admin/stats");
  state.stats = data.stats;
  state.topFiles = data.topFiles || [];
  state.recentLogs = data.recentLogs || [];
  state.recentUsers = data.recentUsers || [];
}

async function loadChannels() {
  const data = await api("/api/admin/channels");
  state.channels = data.channels || [];
}

async function loadFiles() {
  const data = await api("/api/admin/files");
  state.files = data.files || [];
}

function animateNumber(el, value) {
  const end = Number(value || 0);
  const start = Number(el.textContent || 0);
  const duration = 600;
  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.round(start + (end - start) * progress);
    el.textContent = current.toLocaleString("ar");
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function renderDashboard() {
  const stats = state.stats || {};
  animateNumber(els.statFiles, stats.files || 0);
  animateNumber(els.statActiveFiles, stats.activeFiles || 0);
  animateNumber(els.statChannels, stats.channels || 0);
  animateNumber(els.statUsers, stats.users || 0);

  if (!state.topFiles.length) {
    els.topFilesList.innerHTML = `<div class="empty-state">لا توجد ملفات مرسلة بعد.</div>`;
  } else {
    els.topFilesList.innerHTML = state.topFiles.map(file => `
      <div class="list-item">
        <div class="list-icon"><i class="fa-solid fa-ranking-star"></i></div>
        <div class="list-content">
          <h4>${escapeHtml(file.title)}</h4>
          <p>${escapeHtml(file.subject_name || "-")} / ${escapeHtml(file.section_name || "-")}</p>
        </div>
        <span class="count-badge">${Number(file.downloads_count || 0).toLocaleString("ar")}</span>
      </div>
    `).join("");
  }

  const logs = state.recentLogs || [];
  els.recentLogsList.innerHTML = logs.length ? logs.map(log => `
    <div class="timeline-item">
      <strong>${escapeHtml(log.action)}</strong>
      <p>${formatDate(log.created_at)} - Chat: ${escapeHtml(log.chat_id || "-")}</p>
    </div>
  `).join("") : `<div class="empty-state">لا يوجد نشاط بعد.</div>`;

  renderUsersAndLogs();
}

function renderChannels() {
  els.channelsCount.textContent = state.channels.length.toLocaleString("ar");

  if (!state.channels.length) {
    els.channelsGrid.innerHTML = `<div class="empty-state">لم تضف أي قناة بعد.</div>`;
    updateChannelSelect();
    return;
  }

  els.channelsGrid.innerHTML = state.channels.map(channel => `
    <article class="channel-card" style="--channel-color:${escapeHtml(channel.color || "#38bdf8")}">
      <div class="channel-top">
        <div class="channel-icon"><i class="${escapeHtml(channel.icon || "fa-solid fa-broadcast-tower")}"></i></div>
        <span class="status-pill ${channel.is_active ? "" : "off"}">${channel.is_active ? "مفعّلة" : "معطلة"}</span>
      </div>
      <h4>${escapeHtml(channel.title)}</h4>
      <p><i class="fa-solid fa-hashtag"></i> ${escapeHtml(channel.channel_id)}</p>
      <p><i class="fa-solid fa-layer-group"></i> ${escapeHtml(channel.category || "main")}</p>
      ${channel.notes ? `<p>${escapeHtml(channel.notes)}</p>` : ""}
      <div class="card-actions">
        <button data-edit-channel="${channel.id}"><i class="fa-solid fa-pen"></i></button>
        <button data-copy-channel="${escapeHtml(channel.channel_id)}"><i class="fa-solid fa-copy"></i></button>
        <button data-delete-channel="${channel.id}"><i class="fa-solid fa-trash"></i></button>
      </div>
    </article>
  `).join("");

  updateChannelSelect();
}

function updateChannelSelect() {
  const options = state.channels
    .filter(channel => channel.is_active !== false)
    .map(channel => `<option value="${escapeHtml(channel.channel_id)}">${escapeHtml(channel.title)} - ${escapeHtml(channel.channel_id)}</option>`)
    .join("");

  els.fileChannel.innerHTML = options || `<option value="">لا توجد قنوات</option>`;
}

function populateDatalist(id, values) {
  const node = $(id);
  if (!node) return;
  node.innerHTML = values.map(value => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function populateFileFormLists() {
  populateDatalist("#yearsList", unique(state.files, "year_name"));
  populateDatalist("#termsList", unique(state.files, "term_name").concat(["ترم اول", "ترم ثاني"]));
  populateDatalist("#subjectsList", unique(state.files, "subject_name").concat(["anatomy", "physiology", "histology", "biochemistry", "pathology", "pharmacology", "microbiology"]));
  populateDatalist("#sectionsList", unique(state.files, "section_name").concat(["PDF 📚", "Lab 🔬", "Recordings 🎧", "Summary 📝", "Questions ❓"]));
  updateChannelSelect();
  populateFilters();
}

function populateFilters() {
  const oldYear = els.filterYear.value;
  const oldSubject = els.filterSubject.value;
  const oldSection = els.filterSection.value;

  els.filterYear.innerHTML = `<option value="">كل السنوات</option>` + unique(state.files, "year_name").map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  els.filterSubject.innerHTML = `<option value="">كل المواد</option>` + unique(state.files, "subject_name").map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  els.filterSection.innerHTML = `<option value="">كل الأقسام</option>` + unique(state.files, "section_name").map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");

  els.filterYear.value = oldYear;
  els.filterSubject.value = oldSubject;
  els.filterSection.value = oldSection;
}

function getFilteredFiles() {
  const q = state.filters.search.toLowerCase().trim();

  return state.files.filter(file => {
    const matchesYear = !state.filters.year || file.year_name === state.filters.year;
    const matchesSubject = !state.filters.subject || file.subject_name === state.filters.subject;
    const matchesSection = !state.filters.section || file.section_name === state.filters.section;
    const haystack = [
      file.title,
      file.description,
      file.year_name,
      file.term_name,
      file.subject_name,
      file.section_name,
      file.channel_id,
      ...(file.tags || [])
    ].join(" ").toLowerCase();
    const matchesSearch = !q || haystack.includes(q);

    return matchesYear && matchesSubject && matchesSection && matchesSearch;
  });
}

function renderFiles() {
  const files = getFilteredFiles();
  populateFilters();

  if (!files.length) {
    els.filesTable.innerHTML = `<div class="empty-state">لا توجد ملفات مطابقة.</div>`;
    return;
  }

  els.filesTable.innerHTML = `
    <table class="files-table">
      <thead>
        <tr>
          <th>الملف</th>
          <th>المسار</th>
          <th>القناة</th>
          <th>Message</th>
          <th>الوسوم</th>
          <th>الإرسال</th>
          <th>الحالة</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${files.map(file => `
          <tr>
            <td>
              <div class="file-title-cell">
                <strong><i class="${iconForType(file.file_type)}"></i> ${escapeHtml(file.title)}</strong>
                <small>${escapeHtml(file.description || "بدون وصف")}</small>
              </div>
            </td>
            <td>${escapeHtml(file.year_name)}<br><small>${escapeHtml(file.term_name)} / ${escapeHtml(file.subject_name)} / ${escapeHtml(file.section_name)}</small></td>
            <td>${escapeHtml(file.channel_id)}</td>
            <td>${escapeHtml(file.message_id)}</td>
            <td><div class="tag-list">${(file.tags || []).slice(0, 4).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div></td>
            <td>${Number(file.downloads_count || 0).toLocaleString("ar")}</td>
            <td><span class="status-pill ${file.is_active ? "" : "off"}">${file.is_active ? "مفعل" : "معطل"}</span></td>
            <td>
              <div class="row-actions">
                <button title="تعديل" data-edit-file="${file.id}"><i class="fa-solid fa-pen"></i></button>
                <button title="${file.is_active ? "تعطيل" : "تفعيل"}" data-toggle-file="${file.id}" data-active="${file.is_active ? "0" : "1"}"><i class="fa-solid ${file.is_active ? "fa-eye-slash" : "fa-eye"}"></i></button>
                <button title="نسخ الرابط" data-copy-link="${escapeHtml(file.telegram_link || "")}"><i class="fa-solid fa-link"></i></button>
                <button title="حذف" data-delete-file="${file.id}"><i class="fa-solid fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderUsersAndLogs() {
  const users = state.recentUsers || [];
  const logs = state.recentLogs || [];

  els.usersList.innerHTML = users.length ? users.map(user => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || `Chat ${user.chat_id}`;
    return `
      <div class="list-item">
        <div class="list-icon"><i class="fa-solid fa-user-graduate"></i></div>
        <div class="list-content">
          <h4>${escapeHtml(name)}</h4>
          <p>@${escapeHtml(user.username || "-")} · رسائل: ${Number(user.messages_count || 0).toLocaleString("ar")}</p>
          <p>${formatDate(user.last_seen)}</p>
        </div>
      </div>
    `;
  }).join("") : `<div class="empty-state">لم يستخدم أحد البوت بعد.</div>`;

  els.logsList.innerHTML = logs.length ? logs.map(log => `
    <div class="timeline-item">
      <strong>${escapeHtml(log.action)}</strong>
      <p>${formatDate(log.created_at)} · Chat ID: ${escapeHtml(log.chat_id || "-")}</p>
      <p>${escapeHtml(JSON.stringify(log.details || {})).slice(0, 160)}</p>
    </div>
  `).join("") : `<div class="empty-state">لا يوجد سجل نشاط.</div>`;
}

function resetChannelForm() {
  state.editingChannelId = null;
  $("#channelIdHidden").value = "";
  $("#channelTitle").value = "";
  $("#channelTelegramId").value = "";
  $("#channelUsername").value = "";
  $("#channelCategory").value = "";
  $("#channelColor").value = "#2563eb";
  $("#channelIcon").value = "fa-solid fa-broadcast-tower";
  $("#channelNotes").value = "";
}

function fillChannelForm(channel) {
  state.editingChannelId = channel.id;
  $("#channelIdHidden").value = channel.id;
  $("#channelTitle").value = channel.title || "";
  $("#channelTelegramId").value = channel.channel_id || "";
  $("#channelUsername").value = channel.username || "";
  $("#channelCategory").value = channel.category || "";
  $("#channelColor").value = channel.color || "#2563eb";
  $("#channelIcon").value = channel.icon || "fa-solid fa-broadcast-tower";
  $("#channelNotes").value = channel.notes || "";
  setView("channelsView");
  toast("تم تحميل بيانات القناة للتعديل", "info");
}

function getChannelFormData() {
  return {
    id: $("#channelIdHidden").value || undefined,
    title: $("#channelTitle").value.trim(),
    channel_id: $("#channelTelegramId").value.trim(),
    username: $("#channelUsername").value.trim(),
    category: $("#channelCategory").value.trim(),
    color: $("#channelColor").value,
    icon: $("#channelIcon").value.trim(),
    notes: $("#channelNotes").value.trim(),
    is_active: true
  };
}

function resetFileForm() {
  state.editingFileId = null;
  $("#fileIdHidden").value = "";
  $("#yearName").value = "";
  $("#termName").value = "";
  $("#subjectName").value = "";
  $("#sectionName").value = "";
  $("#fileTitle").value = "";
  $("#fileType").value = "pdf";
  $("#fileDescription").value = "";
  $("#messageId").value = "";
  $("#sortOrder").value = "0";
  $("#telegramLink").value = "";
  $("#fileTags").value = "";
  updateChannelSelect();
}

function fillFileForm(file) {
  state.editingFileId = file.id;
  $("#fileIdHidden").value = file.id;
  $("#yearName").value = file.year_name || "";
  $("#termName").value = file.term_name || "";
  $("#subjectName").value = file.subject_name || "";
  $("#sectionName").value = file.section_name || "";
  $("#fileTitle").value = file.title || "";
  $("#fileType").value = file.file_type || "pdf";
  $("#fileDescription").value = file.description || "";
  $("#fileChannel").value = file.channel_id || "";
  $("#messageId").value = file.message_id || "";
  $("#sortOrder").value = file.sort_order || 0;
  $("#telegramLink").value = file.telegram_link || "";
  $("#fileTags").value = (file.tags || []).join(", ");
  setView("addFileView");
  toast("تم تحميل بيانات الملف للتعديل", "info");
}

function getFileFormData() {
  return {
    id: $("#fileIdHidden").value || undefined,
    year_name: $("#yearName").value.trim(),
    term_name: $("#termName").value.trim(),
    subject_name: $("#subjectName").value.trim(),
    section_name: $("#sectionName").value.trim(),
    title: $("#fileTitle").value.trim(),
    file_type: $("#fileType").value,
    description: $("#fileDescription").value.trim(),
    channel_id: $("#fileChannel").value,
    message_id: Number($("#messageId").value || 0),
    sort_order: Number($("#sortOrder").value || 0),
    telegram_link: $("#telegramLink").value.trim(),
    tags: $("#fileTags").value.trim(),
    is_active: true
  };
}

function parseTelegramLink(link) {
  const privateMatch = String(link || "").match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (privateMatch) {
    return {
      channel_id: `-100${privateMatch[1]}`,
      message_id: Number(privateMatch[2])
    };
  }

  const publicMatch = String(link || "").match(/t\.me\/([A-Za-z0-9_]+)\/(\d+)/);
  if (publicMatch && publicMatch[1] !== "c") {
    return { username: publicMatch[1], message_id: Number(publicMatch[2]) };
  }

  return null;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function directUploadSelectedFile() {
  const file = els.directFileInput?.files?.[0];

  if (!file) {
    toast("اختر ملفًا أولاً", "error");
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    toast("الملف كبير للرفع المباشر. ارفعه داخل القناة ثم الصق الرابط.", "error");
    return;
  }

  const body = getFileFormData();
  const required = ["title", "year_name", "term_name", "subject_name", "section_name", "channel_id"];
  const missing = required.filter(key => !body[key]);

  if (missing.length) {
    toast(`أكمل الحقول قبل الرفع: ${missing.join(", ")}`, "error");
    return;
  }

  try {
    setLoadingButton(els.directUploadBtn, true, "جاري الرفع...");
    const fileBase64 = await fileToBase64(file);
    await api("/api/admin/upload-direct", {
      method: "POST",
      body: {
        ...body,
        file_base64: fileBase64,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream"
      }
    });

    toast("تم رفع الملف للقناة وحفظه في Supabase", "success");
    resetFileForm();
    if (els.directFileInput) els.directFileInput.value = "";
    await Promise.all([loadFiles(), loadStats()]);
    populateFileFormLists();
    renderFiles();
    renderDashboard();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoadingButton(els.directUploadBtn, false);
  }
}

async function copyText(text) {
  if (!text) {
    toast("لا يوجد نص لنسخه", "error");
    return;
  }
  await navigator.clipboard.writeText(text);
  toast("تم النسخ", "success");
}

async function runHealth() {
  try {
    setLoadingButton(els.healthBtn, true);
    setLoadingButton(els.healthBtn2, true);
    setLoadingButton(els.runHealthBtn, true);
    const data = await api("/api/admin/health");
    const checks = data.checks || {};

    const html = `
      <h2>فحص حالة النظام</h2>
      <div class="fancy-list" style="margin-top:16px">
        <div class="list-item"><div class="list-icon"><i class="fa-solid fa-server"></i></div><div class="list-content"><h4>Vercel</h4><p>${checks.vercel ? "يعمل" : "مشكلة"}</p></div></div>
        <div class="list-item"><div class="list-icon"><i class="fa-solid fa-database"></i></div><div class="list-content"><h4>Supabase</h4><p>${checks.supabase ? "متصل" : escapeHtml(checks.supabase_error || "مشكلة")}</p></div></div>
        <div class="list-item"><div class="list-icon"><i class="fa-brands fa-telegram"></i></div><div class="list-content"><h4>Telegram Bot</h4><p>${checks.telegram ? `متصل: @${escapeHtml(checks.bot?.username || "")}` : escapeHtml(checks.telegram_error || "مشكلة")}</p></div></div>
      </div>
    `;

    $("#healthText").textContent = checks.supabase && checks.telegram ? "كل شيء متصل بنجاح ✅" : "يوجد شيء يحتاج فحص ⚠️";
    openModal(html);
    toast("اكتمل الفحص", checks.supabase && checks.telegram ? "success" : "error");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoadingButton(els.healthBtn, false);
    setLoadingButton(els.healthBtn2, false);
    setLoadingButton(els.runHealthBtn, false);
  }
}

async function seedData() {
  const yes = confirm("سيتم إضافة قناة وملف تجريبي. هل تريد المتابعة؟");
  if (!yes) return;

  try {
    setLoadingButton(els.seedBtn, true);
    await api("/api/admin/seed", { method: "POST", body: {} });
    toast("تمت إضافة بيانات التجربة", "success");
    await refreshAll();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoadingButton(els.seedBtn, false);
  }
}

function exportFiles() {
  const payload = {
    exported_at: new Date().toISOString(),
    files: state.files
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ust-bot-files-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("تم تصدير الملفات", "success");
}

function bindEvents() {
  els.loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const password = els.passwordInput.value.trim();
    if (!password) return toast("اكتب كلمة سر المدير", "error");

    state.password = password;
    localStorage.setItem("ust_admin_password", password);
    showApp();
    await refreshAll();
  });

  els.togglePassword.addEventListener("click", () => {
    const input = els.passwordInput;
    input.type = input.type === "password" ? "text" : "password";
    els.togglePassword.innerHTML = input.type === "password" ? `<i class="fa-solid fa-eye"></i>` : `<i class="fa-solid fa-eye-slash"></i>`;
  });

  els.logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("ust_admin_password");
    state.password = "";
    showLogin();
    toast("تم تسجيل الخروج", "info");
  });

  els.refreshBtn.addEventListener("click", refreshAll);
  els.healthBtn.addEventListener("click", runHealth);
  els.healthBtn2.addEventListener("click", runHealth);
  els.runHealthBtn.addEventListener("click", runHealth);
  els.seedBtn.addEventListener("click", seedData);
  els.mobileMenuBtn.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  els.modalClose.addEventListener("click", closeModal);
  els.modal.addEventListener("click", event => { if (event.target === els.modal) closeModal(); });

  $$(".nav-item").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $$('[data-jump]').forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.jump));
  });

  els.globalSearch.addEventListener("input", event => {
    state.filters.search = event.target.value;
    if (state.currentView !== "filesView") setView("filesView");
    renderFiles();
  });

  els.filterYear.addEventListener("change", event => { state.filters.year = event.target.value; renderFiles(); });
  els.filterSubject.addEventListener("change", event => { state.filters.subject = event.target.value; renderFiles(); });
  els.filterSection.addEventListener("change", event => { state.filters.section = event.target.value; renderFiles(); });

  els.channelForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter;
    const body = getChannelFormData();

    try {
      setLoadingButton(button, true, "جاري الحفظ...");
      const method = body.id ? "PATCH" : "POST";
      await api("/api/admin/channels", { method, body });
      toast(body.id ? "تم تعديل القناة" : "تمت إضافة القناة", "success");
      resetChannelForm();
      await loadChannels();
      renderChannels();
      populateFileFormLists();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoadingButton(button, false);
    }
  });

  els.resetChannelForm.addEventListener("click", resetChannelForm);

  els.fileForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter;
    const body = getFileFormData();

    try {
      setLoadingButton(button, true, "جاري حفظ الملف...");
      const method = body.id ? "PATCH" : "POST";
      await api("/api/admin/files", { method, body });
      toast(body.id ? "تم تعديل الملف" : "تمت إضافة الملف", "success");
      resetFileForm();
      await Promise.all([loadFiles(), loadStats()]);
      populateFileFormLists();
      renderFiles();
      renderDashboard();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoadingButton(button, false);
    }
  });

  els.resetFileForm.addEventListener("click", resetFileForm);

  els.parseLinkBtn.addEventListener("click", () => {
    const link = $("#telegramLink").value.trim();
    const parsed = parseTelegramLink(link);

    if (!parsed) {
      toast("الرابط غير صحيح. مثال: https://t.me/c/3917305732/3", "error");
      return;
    }

    if (parsed.channel_id) {
      const found = state.channels.find(channel => channel.channel_id === parsed.channel_id);
      if (found) {
        $("#fileChannel").value = parsed.channel_id;
      } else {
        toast(`استخرجت Channel ID: ${parsed.channel_id} لكن القناة غير موجودة في القائمة`, "info");
      }
    }

    $("#messageId").value = parsed.message_id;
    toast("تم استخراج بيانات الرابط", "success");
  });

  if (els.directUploadBtn) {
    els.directUploadBtn.addEventListener("click", directUploadSelectedFile);
  }

  $$(".template-chips button").forEach(button => {
    button.addEventListener("click", () => {
      const [year, term, subject, section] = button.dataset.template.split("|");
      $("#yearName").value = year;
      $("#termName").value = term;
      $("#subjectName").value = subject;
      $("#sectionName").value = section;
      toast("تم تطبيق القالب", "success");
    });
  });

  document.addEventListener("click", async event => {
    const editChannel = event.target.closest("[data-edit-channel]");
    const copyChannel = event.target.closest("[data-copy-channel]");
    const deleteChannel = event.target.closest("[data-delete-channel]");
    const editFile = event.target.closest("[data-edit-file]");
    const toggleFile = event.target.closest("[data-toggle-file]");
    const deleteFile = event.target.closest("[data-delete-file]");
    const copyLink = event.target.closest("[data-copy-link]");

    if (editChannel) {
      const id = Number(editChannel.dataset.editChannel);
      const channel = state.channels.find(item => item.id === id);
      if (channel) fillChannelForm(channel);
    }

    if (copyChannel) {
      await copyText(copyChannel.dataset.copyChannel);
    }

    if (deleteChannel) {
      const id = deleteChannel.dataset.deleteChannel;
      if (!confirm("هل تريد حذف القناة؟ لن يحذف الملفات من تليجرام، فقط من Supabase.")) return;
      try {
        await api(`/api/admin/channels?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        toast("تم حذف القناة", "success");
        await loadChannels();
        renderChannels();
      } catch (error) {
        toast(error.message, "error");
      }
    }

    if (editFile) {
      const id = Number(editFile.dataset.editFile);
      const file = state.files.find(item => item.id === id);
      if (file) fillFileForm(file);
    }

    if (toggleFile) {
      try {
        const id = Number(toggleFile.dataset.toggleFile);
        const isActive = toggleFile.dataset.active === "1";
        await api("/api/admin/toggle-file", { method: "POST", body: { id, is_active: isActive } });
        toast(isActive ? "تم تفعيل الملف" : "تم تعطيل الملف", "success");
        await Promise.all([loadFiles(), loadStats()]);
        renderFiles();
        renderDashboard();
      } catch (error) {
        toast(error.message, "error");
      }
    }

    if (deleteFile) {
      const id = deleteFile.dataset.deleteFile;
      if (!confirm("هل تريد حذف الملف من قاعدة البيانات؟ لن يحذف من تليجرام.")) return;
      try {
        await api(`/api/admin/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        toast("تم حذف الملف", "success");
        await Promise.all([loadFiles(), loadStats()]);
        renderFiles();
        renderDashboard();
      } catch (error) {
        toast(error.message, "error");
      }
    }

    if (copyLink) {
      await copyText(copyLink.dataset.copyLink);
    }
  });

  els.copyWebhookBtn.addEventListener("click", () => {
    const url = `${location.origin}/api/webhook`;
    copyText(url);
  });

  els.exportFilesBtn.addEventListener("click", exportFiles);

  els.clearLocalBtn.addEventListener("click", () => {
    localStorage.removeItem("ust_admin_password");
    state.password = "";
    toast("تم حذف كلمة السر من المتصفح", "success");
    showLogin();
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      els.globalSearch.focus();
    }

    if (event.key === "Escape") {
      closeModal();
      document.body.classList.remove("sidebar-open");
    }
  });
}

bindEvents();
requirePassword();
