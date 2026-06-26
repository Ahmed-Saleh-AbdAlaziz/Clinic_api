/* ============================================================
   ② NOTIFICATIONS ENGINE
   ============================================================ */
const _notifs = [];
let   _notifUnread = 0;

function pushNotif(msg, type='info', action=null) {
  const n = { id: Date.now(), msg, type, action, ts: new Date(), read: false };
  _notifs.unshift(n);
  if (_notifs.length > 50) _notifs.length = 50;
  _notifUnread++;
  _renderNotifBadge();
  _renderNotifList();
  // Toast صغير للإشعارات المهمة
  if (type === 'lock_released' || type === 'warning') showToast('🔔 ' + msg, 'info');
}

function _renderNotifBadge() {
  const b = document.getElementById('notif-badge');
  if (!b) return;
  if (_notifUnread > 0) { b.textContent = _notifUnread > 9 ? '9+' : _notifUnread; b.classList.add('show'); }
  else b.classList.remove('show');
}

function _renderNotifList() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  if (!_notifs.length) { el.innerHTML = '<div class="notif-empty">لا توجد إشعارات</div>'; return; }
  el.innerHTML = _notifs.map(n => `
    <div class="notif-item ${n.read?'':'unread'}" onclick="readNotif(${n.id})">
      <div>${_notifIcon(n.type)} ${n.msg}</div>
      <div class="notif-time">${n.ts.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`).join('');
}

function _notifIcon(type) {
  return {lock_released:'✅',lock_blocked:'🔒',online:'🟢',offline:'🔴',
          backup:'💾',warning:'⚠️',info:'ℹ️',error:'❌'}[type] || '🔔';
}

function readNotif(id) {
  const n = _notifs.find(x=>x.id===id);
  if (n && !n.read) { n.read=true; _notifUnread=Math.max(0,_notifUnread-1); }
  _renderNotifBadge();
  _renderNotifList();
  if (n?.action) n.action();
}

function clearAllNotifs() {
  _notifs.length = 0; _notifUnread = 0;
  _renderNotifBadge(); _renderNotifList();
}

function toggleNotifPanel() {
  const p = document.getElementById('notif-panel');
  const isOpen = p.classList.contains('open');
  document.getElementById('online-dropdown')?.classList.remove('open');
  p.classList.toggle('open', !isOpen);
  if (!isOpen) { _notifs.forEach(n=>n.read=true); _notifUnread=0; _renderNotifBadge(); }
}

