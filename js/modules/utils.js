/* ============================================================
   ⑤ KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
  if (!currentUser) return;
  // تجاهل لو الموظف شغال في input
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  switch(e.key) {
    case 'F2': e.preventDefault(); goTo('reception'); break;
    case 'F3': e.preventDefault(); goTo('patient-search'); setTimeout(()=>document.getElementById('search-input')?.focus(),100); break;
    case 'F4': e.preventDefault(); goTo('today-appointments'); break;
    case 'F5': e.preventDefault(); syncToServer(); break;
    case 'F9': e.preventDefault(); openWaitingScreen(); break;
    case 'Escape': closeWaitingScreen(); break;
  }
});

/* ============================================================
   ⑥ SHIFT END REMINDER
   ============================================================ */
function _checkShiftEndReminder() {
  if (currentUser?.role !== 'secretary') return;
  const shift = (DB.get('shifts')||[]).find(s=>s.status==='open' && s.userId===currentUser.id);
  if (!shift || !shift.startTime) return;
  const start = new Date(shift.startTime);
  const mins  = (Date.now() - start.getTime()) / 60000;
  const limit = 8 * 60; // 8 ساعات
  if (mins >= limit - 15 && mins < limit - 14)
    pushNotif('⏰ تبقى 15 دقيقة على انتهاء شيفتك', 'warning');
  if (mins >= limit)
    pushNotif('⏰ انتهى وقت شيفتك — يرجى إغلاق الشيفت', 'warning');
}

/* ============================================================
   ⑦ ERROR LOGGING
   ============================================================ */
window.addEventListener('error', e => {
  try {
    apiCall('log_error', {
      msg: e.message, file: e.filename, line: e.lineno,
      user: currentUser?.name, url: location.href
    }).catch(()=>{});
  } catch(_) {}
});

/* ============================================================
   ⑧ UTILITY
   ============================================================ */
function _debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); };
}

