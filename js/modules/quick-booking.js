/* ============================================================
   QUICK BOOKING v8 — حجز سريع من أي صفحة
   ============================================================ */
async function showQuickBooking() {
  if (document.getElementById('quick-booking-modal')) return;
  const docs = await ServicesAPI.list();
  const html = `
    <div class="modal-overlay" id="quick-booking-modal" style="z-index:9999">
      <div class="modal-box">
        <h3>⚡ حجز سريع</h3>
        <div class="form-group"><label>المريض</label>
          <input id="qb-search" placeholder="ابحث باسم أو رقم هاتف..." oninput="qbSearchPatient(this.value)">
          <div id="qb-results" class="dict-suggest"></div>
          <input type="hidden" id="qb-patient-id">
          <div id="qb-patient-name" class="selected-badge"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>التاريخ والوقت *</label>
            <input id="qb-datetime" type="datetime-local" value="${new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}"></div>
          <div class="form-group"><label>مدة الموعد</label>
            <select id="qb-duration">
              <option value="15">15 دقيقة</option>
              <option value="30" selected>30 دقيقة</option>
              <option value="45">45 دقيقة</option>
              <option value="60">ساعة</option>
            </select></div>
        </div>
        <div class="form-group"><label>الخدمة</label>
          <select id="qb-service" onchange="qbUpdatePrice()">
            <option value="">— اختر خدمة —</option>
            ${(docs?.services||[]).map(s => `<option value="${s.id}" data-price="${s.price}">${s.name} — ${parseFloat(s.price).toLocaleString('ar-EG')} ج.م</option>`).join('')}
          </select></div>
        <div class="form-row">
          <div class="form-group"><label>السعر</label>
            <input id="qb-price" type="number" value="0"></div>
          <div class="form-group"><label>طريقة الدفع</label>
            <select id="qb-method">
              <option value="cash">💵 كاش</option>
              <option value="card">💳 كارت</option>
              <option value="later">⏳ لاحقاً</option>
            </select></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="confirmQuickBooking()">✅ تأكيد الحجز</button>
          <button class="btn btn-outline" onclick="document.getElementById('quick-booking-modal').remove()">إلغاء</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

let _qbTimer = null;
async function qbSearchPatient(q) {
  clearTimeout(_qbTimer);
  if (q.length < 2) return;
  _qbTimer = setTimeout(async () => {
    const r = await PatientsAPI.search(q);
    const cont = document.getElementById('qb-results');
    if (!r?.patients?.length) { cont.innerHTML = ''; return; }
    cont.innerHTML = r.patients.map(p =>
      `<div class="dict-item" onclick="qbSelectPatient(${p.id},'${p.name}','${p.phone}')">
        ${p.name} — ${p.phone || 'بدون هاتف'}
      </div>`).join('');
    cont.style.display = 'block';
  }, 300);
}

function qbSelectPatient(id, name, phone) {
  document.getElementById('qb-patient-id').value = id;
  document.getElementById('qb-patient-name').innerHTML = `<span class="badge badge-success">✓ ${name} ${phone?'— '+phone:''}</span>`;
  document.getElementById('qb-search').value = '';
  document.getElementById('qb-results').innerHTML = '';
}

function qbUpdatePrice() {
  const opt = document.getElementById('qb-service').selectedOptions[0];
  if (opt?.dataset.price) document.getElementById('qb-price').value = opt.dataset.price;
}

async function confirmQuickBooking() {
  const patientId = parseInt(document.getElementById('qb-patient-id').value);
  const datetime  = document.getElementById('qb-datetime').value;
  if (!patientId) { showToast('⚠️ اختر المريض', 'warning'); return; }
  if (!datetime)  { showToast('⚠️ اختر التاريخ والوقت', 'warning'); return; }

  const serviceId = parseInt(document.getElementById('qb-service').value) || 0;
  const price     = parseFloat(document.getElementById('qb-price').value) || 0;
  const method    = document.getElementById('qb-method').value;

  const services = serviceId ? [{
    service_id:   serviceId,
    service_name: document.getElementById('qb-service').selectedOptions[0]?.text || '',
    price, quantity: 1,
  }] : [];

  const r = await AppointmentsAPI.save({
    patient_id:     patientId,
    appointment_at: datetime,
    duration_min:   parseInt(document.getElementById('qb-duration').value),
    services,
    total_paid:     method === 'later' ? 0 : price,
    payment_method: method,
  });

  if (r?.ok) {
    showToast('✅ تم الحجز', 'success');
    document.getElementById('quick-booking-modal').remove();
  }
}
