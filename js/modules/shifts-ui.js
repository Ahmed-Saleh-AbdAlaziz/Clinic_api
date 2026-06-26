/* ============================================================
   SHIFTS UI v8 — الشيفتات
   ============================================================ */
let _currentShift = null;

async function loadCurrentShift() {
  const r = await ShiftsAPI.current();
  _currentShift = r?.shift || null;
  updateShiftIndicator();
}

function updateShiftIndicator() {
  const el = document.getElementById('shift-indicator');
  if (!el) return;
  if (_currentShift) {
    const since = new Date(_currentShift.started_at).toLocaleTimeString('ar-EG');
    el.innerHTML = `<span class="shift-open">🟢 شيفت مفتوح منذ ${since}</span>
      <button class="btn btn-sm btn-danger" onclick="closeShift()">إغلاق الشيفت</button>`;
  } else {
    el.innerHTML = `<button class="btn btn-sm btn-success" onclick="openShift()">🔓 فتح شيفت</button>`;
  }
}

async function openShift() {
  const r = await ShiftsAPI.open();
  if (r?.ok) { showToast('✅ تم فتح الشيفت', 'success'); await loadCurrentShift(); }
}

async function closeShift() {
  if (!_currentShift) return;
  if (!confirm('هل تريد إغلاق الشيفت الحالي؟')) return;
  const r = await ShiftsAPI.close(_currentShift.id);
  if (r?.ok) { showToast('✅ تم إغلاق الشيفت', 'success'); _currentShift = null; updateShiftIndicator(); }
}

async function renderShiftsReport(c) {
  const date = new Date().toISOString().split('T')[0];
  const r = await ShiftsAPI.list(date);
  if (!r?.ok) return;
  c.innerHTML = `
    <div class="section-header"><h2>🕐 الشيفتات — ${date}</h2></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>الموظف</th><th>بداية</th><th>نهاية</th><th>كاش</th><th>كارت</th><th>محفظة</th><th>المصاريف</th><th>الحالة</th></tr></thead>
        <tbody>
          ${r.shifts.map(s => `
            <tr>
              <td>${s.user_name}</td>
              <td>${new Date(s.started_at).toLocaleTimeString('ar-EG')}</td>
              <td>${s.ended_at ? new Date(s.ended_at).toLocaleTimeString('ar-EG') : '—'}</td>
              <td>${parseFloat(s.total_cash).toLocaleString('ar-EG')}</td>
              <td>${parseFloat(s.total_card).toLocaleString('ar-EG')}</td>
              <td>${parseFloat(s.total_wallet).toLocaleString('ar-EG')}</td>
              <td>${parseFloat(s.total_expenses).toLocaleString('ar-EG')}</td>
              <td><span class="badge ${s.status==='open'?'badge-success':'badge-secondary'}">${s.status==='open'?'مفتوح':'مغلق'}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
