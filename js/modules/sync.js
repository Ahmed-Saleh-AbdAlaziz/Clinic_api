/* ============================================================
   MULTI-USER REAL-TIME SYNC ENGINE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   المشكلة القديمة: كل جهاز كان بيبعت بياناته وبيمسح بيانات
   التاني (Last-Write-Wins) → بيانات ضايعة مع 10+ موظفين.

   الحل الجديد: Merge بالـ ID
   • كل record عنده id خاص بيه
   • السيرفر هو المرجع الوحيد للحقيقة
   • الـ merge بيدمج الـ arrays بالـ id (مش بيحل محل الكل)
   • الكاونترات (patientCounter, appointmentCounter) بتاخد الأعلى
   • الـ append-only arrays (ledger, audit) بتضيف بس ولا بتمسح
   ============================================================ */

/* Device ID — مميّز لكل متصفح/جهاز */
const DEVICE_ID = (()=>{
  let d = localStorage.getItem('_clinic_device_id');
  if (!d) { d = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); localStorage.setItem('_clinic_device_id', d); }
  return d;
})();

/* Low-level API call */
async function apiCall(action, payload={}) {
  const url = MYSQL_CONFIG.API_URL + '?action=' + action;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({action, _key: MYSQL_CONFIG.API_KEY, device_id: DEVICE_ID, ...payload})
  });
  if (!res.ok) throw new Error('API HTTP ' + res.status);
  return res.json();
}

/* ── Merge helpers ──────────────────────────────────────── */

/**
 * mergeById: يدمج مصفوفتين بالـ id
 * - الـ record الأحدث (by updatedAt أو ts) بيكسب
 * - record موجود عند أحد الطرفين بس بيتضاف
 */
function mergeById(local, server) {
  if (!Array.isArray(server)) return Array.isArray(local) ? local : [];
  if (!Array.isArray(local))  return server;
  const map = new Map();
  // الأقدم أولاً، الأحدث يفوز
  [...server, ...local].forEach(item => {
    if (item == null || item.id == null) return;
    const existing = map.get(String(item.id));
    if (!existing) { map.set(String(item.id), item); return; }
    // قارن التوقيت — خد الأحدث
    const tNew = item.updatedAt || item.ts || item.registeredAt || 0;
    const tOld = existing.updatedAt || existing.ts || existing.registeredAt || 0;
    if (tNew > tOld) map.set(String(item.id), item);
  });
  return Array.from(map.values());
}

/**
 * mergeAppendOnly: للـ ledger والـ audit — بيضيف بس، مش بيمسح
 */
function mergeAppendOnly(local, server) {
  if (!Array.isArray(server)) return Array.isArray(local) ? local : [];
  if (!Array.isArray(local))  return server;
  const ids = new Set(server.map(x => String(x.id)));
  const extra = local.filter(x => x?.id != null && !ids.has(String(x.id)));
  return [...server, ...extra].sort((a,b)=> (a.ts||a.id||0) > (b.ts||b.id||0) ? 1 : -1);
}

/**
 * mergeKey: يختار استراتيجية الدمج المناسبة لكل مفتاح
 */
function mergeKey(k, local, server) {
  // الكاونترات: خد الأكبر دايماً
  if (k === 'patientCounter' || k === 'appointmentCounter') {
    return Math.max(Number(local)||0, Number(server)||0);
  }
  // الـ append-only: ضيف ولا تمسح
  if (k === 'ledger' || k === 'audit') {
    return mergeAppendOnly(local, server);
  }
  // الـ arrays بـ id: merge ذكي
  if (k === 'patients' || k === 'appointments' || k === 'users' ||
      k === 'services' || k === 'doctors'      || k === 'shifts' ||
      k === 'packages' || k === 'expenses') {
    return mergeById(local, server);
  }
  // الإعدادات والحاجات التانية: السيرفر مرجع (بس لو موجود)
  return (server !== null && server !== undefined) ? server : local;
}

/* ============================================================
   DB CACHE — ميموري فقط، السيرفر هو المصدر الوحيد للحقيقة
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   قاعدة الأمان:
   • السيرفر وقف  → السيستم يتجمد فوراً — لا كتابة لا قراءة
   • السيرفر رجع  → السيستم يرجع تلقائي بدون تدخل
   • مفيش offline mode خالص — أمان الداتا أهم من أي حاجة
   ============================================================ */
const _memCache  = {};
const _dirtyKeys = new Set();
let _syncRunning  = false;
let _serverOnline = false;
let _blockerShown = false;

/* ── شاشة الحجب لما السيرفر يوقف ───────────────────────── */
function _showServerDownBlocker() {
  if (_blockerShown) return;
  _blockerShown = true;
  // أزل أي blocker قديم
  document.getElementById('_srv_blocker')?.remove();
  const d = document.createElement('div');
  d.id = '_srv_blocker';
  d.style.cssText = [
    'position:fixed','inset:0','z-index:99999',
    'background:rgba(0,0,0,0.82)',
    'display:flex','flex-direction:column',
    'align-items:center','justify-content:center',
    'color:#fff','font-family:inherit','direction:rtl'
  ].join(';');
  d.innerHTML = `
    <div style="font-size:4rem;margin-bottom:1rem">🔴</div>
    <div style="font-size:1.5rem;font-weight:700;margin-bottom:.5rem">السيرفر متوقف</div>
    <div style="font-size:1rem;color:#ccc;margin-bottom:1.5rem;text-align:center;max-width:340px">
      لا يمكن الاستمرار بدون اتصال بالسيرفر.<br>
      جاري المحاولة للاتصال تلقائياً…
    </div>
    <div style="display:flex;align-items:center;gap:.6rem;font-size:.9rem;color:#aaa">
      <span id="_srv_spinner" style="display:inline-block;animation:spin 1s linear infinite">⏳</span>
      <span id="_srv_attempt">جاري الاتصال…</span>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(d);
}

function _hideServerDownBlocker() {
  const d = document.getElementById('_srv_blocker');
  if (d) { d.style.opacity='0'; d.style.transition='opacity .4s'; setTimeout(()=>d.remove(),400); }
  _blockerShown = false;
}

function _updateAttemptText(t) {
  const el = document.getElementById('_srv_attempt');
  if (el) el.textContent = t;
}

/* ── Main sync ───────────────────────────────────────────── */
async function syncToServer() {
  if (!MYSQL_CONFIG.USE_MYSQL || _syncRunning) return;
  _syncRunning = true;

  const LIVE_KEYS = ['patients','appointments','ledger','shifts','users',
                     'services','packages','expenses','patientCounter',
                     'appointmentCounter','settings','clinicName','clinicTheme','clinicLogo'];
  const dirty = {};
  _dirtyKeys.forEach(k => { if (_memCache[k] !== undefined) dirty[k] = _memCache[k]; });

  try {
    const r = await apiCall('sync', {
      data: dirty,
      presence: { user_id: currentUser?.id, user_name: currentUser?.name, role: currentUser?.role }
    });
    if (r.ok && r.data) {
      // ── حفظ snapshot قبل التحديث عشان نكتشف التغييرات ──
      const snapPatients     = JSON.stringify(_memCache['patients']||[]);
      const snapAppointments = JSON.stringify(_memCache['appointments']||[]);

      LIVE_KEYS.forEach(k => {
        if (r.data[k] !== undefined && r.data[k] !== null)
          _memCache[k] = mergeKey(k, _memCache[k], r.data[k]);
      });
      _dirtyKeys.clear();

      // ── كشف التغييرات وإعادة الرسم ──
      const changed =
        JSON.stringify(_memCache['patients']||[])     !== snapPatients ||
        JSON.stringify(_memCache['appointments']||[]) !== snapAppointments;

      if (!_serverOnline) {
        _serverOnline = true;
        _hideServerDownBlocker();
        showToast('✅ تم استعادة الاتصال بالسيرفر', 'success');
        renderCurrentPage();
      } else if (changed) {
        // بيانات اتغيرت من جهاز تاني — حدّث الشاشة الحالية
        renderCurrentPage();
        _refreshWaitingScreen();
      }

      _updateSyncBadge(true);

      // ── الموظفين أونلاين ──
      if (r.online_users) _updateOnlineUsers(r.online_users);

      // ── إشعارات الـ locks اللي اتشالت ──
      if (r.released_locks?.length) {
        r.released_locks.forEach(lk => {
          pushNotif(`ملف ${lk.label} أصبح متاحاً الآن`, 'lock_released',
            lk.type === 'patient' ? () => { closeModal(); showPatientProfile(lk.id); } : null);
        });
      }

      // ── تذكير نهاية الشيفت ──
      _checkShiftEndReminder();
    }
  } catch(e) {
    if (_serverOnline) {
      _serverOnline = false;
      _updateSyncBadge(false);
      _showServerDownBlocker();
    } else {
      _updateAttemptText('آخر محاولة: ' + new Date().toLocaleTimeString('ar-EG'));
    }
  } finally {
    _syncRunning = false;
  }
}

function _updateSyncBadge(ok) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (ok) {
    el.classList.replace('sync-error','sync-ok') || el.classList.add('sync-ok');
    el.title = 'آخر مزامنة: ' + new Date().toLocaleTimeString('ar-EG');
    el.textContent = '🟢 متصل';
  } else {
    el.classList.replace('sync-ok','sync-error') || el.classList.add('sync-error');
    el.title = 'لا يوجد اتصال بالسيرفر';
    el.textContent = '🔴 غير متصل';
  }
}

/* ── Pull عند بدء التشغيل ────────────────────────────────── */
async function pullFromServer() {
  if (!MYSQL_CONFIG.USE_MYSQL) return;
  // حاول الاتصال — لو فشل اعرض الحجب وكرر
  const attempt = async () => {
    try {
      _updateAttemptText('جاري الاتصال بالسيرفر…');
      const r = await apiCall('sync', {data:{}});
      if (r.ok && r.data) {
        Object.keys(r.data).forEach(k => {
          if (!k.endsWith('_updated') && r.data[k] !== null) _memCache[k] = r.data[k];
        });
        _serverOnline = true;
        _hideServerDownBlocker();
        _updateSyncBadge(true);
        showToast('✅ البيانات محملة من السيرفر', 'success');
        return true;
      }
    } catch(e) {
      _serverOnline = false;
      _showServerDownBlocker();
      _updateAttemptText('فشل الاتصال — إعادة المحاولة…');
    }
    return false;
  };
  // اول محاولة
  if (await attempt()) return;
  // لو فشلت — كرر كل 5 ثواني لحد ما ينجح
  await new Promise(resolve => {
    const t = setInterval(async () => {
      if (await attempt()) { clearInterval(t); resolve(); }
    }, 5000);
  });
}

/* ── Sync loop — كل 3 ثواني ─────────────────────────────── */
function startSyncLoop() {
  if (!MYSQL_CONFIG.USE_MYSQL) return;
  setInterval(() => syncToServer(), MYSQL_CONFIG.SYNC_INTERVAL_MS);
}

