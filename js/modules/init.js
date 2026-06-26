/* ============================================================
   NOTIFICATION POPUP
   ============================================================ */
const _refundCallbacks={};
function showNotifPopup(msg,onConfirm,popupId){
  const id=popupId||('notif-'+Date.now());
  // Remove existing popup for same id to avoid duplicates
  document.getElementById(id)?.remove();
  const el=document.createElement('div');
  el.className='notif-popup';el.id=id;
  if(onConfirm) _refundCallbacks[id]=onConfirm;
  el.innerHTML=`<button class="notif-close" onclick="document.getElementById('${id}').remove()">×</button>
    <div style="white-space:pre-line;font-size:.87rem">${msg}</div>
    ${onConfirm?`<button class="btn btn-success btn-sm" style="margin-top:.6rem" onclick="_refundCallbacks['${id}']&&_refundCallbacks['${id}']();document.getElementById('${id}').remove();">✅ تأكيد الاسترداد</button>`:''}`;
  document.body.appendChild(el);
  // Only auto-dismiss if no confirmation needed
  if(!onConfirm) setTimeout(()=>document.getElementById(id)?.remove(),8000);
}

/* ============================================================
   AUDIT LOG
   ============================================================ */
function addAuditLog(action,details){
  const logs=DB.get('auditLog')||[];
  logs.push({time:new Date().toLocaleString('ar-EG'),user:currentUser?.name||'—',action,details});
  if(logs.length>500) logs.shift();
  DB.set('auditLog',logs);
}

/* ============================================================
   MODAL SYSTEM
   ============================================================ */
function showModal(title,body,buttons=[]){
  closeModal();
  const m=document.createElement('div');
  m.className='modal-overlay';m.id='modal-overlay';
  m.onclick=e=>{if(e.target===m) closeModal();};
  m.innerHTML=`
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="close-btn" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">${body}</div>
      ${buttons.length?`<div class="modal-footer">${buttons.map(b=>`<button class="btn ${b.class}" onclick="${b.onclick}">${b.label}</button>`).join('')}</div>`:''}</div>`;
  document.body.appendChild(m);
}

function closeModal(){document.getElementById('modal-overlay')?.remove();}

/* ============================================================
   TABS
   ============================================================ */
function switchTab(el,tabId){
  const parent=el.closest('.tabs');
  parent?.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const pane=el.closest('.card,.modal-body,div[style]')?.parentElement||document.getElementById('main-content');
  const allTabs=pane.querySelectorAll('[id^="tab-"],[id^="exam-"]');
  allTabs.forEach(t=>t.classList.add('hidden'));
  const target=document.getElementById(tabId);
  if(target) target.classList.remove('hidden');
}

/* ============================================================
   HELPERS
   ============================================================ */
function statusBadge(s){return{waiting:'badge-warning',called:'badge-info',inside:'badge-success',done:'badge-success',cancelled:'badge-danger'}[s]||'badge-gray'}

let toastTimer;
function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.background=type==='danger'?'#c0392b':type==='warning'?'#d68910':'#27ae60';
  t.classList.add('show');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3500);
}

function startClock(){
  setInterval(()=>{
    const el=document.getElementById('live-time');
    if(el) el.textContent=new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    if(currentUser?.role==='secretary') checkPendingRefunds();
    _checkShiftEndReminder();
    _refreshWaitingScreen();
  },5000);
}

/* ============================================================
   INIT
   ============================================================ */
/* ============================================================
   HEALTH DASHBOARD — لوحة صحة النظام (للمدير فقط)
   ============================================================ */
async function renderHealthDashboard(c){
  c.innerHTML=`<div class="card"><div class="card-header"><span class="card-title">🖥️ لوحة صحة النظام</span></div>
    <div id="hd-content"><p style="color:var(--text-muted)">⏳ جاري التحميل...</p></div></div>`;
  try {
    const ping = await apiCall('ping',{});
    const patients     = (DB.get('patients')||[]).length;
    const appointments = (DB.get('appointments')||[]).length;
    const users        = (DB.get('users')||[]).filter(u=>u.active).length;
    const settings     = DB.get('settings')||{};
    const lastBackup   = settings.lastBackupTime ? new Date(settings.lastBackupTime).toLocaleString('ar-EG') : 'لم يتم بعد';
    document.getElementById('hd-content').innerHTML=`
      <div class="health-grid">
        <div class="health-card"><div class="hc-icon">🟢</div><div class="hc-val">متصل</div><div class="hc-label">حالة السيرفر</div></div>
        <div class="health-card"><div class="hc-icon">👥</div><div class="hc-val">${patients}</div><div class="hc-label">إجمالي المرضى</div></div>
        <div class="health-card"><div class="hc-icon">📅</div><div class="hc-val">${appointments}</div><div class="hc-label">إجمالي المواعيد</div></div>
        <div class="health-card"><div class="hc-icon">👤</div><div class="hc-val">${users}</div><div class="hc-label">موظفون نشطون</div></div>
        <div class="health-card"><div class="hc-icon">🟢</div><div class="hc-val">${_onlineUsers.length}</div><div class="hc-label">متصلون الآن</div></div>
        <div class="health-card"><div class="hc-icon">💾</div><div class="hc-val" style="font-size:.85rem">${lastBackup}</div><div class="hc-label">آخر نسخة احتياطية</div></div>
        <div class="health-card"><div class="hc-icon">🔒</div><div class="hc-val" style="font-size:.85rem">${ping.time?new Date(ping.time).toLocaleTimeString('ar-EG'):'-'}</div><div class="hc-label">وقت السيرفر</div></div>
        <div class="health-card"><div class="hc-icon">⚡</div><div class="hc-val">${MYSQL_CONFIG.SYNC_INTERVAL_MS/1000}s</div><div class="hc-label">دورة المزامنة</div></div>
      </div>
      <div class="section-divider">الموظفون المتصلون الآن</div>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
        ${_onlineUsers.map(u=>`<span style="background:var(--primary-light);color:var(--primary);padding:.3rem .7rem;border-radius:20px;font-size:.85rem">🟢 ${u.name} (${u.role_label})</span>`).join('') || '<span style="color:var(--text-muted)">لا أحد متصل حالياً</span>'}
      </div>
      <div class="section-divider">اختصارات لوحة المفاتيح</div>
      <div class="table-wrap"><table>
        <thead><tr><th>المفتاح</th><th>الوظيفة</th></tr></thead>
        <tbody>
          <tr><td><kbd>F2</kbd></td><td>الاستقبال — حجز موعد جديد</td></tr>
          <tr><td><kbd>F3</kbd></td><td>البحث عن مريض</td></tr>
          <tr><td><kbd>F4</kbd></td><td>مواعيد اليوم</td></tr>
          <tr><td><kbd>F5</kbd></td><td>مزامنة فورية مع السيرفر</td></tr>
          <tr><td><kbd>F9</kbd></td><td>فتح شاشة الانتظار للمرضى</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>إغلاق شاشة الانتظار</td></tr>
        </tbody>
      </table></div>
      <div style="margin-top:1rem;display:flex;gap:.5rem">
        <button class="btn btn-primary" onclick="doManualBackup()">💾 نسخة احتياطية الآن</button>
        <button class="btn btn-outline" onclick="listServerBackups()">📂 استعراض النسخ</button>
        <button class="btn btn-outline" onclick="openWaitingScreen()">📺 شاشة الانتظار (F9)</button>
      </div>`;
  } catch(e) {
    document.getElementById('hd-content').innerHTML=`<div class="alert alert-danger">⛔ تعذر الاتصال بالسيرفر</div>`;
  }
}

DB.init();
loadSavedCredentials();
