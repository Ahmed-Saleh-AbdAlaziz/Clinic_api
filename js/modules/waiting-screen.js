/* ============================================================
   ④ WAITING SCREEN ENGINE
   ============================================================ */
let _waitingOpen = false;

function openWaitingScreen() {
  _waitingOpen = true;
  const s = document.getElementById('waiting-screen');
  s.classList.add('show');
  const cname = DB.get('clinicName') || 'عيادة النيل';
  document.getElementById('waiting-clinic-name').textContent = cname;
  _refreshWaitingScreen();
}

function closeWaitingScreen() {
  _waitingOpen = false;
  document.getElementById('waiting-screen').classList.remove('show');
}

function _refreshWaitingScreen() {
  if (!_waitingOpen) return;
  const apts = (DB.get('appointments')||[])
    .filter(a => a.date === today() && a.status !== 'cancelled' && a.status !== 'done')
    .sort((a,b) => a.queueNum - b.queueNum);
  const called = apts.find(a => a.status === 'called' || a.status === 'entered');
  const waiting = apts.filter(a => a.status === 'waiting');
  if (called) {
    document.getElementById('waiting-num').textContent  = called.queueNum;
    document.getElementById('waiting-name').textContent = called.patientName;
    document.getElementById('waiting-queue').textContent =
      waiting.length ? `في الانتظار: ${waiting.length} شخص` : '';
  } else {
    document.getElementById('waiting-num').textContent  = '—';
    document.getElementById('waiting-name').textContent = 'لا يوجد مريض مُستدعى حالياً';
    document.getElementById('waiting-queue').textContent = waiting.length ? `في الانتظار: ${waiting.length} شخص` : '';
  }
}

