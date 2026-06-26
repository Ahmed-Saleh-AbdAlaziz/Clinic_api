/* ============================================================
   PERMISSIONS UI v8 — إدارة الصلاحيات
   ============================================================ */

function hasPermission(permKey) {
  if (!window._userPermissions) return false;
  const user = window.currentUser;
  if (user?.role === 'super_admin' || user?.role === 'admin') return true;
  return window._userPermissions.some(p =>
    p.perm_key === permKey &&
    (p.branch_id === 0 || p.branch_id == _currentBranchId)
  );
}

async function renderPermissionsEditor(userId, container) {
  const r = await UsersAPI.getPermissions(userId);
  if (!r?.ok) return;

  const userPerms = new Set(r.user_permissions.map(p => p.perm_key));
  const byCategory = {};
  r.all_permissions.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });

  container.innerHTML = `
    <div class="perms-editor">
      ${Object.entries(byCategory).map(([cat, perms]) => `
        <div class="perm-category">
          <h4>${cat}</h4>
          <div class="perm-list">
            ${perms.map(p => `
              <label class="perm-item">
                <input type="checkbox" value="${p.perm_key}" ${userPerms.has(p.perm_key) ? 'checked' : ''}>
                <span>${p.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <button class="btn btn-primary" onclick="saveUserPermissions(${userId}, this.closest('.perms-editor'))">
        💾 حفظ الصلاحيات
      </button>
    </div>
  `;
}

async function saveUserPermissions(userId, container) {
  const checked = [...container.querySelectorAll('input[type=checkbox]:checked')];
  const permissions = checked.map(cb => ({ perm_key: cb.value, branch_id: 0 }));
  const r = await UsersAPI.setPermissions(userId, permissions);
  if (r?.ok) showToast('✅ تم حفظ الصلاحيات', 'success');
}
