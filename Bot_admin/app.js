// public/admin/app.js
// لوحة تحكم بوت اللجنة العلمية المركزية - Frontend فقط

const STORE_KEY = 'UST_CENTRAL_BOT_ADMIN_PASSWORD';
const API = {
  auth: '/api/admin/auth',
  health: '/api/admin/health',
  stats: '/api/admin/stats',
  lists: '/api/admin/lists',
  channels: '/api/admin/channels',
  deleteChannel: '/api/admin/delete-channel',
  files: '/api/admin/files',
  addFile: '/api/admin/add-file',
  updateFile: '/api/admin/update-file',
  toggleFile: '/api/admin/toggle-file',
  deleteFile: '/api/admin/delete-file',
  users: '/api/admin/users',
  seed: '/api/admin/seed',
  sendTest: '/api/admin/send-test'
};

const state = {
  password: localStorage.getItem(STORE_KEY) || '',
  view: 'dashboard',
  channels: [],
  files: [],
  users: [],
  stats: null,
  lists: { years: [], terms: [], subjects: [], sections: [], content_types: [] },
  filters: { q: '', year: '', subject: '', type: '' }
};

const app = document.getElementById('app');

function i(name){ return `<i class="fa-solid fa-${name}"></i>`; }
function esc(v){ return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function toast(message, type='info'){
  let box = document.querySelector('.toast-box');
  if(!box){ box=document.createElement('div'); box.className='toast-box'; document.body.appendChild(box); }
  const el=document.createElement('div'); el.className=`toast ${type}`;
  el.innerHTML=`${i(type==='success'?'circle-check':type==='error'?'triangle-exclamation':'circle-info')}<span>${esc(message)}</span>`;
  box.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(14px)'; setTimeout(()=>el.remove(),260); },3600);
}

async function apiFetch(url, options={}){
  const password = localStorage.getItem(STORE_KEY) || state.password || '';
  const headers = { 'Content-Type':'application/json', 'x-admin-password': password, ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

  if(response.status === 401){
    throw new Error('Unauthorized: كلمة السر غير صحيحة أو ADMIN_PASSWORD غير مضبوط في Vercel');
  }

  if(!response.ok){
    const msg = data?.message || data?.error || text || 'حدث خطأ في الطلب';
    throw new Error(`${url}: ${msg}`);
  }

  if(data && data.ok === false){
    const msg = data?.message || data?.error || 'حدث خطأ في الطلب';
    throw new Error(`${url}: ${msg}`);
  }

  return data || {};
}

function setView(view){ state.view=view; renderShell(); }
window.setView = setView;

function renderLogin(){
  app.innerHTML = `
    <main class="login-screen">
      <div class="orb orb-1"></div><div class="orb orb-2"></div>
      <section class="login-card">
        <div class="logo-badge">${i('robot')}</div>
        <p class="eyebrow">بوت اللجنة العلمية المركزية</p>
        <h1>لوحة التحكم</h1>
        <p class="muted">أدخل كلمة السر الموجودة في Vercel باسم <b>ADMIN_PASSWORD</b>. لا تكتب توكن البوت هنا.</p>
        <form id="loginForm">
          <div class="field"><label>كلمة السر</label><div class="control">${i('lock')}<input id="passwordInput" type="password" placeholder="ADMIN_PASSWORD" required /></div></div>
          <button class="primary-btn" style="width:100%" type="submit">${i('right-to-bracket')} دخول</button>
        </form>
        <p class="muted" style="font-size:13px;margin-top:14px">إذا ظهر Unauthorized: تأكد من ADMIN_PASSWORD ثم Redeploy.</p>
      </section>
    </main>`;
  document.getElementById('loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pass = document.getElementById('passwordInput').value.trim();
    state.password = pass;
    localStorage.setItem(STORE_KEY, pass);
    try{
      await apiFetch(API.auth);
      toast('تم تسجيل الدخول بنجاح','success');
      await loadAll();
      renderShell();
    }catch(err){ localStorage.removeItem(STORE_KEY); toast(err.message,'error'); }
  });
}

function renderShell(){
  app.innerHTML = `
    <main class="admin-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-icon">${i('graduation-cap')}</div><div><h2>اللجنة العلمية</h2><p>Central Scientific Bot</p></div></div>
        <nav class="nav">${navButtons()}</nav>
        <div class="sidebar-footer"><button class="ghost-btn" onclick="checkHealth()">${i('heart-pulse')} فحص النظام</button><button class="danger-btn" onclick="logout()">${i('right-from-bracket')} خروج</button></div>
      </aside>
      <section class="content">
        <header class="topbar"><div><p class="eyebrow">لوحة تحكم بوت تليجرام</p><h1>${title()}</h1></div><div class="top-actions"><button class="soft-btn" onclick="refreshAll()">${i('rotate')} تحديث</button><button class="primary-btn" onclick="setView('add')">${i('plus')} إضافة محتوى</button></div></header>
        <section id="view"></section>
      </section>
      <nav class="mobile-nav">${mobileButtons()}</nav>
    </main>`;
  renderView();
}

function navButtons(){
  const items=[['dashboard','chart-line','الرئيسية'],['channels','tower-broadcast','القنوات'],['files','folder-open','المحتوى'],['add','plus','إضافة'],['users','users','الطلاب']];
  return items.map(([v,ic,t])=>`<button class="${state.view===v?'active':''}" onclick="setView('${v}')">${i(ic)} ${t}</button>`).join('');
}
function mobileButtons(){
  const items=[['dashboard','chart-line','الرئيسية'],['channels','tower-broadcast','القنوات'],['files','folder-open','المحتوى'],['add','plus','إضافة'],['users','users','الطلاب']];
  return items.map(([v,ic,t])=>`<button class="${state.view===v?'active':''}" onclick="setView('${v}')">${i(ic)}<br>${t}</button>`).join('');
}
function title(){ return ({dashboard:'الرئيسية',channels:'إدارة القنوات',files:'المحتوى والملفات',add:'إضافة محتوى جديد',users:'مستخدمي البوت'}[state.view] || 'لوحة التحكم'); }

function renderView(){
  const view = document.getElementById('view');
  if(state.view==='dashboard') return renderDashboard(view);
  if(state.view==='channels') return renderChannels(view);
  if(state.view==='files') return renderFiles(view);
  if(state.view==='add') return renderAdd(view);
  if(state.view==='users') return renderUsers(view);
}

function renderDashboard(view){
  const s = state.stats || {};
  view.innerHTML = `
    <div class="hero">
      <div class="hero-card"><p class="eyebrow" style="color:white">نظام إدارة محتوى البوت</p><h2>تحكم كامل بمحتوى اللجنة العلمية المركزية</h2><p>أضف سنوات، ترمات، مواد، أقسام، PDF، فيديوهات، تسجيلات، روابط، نصوص، وكل شيء يظهر في بوت تليجرام مباشرة من Supabase.</p><div class="hero-actions"><button class="ghost-btn" onclick="setView('add')">${i('sparkles')} أضف محتوى</button><button class="ghost-btn" onclick="checkHealth()">${i('heart-pulse')} فحص النظام</button></div></div>
      <div class="panel"><div class="panel-title"><h2>${i('bolt')} إجراءات سريعة</h2></div><div class="list"><button class="primary-btn" onclick="seedDemo()">${i('wand-magic-sparkles')} إضافة بيانات تجربة</button><button class="soft-btn" onclick="exportFiles()">${i('download')} تصدير JSON</button><button class="soft-btn" onclick="copyWebhook()">${i('link')} نسخ رابط Webhook</button></div></div>
    </div>
    <div class="stats-grid" style="margin-top:18px">
      ${stat('tower-broadcast', s.channels || 0, 'القنوات')}
      ${stat('folder-open', s.files || 0, 'كل المحتوى')}
      ${stat('circle-check', s.active_files || 0, 'مفعل')}
      ${stat('users', s.users || 0, 'طلاب استخدموا البوت')}
      ${stat('calendar-days', s.years || 0, 'سنوات')}
      ${stat('book-medical', s.subjects || 0, 'مواد')}
      ${stat('layer-group', s.sections || 0, 'أقسام')}
      ${stat('eye', s.views || 0, 'مشاهدات')}
    </div>`;
}
function stat(ic,num,label){ return `<div class="stat">${i(ic)}<h3>${num}</h3><p>${label}</p></div>`; }

function renderChannels(view){
  view.innerHTML = `
    <div class="split">
      <form class="panel" id="channelForm"><div class="panel-title"><h2>${i('tower-broadcast')} إضافة قناة</h2></div>
        <div class="field"><label>اسم القناة</label><input name="title" placeholder="قناة ملفات السنة الأولى" required></div>
        <div class="field"><label>Channel ID</label><input name="channel_id" placeholder="-1003917305732" required></div>
        <div class="field"><label>Username اختياري</label><input name="username" placeholder="@channel"></div>
        <div class="field"><label>ملاحظات</label><textarea name="notes" rows="3" placeholder="هذه القناة خاصة بمادة..."></textarea></div>
        <button class="primary-btn" type="submit">${i('floppy-disk')} حفظ القناة</button>
      </form>
      <div class="panel"><div class="panel-title"><h2>${i('list')} القنوات الحالية</h2><button class="soft-btn" onclick="refreshAll()">${i('rotate')}</button></div>
        <div class="list">${state.channels.length ? state.channels.map(channelCard).join('') : '<p class="empty">لا توجد قنوات بعد</p>'}</div>
      </div>
    </div>`;
  document.getElementById('channelForm').addEventListener('submit', addChannel);
}
function channelCard(c){ return `<div class="item"><div><h3>${esc(c.title)}</h3><p>${esc(c.channel_id)} ${c.username?`- ${esc(c.username)}`:''}</p><p>${esc(c.notes||'')}</p></div><button class="icon-btn danger" onclick="deleteChannel(${c.id})">${i('trash')}</button></div>`; }

function renderFiles(view){
  const files = filteredFiles();
  view.innerHTML = `
    <div class="panel">
      <div class="panel-title"><h2>${i('folder-open')} إدارة المحتوى</h2><button class="primary-btn" onclick="setView('add')">${i('plus')} جديد</button></div>
      <div class="toolbar">
        <input id="q" placeholder="بحث..." value="${esc(state.filters.q)}">
        <select id="yearFilter"><option value="">كل السنوات</option>${options(state.lists.years,state.filters.year)}</select>
        <select id="subjectFilter"><option value="">كل المواد</option>${options(state.lists.subjects,state.filters.subject)}</select>
        <select id="typeFilter"><option value="">كل الأنواع</option>${options(['pdf','video','audio','recording','link','text','image','file'],state.filters.type)}</select>
        <button class="soft-btn" onclick="clearFilters()">${i('broom')} مسح</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>العنوان</th><th>المسار</th><th>النوع</th><th>القناة/الرسالة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${files.length?files.map(fileRow).join(''):'<tr><td class="empty" colspan="6">لا يوجد محتوى</td></tr>'}</tbody></table></div>
    </div>`;
  ['q','yearFilter','subjectFilter','typeFilter'].forEach(id=>document.getElementById(id).addEventListener('input', applyFilters));
}
function options(arr, selected=''){ return arr.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join(''); }
function fileRow(f){
  const path = [f.year_name,f.term_name,f.subject_name,f.section_name].filter(Boolean).join(' / ');
  return `<tr><td><b>${f.is_pinned?'📌 ':''}${esc(f.title)}</b><br><small>${esc(f.description||'')}</small></td><td>${esc(path)}</td><td><span class="badge good">${esc(f.content_type||'file')}</span></td><td>${esc(f.channel_id||'')}${f.message_id?`<br>#${f.message_id}`:''}${f.external_url?`<br>🔗 رابط`:''}${f.text_content?`<br>📝 نص`:''}</td><td><span class="badge ${f.is_active===false?'bad':'good'}">${f.is_active===false?'معطل':'مفعل'}</span>${f.is_pinned?'<br><span class="badge pin">مثبت</span>':''}</td><td><div class="row-actions"><button class="icon-btn" onclick="editFile(${f.id})">${i('pen')}</button><button class="icon-btn" onclick="toggleFile(${f.id}, ${f.is_active===false?'true':'false'})">${i(f.is_active===false?'check':'ban')}</button><button class="icon-btn danger" onclick="deleteFile(${f.id})">${i('trash')}</button></div></td></tr>`;
}
function filteredFiles(){
  const q = state.filters.q.toLowerCase();
  return state.files.filter(f=>{
    const text = JSON.stringify(f).toLowerCase();
    return (!q || text.includes(q)) && (!state.filters.year || f.year_name===state.filters.year) && (!state.filters.subject || f.subject_name===state.filters.subject) && (!state.filters.type || f.content_type===state.filters.type);
  });
}
function applyFilters(){ state.filters.q=document.getElementById('q').value.trim(); state.filters.year=document.getElementById('yearFilter').value; state.filters.subject=document.getElementById('subjectFilter').value; state.filters.type=document.getElementById('typeFilter').value; renderFiles(document.getElementById('view')); }
function clearFilters(){ state.filters={q:'',year:'',subject:'',type:''}; renderShell(); }

function renderAdd(view, file=null){
  const f = file || {};
  view.innerHTML = `<form class="panel" id="fileForm"><div class="panel-title"><h2>${i(file?'pen':'plus')} ${file?'تعديل محتوى':'إضافة محتوى جديد'}</h2></div>
    <div class="form-grid">
      ${input('title','العنوان','مثال: Lecture 1 Anatomy PDF',f.title,true)}
      ${select('content_type','نوع المحتوى',['pdf','video','audio','recording','link','text','image','lab','quiz','summary','file'],f.content_type||'pdf')}
      ${input('year_name','السنة','1st year 🔴',f.year_name,true,'years')}
      ${input('term_name','الترم','ترم اول',f.term_name,true,'terms')}
      ${input('subject_name','المادة','anatomy',f.subject_name,true,'subjects')}
      ${input('section_name','القسم','PDF 📚',f.section_name,true,'sections')}
      <div class="field"><label>القناة</label><select name="channel_id"><option value="">اختر القناة</option>${state.channels.map(c=>`<option value="${esc(c.channel_id)}" ${c.channel_id===f.channel_id?'selected':''}>${esc(c.title)} - ${esc(c.channel_id)}</option>`).join('')}</select></div>
      ${input('message_id','Message ID','3',f.message_id||'',false)}
      ${input('telegram_link','رابط رسالة تليجرام','https://t.me/c/3917305732/3',f.telegram_link||'',false,'', 'full')}
      ${input('external_url','رابط خارجي اختياري','https://...',f.external_url||'',false,'', 'full')}
      <div class="field full"><label>النص إذا كان المحتوى نصي</label><textarea name="text_content" rows="4" placeholder="اكتب النص الذي سيرسله البوت">${esc(f.text_content||'')}</textarea></div>
      <div class="field full"><label>الوصف</label><textarea name="description" rows="3" placeholder="وصف مختصر يظهر للطالب">${esc(f.description||'')}</textarea></div>
      ${input('tags','وسوم مفصولة بفواصل','anatomy, pdf, مهم',Array.isArray(f.tags)?f.tags.join(', '):(f.tags||''),false,'','full')}
      ${input('sort_order','الترتيب','0',f.sort_order||0,false)}
      <div class="field"><label>خيارات</label><div class="item"><label><input type="checkbox" name="is_pinned" ${f.is_pinned?'checked':''}> تثبيت</label><label><input type="checkbox" name="is_active" ${f.is_active===false?'':'checked'}> مفعل</label></div></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="primary-btn" type="submit">${i('floppy-disk')} حفظ</button><button type="button" class="soft-btn" onclick="fillTemplate()">${i('wand-magic-sparkles')} تعبئة مثال</button></div>
    ${datalists()}
  </form>`;
  document.getElementById('fileForm').addEventListener('submit', e=>saveFile(e, f.id));
}
function input(name,label,placeholder,value='',required=false,list='',cls=''){ return `<div class="field ${cls}"><label>${label}</label><input name="${name}" ${list?`list="dl-${list}"`:''} placeholder="${esc(placeholder)}" value="${esc(value)}" ${required?'required':''}></div>`; }
function select(name,label,arr,value=''){ return `<div class="field"><label>${label}</label><select name="${name}">${arr.map(x=>`<option value="${esc(x)}" ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`; }
function datalists(){ return ['years','terms','subjects','sections'].map(k=>`<datalist id="dl-${k}">${(state.lists[k]||[]).map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`).join(''); }

function renderUsers(view){
  view.innerHTML = `<div class="panel"><div class="panel-title"><h2>${i('users')} مستخدمو البوت</h2><button class="soft-btn" onclick="refreshAll()">${i('rotate')}</button></div><div class="table-wrap"><table><thead><tr><th>Chat ID</th><th>الاسم</th><th>Username</th><th>آخر استخدام</th></tr></thead><tbody>${state.users.length?state.users.map(u=>`<tr><td>${u.chat_id}</td><td>${esc([u.first_name,u.last_name].filter(Boolean).join(' '))}</td><td>${u.username?'@'+esc(u.username):''}</td><td>${esc(u.last_seen||'')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">لا يوجد مستخدمون بعد</td></tr>'}</tbody></table></div></div>`;
}

async function addChannel(e){
  e.preventDefault(); const fd=new FormData(e.target); const payload=Object.fromEntries(fd.entries());
  try{ await apiFetch(API.channels,{method:'POST',body:JSON.stringify(payload)}); toast('تم حفظ القناة','success'); await loadAll(); renderShell(); }catch(err){ toast(err.message,'error'); }
}
async function saveFile(e,id){
  e.preventDefault(); const fd=new FormData(e.target); const payload=Object.fromEntries(fd.entries()); payload.is_pinned=fd.get('is_pinned')==='on'; payload.is_active=fd.get('is_active')==='on'; if(id) payload.id=id;
  try{ await apiFetch(id?API.updateFile:API.addFile,{method:'POST',body:JSON.stringify(payload)}); toast('تم حفظ المحتوى','success'); await loadAll(); state.view='files'; renderShell(); }catch(err){ toast(err.message,'error'); }
}
async function toggleFile(id,is_active){ try{ await apiFetch(API.toggleFile,{method:'POST',body:JSON.stringify({id,is_active})}); await loadAll(); renderShell(); toast('تم تحديث الحالة','success'); }catch(err){ toast(err.message,'error'); } }
async function deleteFile(id){ if(!confirm('حذف هذا المحتوى؟')) return; try{ await apiFetch(API.deleteFile,{method:'POST',body:JSON.stringify({id})}); await loadAll(); renderShell(); toast('تم الحذف','success'); }catch(err){ toast(err.message,'error'); } }
async function deleteChannel(id){ if(!confirm('حذف القناة؟')) return; try{ await apiFetch(API.deleteChannel,{method:'POST',body:JSON.stringify({id})}); await loadAll(); renderShell(); toast('تم حذف القناة','success'); }catch(err){ toast(err.message,'error'); } }
function editFile(id){ const f=state.files.find(x=>x.id===id); state.view='add'; renderShell(); renderAdd(document.getElementById('view'), f); }
function fillTemplate(){ const form=document.getElementById('fileForm'); if(!form) return; form.title.value='Lecture 1 - Anatomy PDF'; form.year_name.value='1st year 🔴'; form.term_name.value='ترم اول'; form.subject_name.value='anatomy'; form.section_name.value='PDF 📚'; form.content_type.value='pdf'; form.message_id.value='3'; form.description.value='ملف تجريبي من لوحة التحكم'; }
async function checkHealth(){ try{ const data=await apiFetch(API.health); console.log(data); toast(data.telegram?.ok && data.supabase?.ok ? 'Telegram و Supabase يعملان' : 'الفحص تم، افتح Console للتفاصيل', data.telegram?.ok && data.supabase?.ok?'success':'info'); }catch(err){ toast(err.message,'error'); } }
async function seedDemo(){ try{ await apiFetch(API.seed,{method:'POST',body:JSON.stringify({channel_id: state.channels[0]?.channel_id || '-1003917305732'})}); await loadAll(); renderShell(); toast('تمت إضافة بيانات تجربة','success'); }catch(err){ toast(err.message,'error'); } }
function exportFiles(){ const blob=new Blob([JSON.stringify(state.files,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='bot-files.json'; a.click(); URL.revokeObjectURL(a.href); }
function copyWebhook(){ navigator.clipboard.writeText(`${location.origin}/api/webhook`); toast('تم نسخ رابط Webhook','success'); }
function logout(){ localStorage.removeItem(STORE_KEY); state.password=''; renderLogin(); }
async function refreshAll(){ await loadAll(); renderShell(); toast('تم التحديث','success'); }
async function safeLoad(name, url, fallback){
  try {
    return await apiFetch(url);
  } catch (error) {
    console.error(`API error in ${name}:`, error);
    toast(`خطأ في ${name}: ${error.message}`, 'error');
    return fallback;
  }
}

async function loadAll(){
  const channels = await safeLoad('القنوات', API.channels, { channels: [] });
  const files = await safeLoad('الملفات', API.files, { files: [] });
  const stats = await safeLoad('الإحصائيات', API.stats, { stats: {} });
  const lists = await safeLoad('القوائم', API.lists, { lists: state.lists });
  const users = await safeLoad('الطلاب', API.users, { users: [] });

  state.channels = channels.channels || [];
  state.files = files.files || [];
  state.stats = stats.stats || {};
  state.lists = lists.lists || state.lists;
  state.users = users.users || [];
}

window.logout=logout; window.refreshAll=refreshAll; window.checkHealth=checkHealth; window.seedDemo=seedDemo; window.exportFiles=exportFiles; window.copyWebhook=copyWebhook; window.deleteFile=deleteFile; window.toggleFile=toggleFile; window.editFile=editFile; window.deleteChannel=deleteChannel; window.fillTemplate=fillTemplate;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!state.password) return renderLogin();
  try{ await apiFetch(API.auth); await loadAll(); renderShell(); }catch(err){ toast(err.message,'error'); renderLogin(); }
});
