/* ============================================================
   ① PESSIMISTIC LOCKING ENGINE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Lock على record بالـ ID — مش على الصفحة كلها
   • Timeout تلقائي 5 دقائق — بيتجدد مع أي تفاعل
   • من فاتح الملف + من امتى + الموظفين الشايفين
   ============================================================ */
const _myLocks   = new Set(); // الـ locks اللي أنا مسكها
const _lockPing  = {};        // timers لتجديد الـ lock

async function acquireLock(type, id) {
  try {
    const r = await apiCall('lock_acquire', { type, id,
      user_name: currentUser?.name, user_id: currentUser?.id });
    if (r.ok) {
      _myLocks.add(`${type}:${id}`);
      _startLockHeartbeat(type, id);
      return { ok: true };
    }
    return { ok: false, lockedBy: r.locked_by, since: r.since, viewers: r.viewers };
  } catch(e) { return { ok: false, error: true }; }
}

async function releaseLock(type, id) {
  const key = `${type}:${id}`;
  if (!_myLocks.has(key)) return;
  _myLocks.delete(key);
  clearInterval(_lockPing[key]);
  delete _lockPing[key];
  try { await apiCall('lock_release', { type, id }); } catch(e) {}
  // أرسل إشعار للي كانوا مستنيين
  _broadcastLockReleased(type, id);
}

function _startLockHeartbeat(type, id) {
  const key = `${type}:${id}`;
  clearInterval(_lockPing[key]);
  // كل 90 ثانية — بيجدد الـ lock عشان متنتهيش
  _lockPing[key] = setInterval(async () => {
    if (!_serverOnline) return;
    try { await apiCall('lock_heartbeat', { type, id }); }
    catch(e) { releaseLock(type, id); }
  }, 90000);
  // تجديد عند أي تفاعل
  const renew = () => { if (_myLocks.has(key)) apiCall('lock_heartbeat',{type,id}).catch(()=>{}); };
  document.addEventListener('keydown', renew, { passive: true });
  document.addEventListener('mousemove', _debounce(renew, 30000), { passive: true });
}

async function _broadcastLockReleased(type, id) {
  // الـ sync loop هيشيل الـ lock من السيرفر — باقي الأجهزة هتعرف في الـ sync القادم
}

function releaseAllMyLocks() {
  _myLocks.forEach(key => {
    const [type, id] = key.split(':');
    releaseLock(type, id);
  });
}

// اشال الـ locks لما المستخدم يخرج أو يقفل المتصفح
window.addEventListener('beforeunload', releaseAllMyLocks);

/* ── Lock UI helpers ─────────────────────────────────────── */
function buildLockBanner(lockedBy, since, viewers=[]) {
  const sinceStr = since ? new Date(since).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : '';
  const viewersHtml = viewers.length
    ? `<div class="viewers-bar" style="margin-top:.4rem">
        <span class="viewer-dot"></span>
        يشاهد الملف أيضاً: <strong>${viewers.map(v=>v.name).join('، ')}</strong>
       </div>` : '';
  return `
    <div class="lock-banner">
      <span class="lock-icon">🔒</span>
      <div class="lock-info">
        <div class="lock-by">هذا الملف مفتوح حالياً بواسطة: ${lockedBy}</div>
        ${sinceStr ? `<div class="lock-since">منذ الساعة ${sinceStr} — سيُفتح تلقائياً بعد 5 دقائق من التوقف</div>` : ''}
      </div>
    </div>${viewersHtml}`;
}

