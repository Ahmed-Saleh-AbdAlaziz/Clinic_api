/* ============================================================
   MEDICAL RECORD UI v8 — السجل الطبي الكامل
   ============================================================ */

let _currentRecord = null;

async function renderMedicalRecord(appointmentId, patientId, container) {
  const r = await MedicalAPI.get(appointmentId);
  _currentRecord = r?.record || null;

  container.innerHTML = `
    <div class="medical-record-form">
      <h3>📋 السجل الطبي</h3>

      <div class="mr-section">
        <label>الشكوى الرئيسية</label>
        <textarea id="mr-complaint" rows="3" placeholder="اكتب شكوى المريض..."
          oninput="dictSuggest('complaint', this.value, 'complaint-suggest')"
        >${_currentRecord?.chief_complaint || ''}</textarea>
        <div id="complaint-suggest" class="dict-suggest"></div>
      </div>

      <div class="mr-section">
        <label>الفحص السريري</label>
        <textarea id="mr-findings" rows="3" placeholder="نتائج الفحص..."
          oninput="dictSuggest('finding', this.value, 'finding-suggest')"
        >${_currentRecord?.examination_findings || ''}</textarea>
        <div id="finding-suggest" class="dict-suggest"></div>
      </div>

      <div class="mr-section">
        <label>التشخيص</label>
        <textarea id="mr-diagnosis" rows="2" placeholder="التشخيص..."
          oninput="dictSuggest('diagnosis', this.value, 'diagnosis-suggest')"
        >${_currentRecord?.diagnosis || ''}</textarea>
        <div id="diagnosis-suggest" class="dict-suggest"></div>
      </div>

      <div class="mr-section">
        <label>خطة العلاج</label>
        <textarea id="mr-plan" rows="2" placeholder="خطة العلاج والتوصيات..."
        >${_currentRecord?.treatment_plan || ''}</textarea>
      </div>

      <div class="mr-section">
        <label>موعد الزيارة القادمة</label>
        <input type="date" id="mr-next" value="${_currentRecord?.next_visit_date || ''}">
      </div>

      <hr>
      <h4>💊 الروشتة</h4>
      <div id="rx-container">
        ${(_currentRecord?.prescriptions || []).map(renderRxRow).join('') || renderRxRow()}
      </div>
      <button class="btn btn-outline btn-sm" onclick="addRxRow()">+ إضافة دواء</button>

      <hr>
      <h4>🔬 التحاليل والأشعات</h4>
      <div id="labs-container">
        ${(_currentRecord?.labs || []).map(renderLabRow).join('') || ''}
      </div>
      <button class="btn btn-outline btn-sm" onclick="addLabRow()">+ إضافة تحليل/أشعة</button>

      <hr>
      <h4>🖼️ صور الزيارة</h4>
      <div id="images-container" class="images-grid">
        ${(_currentRecord?.images || []).map(img => `
          <div class="visit-image">
            <img src="${img.file_path}" alt="صورة الزيارة">
            ${img.notes ? `<p>${img.notes}</p>` : ''}
          </div>`).join('')}
      </div>
      <label class="btn btn-outline btn-sm">
        📎 رفع صورة <input type="file" hidden accept="image/*" onchange="uploadVisitImage(this, ${appointmentId}, ${patientId})">
      </label>

      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveMedicalRecord(${appointmentId}, ${patientId})">💾 حفظ السجل الطبي</button>
        <button class="btn btn-success" onclick="printPrescription(${patientId})">🖨️ طباعة الروشتة</button>
      </div>
    </div>`;
}

function renderRxRow(rx = null) {
  return `
    <div class="rx-row">
      <input class="rx-drug" placeholder="اسم الدواء" value="${rx?.drug_name||''}"
        oninput="dictSuggest('drug', this.value, null, this.nextElementSibling)">
      <div class="dict-suggest rx-suggest"></div>
      <input class="rx-dose" placeholder="الجرعة" value="${rx?.dose||''}" style="width:100px">
      <select class="rx-times">
        ${[1,2,3,4].map(n => `<option value="${n}" ${rx?.times_per_day==n?'selected':''}>${n}×</option>`).join('')}
      </select>
      <select class="rx-timing">
        <option value="before_meal" ${rx?.timing==='before_meal'?'selected':''}>قبل الأكل</option>
        <option value="after_meal"  ${rx?.timing==='after_meal' ?'selected':''}>بعد الأكل</option>
        <option value="any"         ${rx?.timing==='any'||!rx?.timing?'selected':''}>أي وقت</option>
      </select>
      <select class="rx-schedule">
        <option value="morning"          ${rx?.schedule==='morning'?'selected':''}>صباح</option>
        <option value="evening"          ${rx?.schedule==='evening'?'selected':''}>مساء</option>
        <option value="morning_evening"  ${rx?.schedule==='morning_evening'?'selected':''}>صباح ومساء</option>
        <option value="every_x_hours"    ${rx?.schedule==='every_x_hours'?'selected':''}>كل X ساعة</option>
        <option value="continuous"       ${rx?.schedule==='continuous'?'selected':''}>مستمر</option>
        <option value="as_needed"        ${rx?.schedule==='as_needed'?'selected':''}>عند الحاجة</option>
      </select>
      <input class="rx-days" type="number" min="0" placeholder="أيام" value="${rx?.duration_days||''}" style="width:70px">
      <button class="btn btn-sm btn-danger" onclick="this.closest('.rx-row').remove()">✕</button>
    </div>`;
}

function renderLabRow(lab = null) {
  return `
    <div class="lab-row">
      <select class="lab-type">
        <option value="lab"       ${lab?.type==='lab'      ?'selected':''}>تحليل 🔬</option>
        <option value="radiology" ${lab?.type==='radiology'?'selected':''}>أشعة 📡</option>
        <option value="other"     ${lab?.type==='other'    ?'selected':''}>أخرى</option>
      </select>
      <input class="lab-name"   placeholder="اسم التحليل" value="${lab?.name||''}">
      <input class="lab-result" placeholder="النتيجة (اختياري)" value="${lab?.result||''}">
      <button class="btn btn-sm btn-danger" onclick="this.closest('.lab-row').remove()">✕</button>
    </div>`;
}

function addRxRow()  { document.getElementById('rx-container').insertAdjacentHTML('beforeend', renderRxRow()); }
function addLabRow() { document.getElementById('labs-container').insertAdjacentHTML('beforeend', renderLabRow()); }

// القاموس الذكي — debounced
let _dictTimer = null;
async function dictSuggest(type, val, containerId, containerEl = null) {
  const term = val.split('\n').pop().trim();
  if (term.length < 2) return;
  clearTimeout(_dictTimer);
  _dictTimer = setTimeout(async () => {
    const r = await MedicalAPI.dictSearch(type, term);
    if (!r?.results?.length) return;
    const cont = containerId ? document.getElementById(containerId) : containerEl;
    if (!cont) return;
    cont.innerHTML = r.results.map(res =>
      `<div class="dict-item" onclick="insertDictTerm(this, '${res.term}')">${res.term} <small>(${res.use_count})</small></div>`
    ).join('');
    cont.style.display = 'block';
  }, 300);
}

function insertDictTerm(el, term) {
  const textarea = el.closest('.mr-section, .rx-row')?.querySelector('textarea, .rx-drug');
  if (textarea) textarea.value = term;
  el.parentElement.style.display = 'none';
}

async function saveMedicalRecord(appointmentId, patientId) {
  const prescriptions = [...document.querySelectorAll('.rx-row')].map(row => ({
    drug_name:    row.querySelector('.rx-drug').value.trim(),
    dose:         row.querySelector('.rx-dose').value.trim(),
    times_per_day:parseInt(row.querySelector('.rx-times').value),
    timing:       row.querySelector('.rx-timing').value,
    schedule:     row.querySelector('.rx-schedule').value,
    duration_days:parseInt(row.querySelector('.rx-days').value) || 0,
  })).filter(r => r.drug_name);

  const labs = [...document.querySelectorAll('.lab-row')].map(row => ({
    type:   row.querySelector('.lab-type').value,
    name:   row.querySelector('.lab-name').value.trim(),
    result: row.querySelector('.lab-result').value.trim(),
  })).filter(l => l.name);

  const data = {
    appointment_id:        appointmentId,
    patient_id:            patientId,
    chief_complaint:       document.getElementById('mr-complaint').value,
    examination_findings:  document.getElementById('mr-findings').value,
    diagnosis:             document.getElementById('mr-diagnosis').value,
    treatment_plan:        document.getElementById('mr-plan').value,
    next_visit_date:       document.getElementById('mr-next').value || null,
    prescriptions, labs,
  };

  const r = await MedicalAPI.save(data);
  if (r?.ok) showToast('✅ تم حفظ السجل الطبي', 'success');
}

async function uploadVisitImage(input, recordId, patientId) {
  if (!input.files[0]) return;
  const form = new FormData();
  form.append('file', input.files[0]);
  form.append('record_id', recordId);
  form.append('patient_id', patientId);
  form.append('action', 'upload');

  try {
    const res = await fetch(`${CLINIC_CONFIG.API_URL}?action=upload`, {
      method: 'POST',
      headers: { 'X-Clinic-Key': CLINIC_CONFIG.API_KEY, 'X-Branch-Id': String(_currentBranchId), 'X-User-Id': String(window.currentUser?.id || 0) },
      body: form,
    });
    const json = await res.json();
    if (json.ok) {
      showToast('✅ تم رفع الصورة', 'success');
      document.getElementById('images-container').insertAdjacentHTML('beforeend',
        `<div class="visit-image"><img src="${json.file_path}" alt="صورة الزيارة"></div>`);
    }
  } catch { showToast('⛔ فشل رفع الصورة', 'danger'); }
}

async function printPrescription(patientId) {
  if (!_currentRecord) { showToast('⚠️ احفظ السجل أولاً', 'warning'); return; }
  await PrescriptionsAPI.logPrint(_currentRecord.id, patientId);
  window.print();
}
