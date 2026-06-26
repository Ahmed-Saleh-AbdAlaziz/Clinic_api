/* ============================================================
   AUTO BACKUP — نسخ احتياطي تلقائي كل ساعة لمسار على السيرفر
   ============================================================ */
let _autoBackupInterval = null;

function startServerAutoBackup() {
  if (_autoBackupInterval) clearInterval(_autoBackupInterval);
  const settings = _memCache['settings'] || {};
  if (!settings.backupEnabled) return;
  const interval = (settings.backupIntervalHours || 1) * 60 * 60 * 1000;
  _autoBackupInterval = setInterval(async () => {
    await doServerBackup();
  }, interval);
  console.log('✅ Auto-backup started — every', settings.backupIntervalHours || 1, 'hour(s)');
}

async function doServerBackup() {
  try {
    const r = await apiCall('backup', {});
    if (r.ok) {
      console.log('✅ Auto-backup saved:', r.filename);
      const el = document.getElementById('last-backup-time');
      if (el) el.textContent = 'آخر نسخة: ' + new Date().toLocaleString('ar-EG');
    }
  } catch(e) {
    console.warn('Backup failed:', e.message);
  }
}

async function doManualBackup() {
  showToast('⏳ جاري حفظ النسخة الاحتياطية...', 'info');
  try {
    const r = await apiCall('backup', {});
    if (r.ok) showToast('✅ تم الحفظ: ' + r.filename, 'success');
    else showToast('⚠️ فشل الحفظ: ' + (r.error||''), 'danger');
  } catch(e) {
    showToast('⛔ تعذر الاتصال بالسيرفر', 'danger');
  }
}

async function listServerBackups() {
  try {
    const r = await apiCall('list_backups', {});
    if (!r.ok || !r.files?.length) { showToast('لا توجد نسخ احتياطية على السيرفر', 'warning'); return; }
    const body = r.files.slice(-10).reverse().map(f => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem;background:var(--gray-light);border-radius:var(--radius-sm);margin-bottom:.4rem">
        <span style="font-size:.85rem;font-family:monospace">${f.name}</span>
        <span style="font-size:.8rem;color:var(--text-muted)">${Math.round(f.size/1024)} KB</span>
        <button class="btn btn-sm btn-primary" onclick="restoreServerBackup('${f.name}')">استرداد</button>
      </div>`).join('');
    showModal('📂 النسخ الاحتياطية على السيرفر', body,
      [{label:'إغلاق', class:'btn-secondary', onclick:'closeModal()'}]);
  } catch(e) {
    showToast('⛔ تعذر الاتصال بالسيرفر', 'danger');
  }
}

async function restoreServerBackup(filename) {
  if (!confirm(`هل تريد الاسترداد من النسخة: ${filename}؟\nسيتم استبدال جميع البيانات الحالية.`)) return;
  showToast('⏳ جاري الاسترداد...', 'info');
  try {
    const r = await apiCall('restore_backup', { filename });
    if (r.ok) {
      showToast('✅ تم الاسترداد — جاري إعادة التحميل...', 'success');
      closeModal();
      setTimeout(() => location.reload(), 1500);
    } else {
      showToast('⚠️ فشل الاسترداد: ' + (r.error||''), 'danger');
    }
  } catch(e) {
    showToast('⛔ تعذر الاتصال بالسيرفر', 'danger');
  }
}

/* DB object — ميموري فقط، مع حجب الكتابة لما السيرفر يوقف */
const DB = {
  get(k){ return _memCache[k] !== undefined ? _memCache[k] : null; },
  set(k, v){
    // ✋ حجب أي كتابة لما السيرفر وقف — حماية الداتا
    if (!_serverOnline && MYSQL_CONFIG.USE_MYSQL) {
      console.warn('DB.set blocked — server offline:', k);
      showToast('⛔ لا يمكن الحفظ — السيرفر غير متصل', 'danger');
      return;
    }
    if (Array.isArray(v)) {
      v = v.map(item => {
        if (item && typeof item === 'object' && item.id != null)
          return {...item, updatedAt: new Date().toISOString()};
        return item;
      });
    }
    _memCache[k] = v;
    if (MYSQL_CONFIG.USE_MYSQL) {
      _dirtyKeys.add(k);
      clearTimeout(DB._syncTimer);
      DB._syncTimer = setTimeout(() => syncToServer(), 500);
    }
  },
  _syncTimer: null,
  init(){
    // لا نحتاج initialized check بعد كده — السيرفر هو المرجع
    // الداتا الافتراضية بتتحط في السيرفر أول مرة عبر api.php/init_defaults
  },
  nextPatientCode(){
    const n=this.get('patientCounter')||1;
    this.set('patientCounter',n+1);
    return 'P'+String(n).padStart(4,'0');
  },
  nextApptId(){
    const n=this.get('appointmentCounter')||1;
    this.set('appointmentCounter',n+1);
    return n;
  }
};

function today(){return new Date().toISOString().split('T')[0]}
function now(){return new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}
function fmtDate(d){try{return new Date(d).toLocaleDateString('ar-EG')}catch{return d||'—'}}
function fmtDateTime(d){try{return new Date(d).toLocaleString('ar-EG')}catch{return d||'—'}}

