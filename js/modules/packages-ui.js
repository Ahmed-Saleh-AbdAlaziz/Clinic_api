/* ============================================================
   PACKAGES UI v8 — واجهة الباقات الكاملة
   ============================================================ */

// ── قائمة الباقات ─────────────────────────────────────────────────
async function renderPackagesManage(c) {
  const r = await PackagesAPI.list();
  if (!r?.ok) return;
  c.innerHTML = `
    <div class="section-header">
      <h2>📦 إدارة الباقات</h2>
      <button class="btn btn-primary" onclick="showPackageModal()">+ إضافة باقة</button>
    </div>
    <div class="packages-grid">
      ${r.packages.length ? r.packages.map(pkg => renderPackageCard(pkg)).join('') :
        '<div class="empty-state">لا توجد باقات بعد</div>'}
    </div>`;
}

function renderPackageCard(pkg) {
  const names  = (pkg.items_names || '').split('|').filter(Boolean);
  const qtys   = (pkg.items_qtys  || '').split('|').filter(Boolean);
  const types  = (pkg.items_types || '').split('|').filter(Boolean);
  return `
    <div class="package-card">
      <div class="pkg-header">
        <span class="pkg-name">${pkg.name}</span>
        <span class="pkg-price">${parseFloat(pkg.price).toLocaleString('ar-EG')} ج.م</span>
      </div>
      ${pkg.doctor_name ? `<div class="pkg-doctor">👨‍⚕️ ${pkg.doctor_name}</div>` : ''}
      <div class="pkg-items">
        ${names.map((n, i) => `
          <div class="pkg-item">
            <span class="pkg-item-type">${types[i]==='pulse'?'⚡':'💆'}</span>
            <span>${n}</span>
            <span class="pkg-item-qty">× ${qtys[i]||1}</span>
          </div>`).join('')}
      </div>
      ${pkg.payment_installments > 1 ? `<div class="pkg-installments">📅 ${pkg.payment_installments} أقساط</div>` : ''}
      <div class="pkg-actions">
        <button class="btn btn-sm btn-outline" onclick="editPackage(${pkg.id})">تعديل</button>
        <button class="btn btn-sm btn-danger" onclick="deletePackage(${pkg.id})">حذف</button>
      </div>
    </div>`;
}

function showPackageModal(pkg = null) {
  const isEdit = !!pkg;
  const html = `
    <div class="modal-overlay" id="pkg-modal">
      <div class="modal-box modal-lg">
        <h3>${isEdit ? 'تعديل باقة' : 'إضافة باقة جديدة'}</h3>
        <div class="form-row">
          <div class="form-group"><label>اسم الباقة *</label>
            <input id="pm-name" value="${pkg?.name||''}" placeholder="مثال: باقة 10 جلسات ليزر"></div>
          <div class="form-group"><label>السعر الإجمالي *</label>
            <input id="pm-price" type="number" value="${pkg?.price||''}" placeholder="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>عدد الأقساط</label>
            <input id="pm-install" type="number" min="1" value="${pkg?.payment_installments||1}"></div>
          <div class="form-group"><label>الدكتور المسؤول</label>
            <select id="pm-doctor"><option value="0">غير محدد</option></select></div>
        </div>
        <hr>
        <h4>محتوى الباقة</h4>
        <div id="pm-items">
          ${pkg ? buildItemsHtml(pkg) : buildItemRow()}
        </div>
        <button class="btn btn-outline btn-sm" onclick="addPackageItem()">+ إضافة عنصر</button>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="savePackage(${pkg?.id||0})">💾 حفظ</button>
          <button class="btn btn-outline" onclick="document.getElementById('pkg-modal').remove()">إلغاء</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  loadDoctorsSelect('pm-doctor', pkg?.doctor_id);
}

function buildItemRow(item = null) {
  return `
    <div class="pkg-item-row">
      <select class="pi-type">
        <option value="session" ${item?.type==='session'?'selected':''}>جلسة 💆</option>
        <option value="pulse"   ${item?.type==='pulse'  ?'selected':''}>بلص ⚡</option>
      </select>
      <input class="pi-name" placeholder="اسم الجلسة/البلص" value="${item?.name||''}">
      <input class="pi-qty"  type="number" min="1" placeholder="العدد" value="${item?.quantity||1}" style="width:80px">
      <input class="pi-cost" type="number" min="0" placeholder="تكلفة مستهلكات" value="${item?.consumables_cost||0}" style="width:120px">
      <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
    </div>`;
}

function buildItemsHtml(pkg) {
  const names  = (pkg.items_names||'').split('|').filter(Boolean);
  const qtys   = (pkg.items_qtys ||'').split('|').filter(Boolean);
  const types  = (pkg.items_types||'').split('|').filter(Boolean);
  return names.map((n,i) => buildItemRow({name:n, quantity:qtys[i], type:types[i]})).join('');
}

function addPackageItem() {
  document.getElementById('pm-items').insertAdjacentHTML('beforeend', buildItemRow());
}

async function savePackage(id = 0) {
  const items = [...document.querySelectorAll('.pkg-item-row')].map(row => ({
    type:             row.querySelector('.pi-type').value,
    name:             row.querySelector('.pi-name').value.trim(),
    quantity:         parseInt(row.querySelector('.pi-qty').value) || 1,
    consumables_cost: parseFloat(row.querySelector('.pi-cost').value) || 0,
  })).filter(i => i.name);

  if (!document.getElementById('pm-name').value.trim()) {
    showToast('⚠️ اسم الباقة مطلوب', 'warning'); return;
  }
  if (!items.length) { showToast('⚠️ أضف عنصراً واحداً على الأقل', 'warning'); return; }

  const data = {
    id, items,
    name:                 document.getElementById('pm-name').value.trim(),
    price:                parseFloat(document.getElementById('pm-price').value) || 0,
    payment_installments: parseInt(document.getElementById('pm-install').value) || 1,
    doctor_id:            parseInt(document.getElementById('pm-doctor').value) || 0,
  };
  const r = await PackagesAPI.save(data);
  if (r?.ok) {
    showToast('✅ تم الحفظ', 'success');
    document.getElementById('pkg-modal').remove();
    document.querySelector('[data-page="packages"]')?.click();
  }
}

async function deletePackage(id) {
  if (!confirm('هل تريد حذف هذه الباقة؟')) return;
  const r = await PackagesAPI.delete(id);
  if (r?.ok) { showToast('✅ تم الحذف', 'success'); document.querySelector('[data-page="packages"]')?.click(); }
}

// ── اشتراك مريض في باقة ──────────────────────────────────────────
async function showSubscribePackageModal(patientId, patientName) {
  const r = await PackagesAPI.list();
  if (!r?.ok) return;
  const html = `
    <div class="modal-overlay" id="subscribe-modal">
      <div class="modal-box">
        <h3>📦 تسجيل باقة — ${patientName}</h3>
        <div class="form-group"><label>الباقة *</label>
          <select id="sub-pkg" onchange="updateSubscribePrice()">
            <option value="">اختر الباقة</option>
            ${r.packages.map(p => `<option value="${p.id}" data-price="${p.price}" data-install="${p.payment_installments}">${p.name} — ${parseFloat(p.price).toLocaleString('ar-EG')} ج.م</option>`).join('')}
          </select></div>
        <div class="form-row">
          <div class="form-group"><label>السعر الإجمالي</label>
            <input id="sub-total" type="number" readonly></div>
          <div class="form-group"><label>المبلغ المدفوع الآن</label>
            <input id="sub-paid" type="number" value="0" min="0"></div>
        </div>
        <div class="form-group"><label>طريقة الدفع</label>
          <select id="sub-method">
            <option value="cash">💵 كاش</option>
            <option value="card">💳 كارت</option>
            <option value="wallet">📱 محفظة</option>
          </select></div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="subscribePatientPackage(${patientId})">✅ تسجيل</button>
          <button class="btn btn-outline" onclick="document.getElementById('subscribe-modal').remove()">إلغاء</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function updateSubscribePrice() {
  const opt = document.getElementById('sub-pkg').selectedOptions[0];
  if (!opt?.dataset.price) return;
  document.getElementById('sub-total').value = opt.dataset.price;
  document.getElementById('sub-paid').value  = opt.dataset.price;
}

async function subscribePatientPackage(patientId) {
  const pkgId = parseInt(document.getElementById('sub-pkg').value);
  if (!pkgId) { showToast('⚠️ اختر الباقة', 'warning'); return; }
  const data = {
    patient_id:     patientId,
    package_id:     pkgId,
    amount_paid:    parseFloat(document.getElementById('sub-paid').value) || 0,
    payment_method: document.getElementById('sub-method').value,
  };
  const r = await PackagesAPI.subscribe(data);
  if (r?.ok) {
    showToast('✅ تم تسجيل الباقة', 'success');
    document.getElementById('subscribe-modal').remove();
  }
}

// ── خصم جلسة من باقة ─────────────────────────────────────────────
async function showDeductSessionModal(patientId, appointmentId) {
  const r = await PackagesAPI.patientPackages(patientId);
  if (!r?.ok) return;
  const active = r.patient_packages.filter(pp => pp.status === 'active');
  if (!active.length) { showToast('⚠️ لا توجد باقات نشطة لهذا المريض', 'warning'); return; }

  const html = `
    <div class="modal-overlay" id="deduct-modal">
      <div class="modal-box">
        <h3>⚡ خصم جلسة من باقة</h3>
        <div class="form-group"><label>اختر الباقة</label>
          <select id="ded-pkg" onchange="loadPackageItems(this.value)">
            ${active.map(pp => `<option value="${pp.id}" data-remaining='${pp.sessions_remaining}'>${pp.package_name} (${pp.amount_remaining} ج.م متبقي)</option>`).join('')}
          </select></div>
        <div id="ded-items-container"></div>
        <div class="form-group"><label>تكلفة المستهلكات الفعلية</label>
          <input id="ded-cost" type="number" value="0" min="0"></div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="deductSession(${appointmentId})">✅ خصم</button>
          <button class="btn btn-outline" onclick="skipSession()">⏭️ تخطي</button>
          <button class="btn btn-outline" onclick="document.getElementById('deduct-modal').remove()">إلغاء</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  loadPackageItems(active[0].id);
}

function loadPackageItems(ppId) {
  const sel   = document.getElementById('ded-pkg');
  const opt   = [...sel.options].find(o => o.value == ppId);
  if (!opt) return;
  const remaining = JSON.parse(opt.dataset.remaining || '{}');
  const cont = document.getElementById('ded-items-container');
  const entries = Object.entries(remaining).filter(([, qty]) => qty > 0);
  cont.innerHTML = entries.length ? `
    <div class="form-group"><label>العنصر</label>
      <select id="ded-item">
        ${entries.map(([itemId, qty]) => `<option value="${itemId}" data-remaining="${qty}">عنصر ${itemId} — متبقي: ${qty}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>الكمية</label>
      <input id="ded-qty" type="number" value="1" min="1"></div>
  ` : '<p class="text-danger">⚠️ الباقة منتهية</p>';
}

async function deductSession(appointmentId) {
  const ppId   = parseInt(document.getElementById('ded-pkg').value);
  const itemId = parseInt(document.getElementById('ded-item')?.value || 0);
  const qty    = parseInt(document.getElementById('ded-qty')?.value  || 1);
  const cost   = parseFloat(document.getElementById('ded-cost').value || 0);
  if (!itemId) { showToast('⚠️ اختر العنصر', 'warning'); return; }
  const r = await PackagesAPI.deduct({
    patient_package_id: ppId, item_id: itemId,
    quantity: qty, appointment_id: appointmentId,
    consumables_cost_actual: cost,
  });
  if (r?.ok) {
    showToast(r.completed ? '🎉 الباقة اكتملت!' : '✅ تم الخصم', 'success');
    document.getElementById('deduct-modal').remove();
  }
}

async function skipSession() {
  const ppId   = parseInt(document.getElementById('ded-pkg').value);
  const itemId = parseInt(document.getElementById('ded-item')?.value || 0);
  const reason = prompt('سبب التخطي بدون خصم:');
  if (!reason) return;
  const r = await PackagesAPI.skip({ patient_package_id: ppId, item_id: itemId, reason });
  if (r?.ok) {
    showToast('✅ تم تسجيل التخطي', 'success');
    document.getElementById('deduct-modal').remove();
  }
}
