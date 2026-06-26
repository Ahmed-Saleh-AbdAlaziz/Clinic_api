/* ============================================================
   LEDGER — Unified financial ledger for every money movement
   Types: payment | partial_payment | refund | partial_refund
          debt_payment | expense | package_payment | discount
   ============================================================ */
function addLedgerEntry({type, patientId, patientName, aptId, amount, method, note, shiftId}){
  const ledger = DB.get('ledger') || [];
  ledger.push({
    id: Date.now() + Math.random(),
    ts: new Date().toISOString(),
    date: today(),
    timeStr: now(),
    type,
    patientId: patientId || null,
    patientName: patientName || '—',
    aptId: aptId || null,
    amount,          // positive = money IN, negative = money OUT (refund/expense)
    method: method || 'cash',
    note: note || '',
    shiftId: shiftId || getCurrentShiftId() || null,
    addedBy: currentUser?.name || '—',
    addedById: currentUser?.id || null
  });
  if(ledger.length > 5000) ledger.splice(0, ledger.length - 5000);
  DB.set('ledger', ledger);
}

function getLedgerForPatient(patientId){
  return (DB.get('ledger') || []).filter(e => e.patientId === patientId);
}

function getVaultBalance(){
  const ledger = DB.get('ledger') || [];
  return ledger.reduce((s, e) => s + (e.amount || 0), 0);
}

function getVaultByMethod(){
  const ledger = DB.get('ledger') || [];
  const r = {cash:0, visa:0, wallet:0};
  ledger.forEach(e => {
    if(r[e.method] !== undefined) r[e.method] += (e.amount || 0);
    else r.cash += (e.amount || 0);
  });
  return r;
}

function ledgerTypeLabel(type){
  const map = {
    payment: 'دفع خدمة', partial_payment: 'دفعة جزئية',
    refund: 'استرداد كامل', partial_refund: 'استرداد جزئي',
    debt_payment: 'سداد مديونية', expense: 'مصروف',
    package_payment: 'دفع باقة', discount: 'خصم',
    balance_adjust: 'تسوية حساب', charge_added: 'إضافة رسم خدمة', charge_removed: 'حذف رسم خدمة'
  };
  return map[type] || type;
}

function ledgerTypeColor(type){
  if(type.includes('refund') || type === 'expense') return 'var(--danger)';
  if(type === 'discount') return 'var(--warning)';
  return '#27ae60';
}

/* Patient financial status: debt (عليه فلوس) vs credit (له فلوس) */
function patientBalanceInfo(p){
  const debt=p.debt||0, credit=p.credit||0;
  if(debt>0) return {type:'debt', amount:debt, label:`عليه: ${debt.toLocaleString()} ج`, color:'var(--danger)', badge:'badge-danger'};
  if(credit>0) return {type:'credit', amount:credit, label:`له: ${credit.toLocaleString()} ج`, color:'#27ae60', badge:'badge-success'};
  return {type:'none', amount:0, label:'الحساب متوازن', color:'var(--text-muted)', badge:'badge-secondary'};
}
function patientBalanceBadgeHTML(p){
  const b=patientBalanceInfo(p);
  if(b.type==='none') return `<span class="badge" style="background:var(--gray-light);color:var(--text-muted)">✔️ متوازن</span>`;
  return `<span class="badge" style="background:${b.type==='debt'?'var(--danger-light)':'#d5f5e3'};color:${b.color};font-weight:600">${b.type==='debt'?'⚠️':'💚'} ${b.label}</span>`;
}
function calcAgeFromBirth(bd){
  if(!bd) return null;
  const diff=Date.now()-new Date(bd).getTime();
  const years=Math.floor(diff/(1000*60*60*24*365.25));
  const months=Math.floor(diff/(1000*60*60*24*30.4));
  const days=Math.floor(diff/(1000*60*60*24));
  if(years>=1) return {age:years,ageType:'year'};
  if(months>=1) return {age:months,ageType:'month'};
  return {age:days,ageType:'day'};
}

