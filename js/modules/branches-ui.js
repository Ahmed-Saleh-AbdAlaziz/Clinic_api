/* ============================================================
   BRANCHES UI v8 — إدارة الفروع
   ============================================================ */

let _branches = [];
let _currentBranchId = CLINIC_CONFIG.DEFAULT_BRANCH_ID;

async function loadBranches() {
  const r = await BranchesAPI.list();
  if (r?.ok) {
    _branches = r.branches;
    renderBranchSelector();
  }
}

function renderBranchSelector() {
  const sel = document.getElementById('branch-selector');
  if (!sel) return;
  sel.innerHTML = _branches.map(b =>
    `<option value="${b.id}" ${b.id == _currentBranchId ? 'selected' : ''}>${b.name}</option>`
  ).join('');
}

function switchBranch(branchId) {
  _currentBranchId = parseInt(branchId);
  setCurrentBranch(_currentBranchId);
  showToast(`✅ تم التبديل إلى: ${_branches.find(b=>b.id==branchId)?.name}`, 'success');
  // إعادة تحميل الصفحة الحالية
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) activeNav.click();
}

async function renderBranchesManage(c) {
  const r = await BranchesAPI.list();
  if (!r?.ok) return;
  c.innerHTML = `
    <div class="section-header">
      <h2>🏢 إدارة الفروع</h2>
      <button class="btn btn-primary" onclick="showBranchModal()">+ إضافة فرع</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>الاسم</th><th>العنوان</th><th>الهاتف</th><th>إجراءات</th></tr></thead>
        <tbody>
          ${r.branches.map(b => `
            <tr>
              <td>${b.name}</td>
              <td>${b.address || '—'}</td>
              <td>${b.phone || '—'}</td>
              <td>
                <button class="btn btn-sm btn-outline" onclick='showBranchModal(${JSON.stringify(b)})'>تعديل</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showBranchModal(branch = null) {
  const isEdit = !!branch;
  const html = `
    <div class="modal-overlay" id="branch-modal">
      <div class="modal-box">
        <h3>${isEdit ? 'تعديل فرع' : 'إضافة فرع جديد'}</h3>
        <div class="form-group"><label>اسم الفرع *</label>
          <input id="bm-name" value="${branch?.name || ''}" placeholder="مثال: الفرع الرئيسي"></div>
        <div class="form-group"><label>العنوان</label>
          <input id="bm-addr" value="${branch?.address || ''}" placeholder="العنوان التفصيلي"></div>
        <div class="form-group"><label>الهاتف</label>
          <input id="bm-phone" value="${branch?.phone || ''}" placeholder="+201xxxxxxxxx"></div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="saveBranch(${branch?.id || 0})">حفظ</button>
          <button class="btn btn-outline" onclick="document.getElementById('branch-modal').remove()">إلغاء</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveBranch(id = 0) {
  const data = {
    id,
    name:    document.getElementById('bm-name').value.trim(),
    address: document.getElementById('bm-addr').value.trim(),
    phone:   document.getElementById('bm-phone').value.trim(),
  };
  if (!data.name) { showToast('⚠️ اسم الفرع مطلوب', 'warning'); return; }
  const r = await BranchesAPI.save(data);
  if (r?.ok) {
    showToast('✅ تم الحفظ', 'success');
    document.getElementById('branch-modal').remove();
    loadBranches();
  }
}
