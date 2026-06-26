/* ============================================================
   ③ ONLINE USERS ENGINE
   ============================================================ */
let _onlineUsers = [];

function _updateOnlineUsers(users=[]) {
  const prev = _onlineUsers.map(u=>u.id).sort().join(',');
  _onlineUsers = users;
  const curr = users.map(u=>u.id).sort().join(',');
  if (prev && prev !== curr) {
    // موظف جديد أتصل أو اتقطع
    const prevIds = new Set(prev.split(','));
    users.forEach(u => {
      if (!prevIds.has(String(u.id)) && u.id !== currentUser?.id)
        pushNotif(`${u.name} انضم للنظام الآن`, 'online');
    });
  }
  document.getElementById('online-count').textContent = users.length;
  const list = document.getElementById('online-list');
  if (list) list.innerHTML = users.map(u=>`
    <div class="online-item">
      <span class="online-dot"></span>
      <span>${u.name}</span>
      <span style="font-size:.72rem;color:var(--text-muted);margin-right:auto">${u.role_label||''}</span>
    </div>`).join('') || '<div style="padding:.5rem .8rem;font-size:.82rem;color:var(--text-muted)">لا أحد متصل</div>';
}

function toggleOnlineDropdown() {
  const d = document.getElementById('online-dropdown');
  const isOpen = d.classList.contains('open');
  document.getElementById('notif-panel')?.classList.remove('open');
  d.classList.toggle('open', !isOpen);
}

// إغلاق الـ dropdowns لما تضغط برا
document.addEventListener('click', e => {
  if (!e.target.closest('#notif-btn') && !e.target.closest('#notif-panel'))
    document.getElementById('notif-panel')?.classList.remove('open');
  if (!e.target.closest('#online-pill') && !e.target.closest('#online-dropdown'))
    document.getElementById('online-dropdown')?.classList.remove('open');
});

