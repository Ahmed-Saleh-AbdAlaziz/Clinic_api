/* ============================================================
   ADMIN — ALL PATIENTS
   ============================================================ */
function renderAllPatients(c){
  const patients=DB.get('patients')||[];
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">👥 جميع المرضى (${patients.length})</span>
      <div class="btn-group">
        <input id="ap-search" placeholder="بحث..." style="padding:.4rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)" oninput="filterAllPatients()">
        <button class="btn btn-sm btn-outline" onclick="exportAllPhones()">📱 تليفونات</button>
        <button class="btn btn-sm btn-outline" onclick="exportVCF()">📇 VCF</button>
        <button class="btn btn-sm btn-outline" onclick="window.print()">🖨️ طباعة</button>
      </div>
    </div>
    <div class="table-wrap"><table id="all-patients-tbl">
      <tr><th>الكود</th><th>الاسم</th><th>التليفون</th><th>العمر</th><th>المصدر</th><th>التسجيل</th><th>الحساب</th><th class="no-print">إجراءات</th></tr>
      ${patients.map(p=>`
      <tr>
        <td>${p.code}</td>
        <td>${p.fullName}</td>
        <td><a href="https://wa.me/2${p.phone}" target="_blank">${p.phone}</a></td>
        <td>${p.age} ${p.ageType==='year'?'سنة':p.ageType==='month'?'شهر':'يوم'}</td>
        <td>${p.source||'—'}</td>
        <td>${fmtDate(p.registeredAt)}</td>
        <td>${p.debt>0?`<span class="badge badge-danger">عليه: ${p.debt} ج</span>`:p.credit>0?`<span class="badge badge-success">له: ${p.credit} ج</span>`:'—'}</td>
        <td class="no-print">
          <button class="btn btn-sm btn-outline" onclick="showPatientProfile(${p.id})">الملف</button>
          <button class="btn btn-sm btn-secondary" onclick="printPatientFile(${p.id})">🖨️</button>
        </td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

function filterAllPatients(){
  const q=document.getElementById('ap-search')?.value.toLowerCase()||'';
  document.querySelectorAll('#all-patients-tbl tbody tr').forEach(tr=>{
    tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none';
  });
}

/* ============================================================
   UNIFIED VAULT — Full cashbox ledger for admin
   ============================================================ */
function renderVault(c){
  const ledger=(DB.get('ledger')||[]).slice().sort((a,b)=>b.ts.localeCompare(a.ts));
  const totalIn=ledger.filter(e=>e.amount>0).reduce((s,e)=>s+e.amount,0);
  const totalOut=ledger.filter(e=>e.amount<0).reduce((s,e)=>s+e.amount,0);
  const net=totalIn+totalOut;
  const byMethod=getVaultByMethod();
  const expenses=(DB.get('expenses')||[]).reduce((s,e)=>s+e.amount,0);
  const refunds=ledger.filter(e=>e.type.includes('refund')).reduce((s,e)=>s+Math.abs(e.amount),0);

  c.innerHTML=`
  <div class="stat-grid">
    <div class="stat-card green"><div class="stat-num" style="color:#27ae60">+${totalIn.toLocaleString()} ج</div><div class="stat-label">إجمالي الوارد</div></div>
    <div class="stat-card red"><div class="stat-num" style="color:var(--danger)">${totalOut.toLocaleString()} ج</div><div class="stat-label">إجمالي الصادر (مصاريف + استردادات)</div></div>
    <div class="stat-card blue"><div class="stat-num" style="color:#2980b9">${net.toLocaleString()} ج</div><div class="stat-label">رصيد الخزنة الحالي</div></div>
    <div class="stat-card orange"><div class="stat-num" style="color:#e67e22">${refunds.toLocaleString()} ج</div><div class="stat-label">إجمالي الاستردادات</div></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem">
    <div class="card" style="text-align:center;border-top:3px solid #27ae60">
      <div style="font-size:1.5rem;font-weight:700;color:#27ae60">${(byMethod.cash||0).toLocaleString()} ج</div>
      <div style="color:var(--text-muted);font-size:.85rem">💵 نقدي (صافي)</div>
    </div>
    <div class="card" style="text-align:center;border-top:3px solid #2980b9">
      <div style="font-size:1.5rem;font-weight:700;color:#2980b9">${(byMethod.visa||0).toLocaleString()} ج</div>
      <div style="color:var(--text-muted);font-size:.85rem">💳 فيزا (صافي)</div>
    </div>
    <div class="card" style="text-align:center;border-top:3px solid #8e44ad">
      <div style="font-size:1.5rem;font-weight:700;color:#8e44ad">${(byMethod.wallet||0).toLocaleString()} ج</div>
      <div style="color:var(--text-muted);font-size:.85rem">📱 محفظة (صافي)</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">🏦 سجل الخزنة الكامل (${ledger.length} عملية)</span>
      <div class="btn-group">
        <select id="vault-filter" onchange="filterVault()" style="padding:.4rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm);font-size:.85rem">
          <option value="">كل العمليات</option>
          <option value="payment">مدفوعات</option>
          <option value="refund">استردادات</option>
          <option value="debt_payment">سداد ديون</option>
          <option value="expense">مصاريف</option>
        </select>
        <input id="vault-search" placeholder="بحث بالاسم..." oninput="filterVault()" style="padding:.4rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm);font-size:.85rem;width:160px">
        <input type="date" id="vault-date-from" onchange="filterVault()" style="padding:.4rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm);font-size:.85rem">
        <input type="date" id="vault-date-to" onchange="filterVault()" style="padding:.4rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm);font-size:.85rem">
        <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨️ طباعة</button>
      </div>
    </div>
    <div class="table-wrap" id="vault-table-wrap">
      ${renderVaultTable(ledger)}
    </div>
  </div>`;
}

function renderVaultTable(entries){
  if(!entries.length) return '<p style="color:var(--text-muted);text-align:center;padding:2rem">لا سجلات</p>';
  const runningTotal={cash:0,visa:0,wallet:0};
  // Build running balance
  const sorted=[...entries].sort((a,b)=>a.ts.localeCompare(b.ts));
  sorted.forEach(e=>{
    const m=e.method||'cash';
    if(runningTotal[m]!==undefined) runningTotal[m]+=(e.amount||0);
  });
  return `<table>
    <thead><tr>
      <th>التاريخ</th><th>الوقت</th><th>المريض</th><th>النوع</th>
      <th>المبلغ</th><th>الطريقة</th><th>تفاصيل</th><th>بواسطة</th>
    </tr></thead>
    <tbody id="vault-tbody">
    ${entries.map(e=>`
      <tr data-type="${e.type}" data-name="${(e.patientName||'').toLowerCase()}" data-date="${e.date}">
        <td>${e.date}</td>
        <td style="font-size:.78rem;color:var(--text-muted)">${e.timeStr||'—'}</td>
        <td>${e.patientName&&e.patientName!=='—'?`<span style="color:var(--primary);font-weight:600">${e.patientName}</span>`:'<span style="color:var(--text-muted)">—</span>'}</td>
        <td><span class="badge" style="background:${e.amount>=0?'#d5f5e3':'#fadbd8'};color:${e.amount>=0?'#1e8449':'#922b21'}">${ledgerTypeLabel(e.type)}</span></td>
        <td style="font-weight:700;font-size:1rem;color:${e.amount>=0?'#27ae60':'var(--danger)'}">
          ${e.amount>=0?'+':''}${e.amount.toLocaleString()} ج
        </td>
        <td>${payMethodLabel(e.method)}</td>
        <td style="font-size:.8rem;color:var(--text-muted);max-width:200px">${e.note||'—'}</td>
        <td style="font-size:.78rem">${e.addedBy||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function filterVault(){
  const typeFilter=document.getElementById('vault-filter')?.value||'';
  const nameFilter=(document.getElementById('vault-search')?.value||'').toLowerCase();
  const dateFrom=document.getElementById('vault-date-from')?.value||'';
  const dateTo=document.getElementById('vault-date-to')?.value||'';
  document.querySelectorAll('#vault-tbody tr').forEach(tr=>{
    const type=tr.dataset.type||'';
    const name=tr.dataset.name||'';
    const date=tr.dataset.date||'';
    let show=true;
    if(typeFilter && !type.includes(typeFilter)) show=false;
    if(nameFilter && !name.includes(nameFilter)) show=false;
    if(dateFrom && date < dateFrom) show=false;
    if(dateTo && date > dateTo) show=false;
    tr.style.display=show?'':'none';
  });
}

/* ============================================================
   FINANCE REPORT
   ============================================================ */
function renderFinanceReport(c){
  const apts=DB.get('appointments')||[];
  const shifts=DB.get('shifts')||[];
  const totalRevenue=apts.reduce((s,a)=>s+(a.payment?.paid||0),0);
  const todayRev=apts.filter(a=>a.date===today()).reduce((s,a)=>s+(a.payment?.paid||0),0);
  const totalExpenses=(DB.get('expenses')||[]).reduce((s,e)=>s+e.amount,0);
  c.innerHTML=`
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-num">${totalRevenue.toLocaleString()} ${tUI('ج','EGP')}</div><div class="stat-label">${tUI('إجمالي الإيرادات','Total Revenue')}</div></div>
    <div class="stat-card green"><div class="stat-num" style="color:#27ae60">${todayRev.toLocaleString()} ${tUI('ج','EGP')}</div><div class="stat-label">${tUI('إيرادات اليوم',"Today's Revenue")}</div></div>
    <div class="stat-card red"><div class="stat-num" style="color:var(--danger)">${totalExpenses.toLocaleString()} ${tUI('ج','EGP')}</div><div class="stat-label">${tUI('المصاريف','Expenses')}</div></div>
    <div class="stat-card blue"><div class="stat-num" style="color:#2980b9">${(totalRevenue-totalExpenses).toLocaleString()} ${tUI('ج','EGP')}</div><div class="stat-label">${tUI('صافي الربح','Net Profit')}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">${tUI('تقرير الشفتات','Shift Report')}</span>
    <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨️ ${tUI('طباعة','Print')}</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>${tUI('التاريخ','Date')}</th><th>${tUI('الموظف','Staff')}</th><th>${tUI('نقدي','Cash')}</th><th>${tUI('فيزا','Visa')}</th><th>${tUI('محفظة','Wallet')}</th><th>${tUI('الإجمالي','Total')}</th></tr>
      ${shifts.slice(-30).reverse().map(s=>`
      <tr>
        <td>${s.date}</td><td>${s.secName}</td>
        <td>${s.cash||0} ج</td><td>${s.visa||0} ج</td><td>${s.wallet||0} ج</td>
        <td><strong>${((s.cash||0)+(s.visa||0)+(s.wallet||0))} ج</strong></td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

