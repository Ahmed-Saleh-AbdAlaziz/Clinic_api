/* ============================================================
   PRINT RECEIPT
   ============================================================ */
function printReceipt(aptId){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const cname=DB.get('clinicName')||'عيادة النيل';
  const logo=DB.get('clinicLogo');
  const w=window.open('','_blank','width=600,height=700');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>رسيد</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl}h2{text-align:center;margin-bottom:5px}.logo{display:block;max-height:60px;margin:0 auto 10px}hr{border:1px dashed #ccc;margin:10px 0}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:14px}.total{font-size:18px;font-weight:bold;text-align:center;margin-top:10px}.footer{text-align:center;font-size:12px;color:#777;margin-top:15px}</style>
  </head><body>
  ${logo?`<img src="${logo}" class="logo">`:''}
  <h2>${cname}</h2>
  <p style="text-align:center;color:#555;font-size:13px">رسيد رقم #${a.id} — ${a.date}</p>
  <hr>
  <div class="row"><span>المريض:</span><strong>${a.patientName}</strong></div>
  <div class="row"><span>كود المريض:</span><span>${a.patientCode}</span></div>
  <div class="row"><span>الدكتور:</span><span>${a.doctorName}</span></div>
  <div class="row"><span>الخدمة:</span><span>${a.serviceName}</span></div>
  ${a.packageId?`<div class="row"><span>الباقة:</span><span>مشترك في باقة</span></div>`:''}
  <div class="row"><span>الوقت:</span><span>${a.time}</span></div>
  <hr>
  <div class="row"><span>إجمالي السعر:</span><span>${a.payment?.amount||0} جنيه</span></div>
  <div class="row"><span>المدفوع:</span><strong style="color:green">${a.payment?.paid||0} جنيه</strong></div>
  ${(a.payment?.amount||0)>(a.payment?.paid||0)?`<div class="row"><span>المتبقي:</span><strong style="color:red">${(a.payment?.amount||0)-(a.payment?.paid||0)} جنيه</strong></div>`:''}
  <div class="row"><span>طريقة الدفع:</span><span>${payMethodLabel(a.payment?.method)}</span></div>
  <div class="footer">شكراً لثقتكم بنا • ${cname}</div>
  \x3Cscript\x3Ewindow.print();setTimeout(()=>window.close(),500)\x3C/script\x3E
  </body></html>`);
  w.document.close();
}

/* ============================================================
   PATIENT SEARCH
   ============================================================ */
function renderPatientSearch(c){
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">🔍 البحث عن مريض</span>
      <div class="btn-group">
        <button class="btn btn-sm btn-outline no-print" onclick="exportVCF()">📇 تصدير VCF</button>
        <button class="btn btn-sm btn-outline no-print" onclick="exportAllPhones()">📱 كل التليفونات</button>
      </div>
    </div>
    <div style="display:flex;gap:.7rem;margin-bottom:1rem">
      <input id="ps-q" placeholder="ابحث بالاسم، التليفون، أو كود المريض..." style="flex:1;padding:.6rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)" oninput="doPatientSearch()">
    </div>
    <div id="ps-results"></div>
  </div>`;
}

function doPatientSearch(){
  const q=document.getElementById('ps-q').value.trim().toLowerCase();
  const el=document.getElementById('ps-results');
  if(!q){el.innerHTML='';return;}
  const patients=DB.get('patients')||[];
  const found=patients.filter(p=>
    (p.fullName||'').toLowerCase().includes(q)||
    p.phone?.includes(q)||p.code?.toLowerCase()===q
  );
  if(!found.length){el.innerHTML='<p style="color:var(--text-muted)">لا نتائج</p>';return;}
  el.innerHTML=`<div class="table-wrap"><table>
    <tr><th>الكود</th><th>الاسم</th><th>التليفون</th><th>العمر</th><th>الزيارات</th><th>الوضع المالي</th><th>إجراءات</th></tr>
    ${found.map(p=>{
      const apts=(DB.get('appointments')||[]).filter(a=>a.patientId===p.id);
      return `<tr>
        <td>${p.code}</td>
        <td>${p.fullName}</td>
        <td><a href="https://wa.me/2${p.phone}" target="_blank" style="color:var(--primary)">${p.phone}</a></td>
        <td>${p.age} ${p.ageType==='year'?'سنة':p.ageType==='month'?'شهر':'يوم'}</td>
        <td>${apts.length}</td>
        <td>
          ${p.debt>0?`<span class="badge badge-danger">مديون: ${p.debt} ج</span>
            <button class="btn btn-sm btn-warning" style="margin-right:.3rem" onclick="openDebtPaymentModal(${p.id})">سداد</button>`:
            p.credit>0?`<span class="badge badge-success">له: ${p.credit} ج</span>`:
            '<span class="badge badge-success">لا ديون</span>'}
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="showPatientProfile(${p.id})">الملف</button>
          <button class="btn btn-sm btn-primary" onclick="printPatientFile(${p.id})">🖨️ طباعة</button>
        </td>
      </tr>`;
    }).join('')}
  </table></div>`;
}

/* ============================================================
   PATIENT PROFILE MODAL
   ============================================================ */
async function showPatientProfile(id){
  const p=(DB.get('patients')||[]).find(x=>x.id===id);
  if(!p) return;

  // ── حاول تاخد الـ lock ──
  const lockResult = await acquireLock('patient', id);
  let lockBannerHtml = '';
  let canEdit = true;

  if (!lockResult.ok) {
    canEdit = false;
    lockBannerHtml = buildLockBanner(lockResult.lockedBy, lockResult.since, lockResult.viewers||[]);
    // سجّل إنك عايز تعدل لما اللوك يتشال
    _watchLock('patient', id, p.fullName);
  } else {
    // سجّل إنك بتشوف الملف
    apiCall('lock_view', { type:'patient', id, user_name: currentUser?.name, user_id: currentUser?.id }).catch(()=>{});
  }
  const apts=(DB.get('appointments')||[]).filter(a=>a.patientId===id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const ledgerEntries=getLedgerForPatient(id).sort((a,b)=>b.ts.localeCompare(a.ts));
  const totalPaid=ledgerEntries.filter(e=>e.amount>0).reduce((s,e)=>s+e.amount,0);
  const totalRefunded=ledgerEntries.filter(e=>e.amount<0).reduce((s,e)=>s+e.amount,0);
  const netPaid=totalPaid+totalRefunded;
  showModal(`ملف المريض — ${p.fullName}`,`
    ${lockBannerHtml}
    <div class="patient-card-lg">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.9rem">
        <div><strong>الكود:</strong> ${p.code}</div>
        <div><strong>الهاتف:</strong> <a href="https://wa.me/2${p.phone}" style="color:var(--primary)">${p.phone} 📲</a></div>
        <div><strong>العمر:</strong> ${p.age} ${p.ageType==='year'?'سنة':p.ageType==='month'?'شهر':'يوم'}${p.birthDate?` (${p.birthDate})`:''}
</div>
        <div><strong>الجنس:</strong> ${p.gender==='male'?'ذكر':'أنثى'}</div>
        <div><strong>المصدر:</strong> ${p.source||'—'}</div>
        <div><strong>تاريخ التسجيل:</strong> ${fmtDate(p.registeredAt)}</div>
        <div><strong>إجمالي المدفوع:</strong> <span style="color:#27ae60;font-weight:600">${netPaid.toLocaleString()} ج</span></div>
        <div><strong>حالة الحساب:</strong> ${patientBalanceBadgeHTML(p)}</div>
        ${p.debt>0?`<div style="color:var(--danger);font-weight:600"><strong>⚠️ مديونية:</strong> ${p.debt} ج <button class="btn btn-sm btn-warning" onclick="closeModal();openDebtPaymentModal(${p.id})">سداد</button></div>`:''}
        ${p.credit>0?`<div style="color:#27ae60;font-weight:600"><strong>💚 رصيد للمريض:</strong> ${p.credit} ج</div>`:''}
      </div>
    </div>
    <div class="btn-group no-print" style="margin-bottom:.8rem">
      <button class="btn btn-sm btn-outline" onclick="printPatientFile(${id})">🖨️ طباعة الملف</button>
      <button class="btn btn-sm btn-warning" onclick="showPartialRefundModal(${id})">💰 استرداد جزئي</button>
      ${currentUser.role==='admin'?`<button class="btn btn-sm btn-secondary" onclick="openBalanceAdjustModal(${id})">⚖️ تسوية حساب المريض</button>`:''}
    </div>
    <div class="tabs" style="margin-bottom:1rem">
      <div class="tab active" onclick="switchTab(this,'tab-visits')">الزيارات (${apts.length})</div>
      <div class="tab" onclick="switchTab(this,'tab-fin')">📊 السجل المالي</div>
    </div>
    <div id="tab-visits">
      ${apts.length?apts.map(a=>`
        <div class="visit-history-item">
          <div style="display:flex;justify-content:space-between">
            <strong>${a.date} — ${a.serviceName}</strong>
            <span class="badge ${statusBadge(a.status)}">${statusLabel(a.status)}</span>
          </div>
          <div style="font-size:.82rem;color:var(--text-muted);margin-top:.3rem">${a.doctorName} | دفع: ${a.payment?.paid||0} ج من ${a.payment?.amount||0} ج</div>
          ${a.complaint?`<div style="font-size:.82rem;margin-top:.2rem">الشكوى: ${a.complaint}</div>`:''}
          ${a.medicalData?.diagnosis?`<div style="font-size:.82rem;margin-top:.2rem;color:var(--primary)">التشخيص: ${a.medicalData.diagnosis}</div>`:''}
          <button class="btn btn-sm btn-outline no-print" style="margin-top:.4rem" onclick="printReceipt(${a.id})">🖨️ رسيد</button>
        </div>`).join(''):'<p style="color:var(--text-muted)">لا زيارات بعد</p>'}
    </div>
    <div id="tab-fin" class="hidden">
      <!-- Summary bar -->
      <div class="payment-summary" style="margin-bottom:1rem">
        <div class="payment-row"><span>إجمالي الزيارات:</span><strong>${apts.length}</strong></div>
        <div class="payment-row"><span>إجمالي المدخلات:</span><strong style="color:#7dff9b">+${totalPaid.toLocaleString()} ج</strong></div>
        <div class="payment-row"><span>إجمالي المستردات:</span><strong style="color:#ff6b6b">${totalRefunded.toLocaleString()} ج</strong></div>
        <div class="payment-row payment-total"><span>صافي المدفوع:</span><strong style="color:#fff">${netPaid.toLocaleString()} ج</strong></div>
        ${p.debt>0?`<div class="payment-row"><span>مديونية متبقية:</span><strong style="color:#ff6b6b">${p.debt} ج</strong></div>`:''}
      </div>
      <!-- Ledger table -->
      ${ledgerEntries.length?`
      <div class="table-wrap"><table>
        <thead><tr><th>التاريخ</th><th>الوقت</th><th>النوع</th><th>المبلغ</th><th>الطريقة</th><th>تفاصيل</th><th>بواسطة</th></tr></thead>
        <tbody>
        ${ledgerEntries.map(e=>`
          <tr>
            <td>${e.date}</td>
            <td style="font-size:.78rem;color:var(--text-muted)">${e.timeStr||'—'}</td>
            <td><span class="badge" style="background:${e.amount>=0?'#d5f5e3':'#fadbd8'};color:${e.amount>=0?'#1e8449':'#922b21'}">${ledgerTypeLabel(e.type)}</span></td>
            <td style="font-weight:700;color:${e.amount>=0?'#27ae60':'var(--danger)'}">
              ${e.amount>=0?'+':''}${e.amount.toLocaleString()} ج
            </td>
            <td>${payMethodLabel(e.method)}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${e.note||'—'}</td>
            <td style="font-size:.78rem">${e.addedBy||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`:'<p style="color:var(--text-muted);text-align:center;padding:1rem">لا سجلات مالية بعد</p>'}
    </div>
  `,[{label: canEdit ? '🔓 إغلاق الملف' : '✕ إغلاق', class:'btn-secondary',
      onclick: canEdit ? `releaseLock('patient',${id});closeModal()` : 'closeModal()'}]);
}

/* مراقبة الـ lock — ينبّهك لما الملف يتفتح */
function _watchLock(type, id, label) {
  // بيكشف في كل sync لو اللوك اتشال — الـ syncToServer بيعمل released_locks
  // بس كمان نحفظ الطلب عشان الإشعار يكون له action يفتح الملف
  pushNotif(`🔒 ملف "${label}" محجوز — ستُبلَّغ فور توفره`, 'lock_blocked');
}

/* Partial refund modal — refund any amount from patient's paid visits */
function showPartialRefundModal(patientId){
  const p=(DB.get('patients')||[]).find(x=>x.id===patientId);
  if(!p) return;
  const paidApts=(DB.get('appointments')||[])
    .filter(a=>a.patientId===patientId&&(a.payment?.paid||0)>0&&a.status!=='cancelled')
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  closeModal();
  showModal(`💰 استرداد جزئي — ${p.fullName}`,`
    <div class="alert alert-info" style="margin-bottom:1rem">
      يمكنك إرجاع جزء من المبلغ المدفوع لأي زيارة. المبلغ المُعاد يُخصم من الخزنة ويُسجل في السجل المالي للمريض.
    </div>
    ${paidApts.length?paidApts.map(a=>`
      <div style="background:var(--gray-light);border-radius:var(--radius-sm);padding:.8rem;margin-bottom:.6rem;border-right:3px solid var(--primary)">
        <div style="display:flex;justify-content:space-between;margin-bottom:.4rem">
          <strong>${a.date} — ${a.serviceName}</strong>
          <span style="color:#27ae60;font-weight:600">مدفوع: ${a.payment.paid} ج</span>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>مبلغ الاسترداد</label>
            <input type="number" id="pref-amt-${a.id}" placeholder="0" min="0" max="${a.payment.paid}" style="border:1px solid var(--gray-border);border-radius:var(--radius-sm);padding:.45rem .7rem">
          </div>
          <div class="form-group">
            <label>طريقة الإرجاع</label>
            <select id="pref-mth-${a.id}" style="border:1px solid var(--gray-border);border-radius:var(--radius-sm);padding:.45rem .7rem">
              <option value="cash">نقدي</option><option value="visa">فيزا</option><option value="wallet">محفظة</option>
            </select>
          </div>
          <div class="form-group">
            <label>سبب الاسترداد</label>
            <input id="pref-rsn-${a.id}" placeholder="اختياري..." style="border:1px solid var(--gray-border);border-radius:var(--radius-sm);padding:.45rem .7rem">
          </div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="doPartialRefund(${a.id},${patientId})">↩️ تأكيد استرداد هذا الموعد</button>
      </div>`).join(''):`<p style="color:var(--text-muted);text-align:center;padding:1.5rem">لا توجد زيارات مدفوعة قابلة للاسترداد</p>`}
  `,[{label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}]);
}

function doPartialRefund(aptId, patientId){
  const amount=parseFloat(document.getElementById('pref-amt-'+aptId)?.value||0);
  const method=document.getElementById('pref-mth-'+aptId)?.value||'cash';
  const reason=document.getElementById('pref-rsn-'+aptId)?.value||'';
  if(!amount||amount<=0){showToast('أدخل مبلغ صحيح','danger');return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a){showToast('خطأ في الموعد','danger');return;}
  if(amount>a.payment.paid){showToast(`لا يمكن إرجاع أكثر من المبلغ المدفوع (${a.payment.paid} ج)`,'danger');return;}
  // Deduct from appointment paid
  a.payment.paid=Math.max(0,a.payment.paid-amount);
  DB.set('appointments',apts);
  // Deduct from shift
  updateShiftRevenue(-amount, method);
  // Log to ledger
  addLedgerEntry({
    type:'partial_refund', patientId, patientName:a.patientName,
    aptId:a.id, amount:-amount, method,
    note:`استرداد جزئي — ${a.serviceName}${reason?' — '+reason:''}`
  });
  addAuditLog('استرداد جزئي',`${a.patientName}: ${amount} ج — ${reason||'بدون سبب'}`);
  showToast(`✅ تم استرداد ${amount} ج من موعد ${a.date}`);
  // Refresh modal
  closeModal();
  showPatientProfile(patientId);
}

/* ============================================================
   ADMIN: MANUAL BALANCE ADJUSTMENT (credit / debt)
   ============================================================ */
function openBalanceAdjustModal(patientId){
  if(currentUser.role!=='admin'){showToast('هذه الميزة متاحة للأدمن فقط','danger');return;}
  const p=(DB.get('patients')||[]).find(x=>x.id===patientId);
  if(!p) return;
  closeModal();
  showModal(`⚖️ تسوية حساب — ${p.fullName}`,`
    <div class="payment-summary" style="margin-bottom:1rem">
      <div class="payment-row"><span>مديونية حالية (عليه):</span><strong style="color:#ff6b6b">${p.debt||0} ج</strong></div>
      <div class="payment-row"><span>رصيد حالي (له):</span><strong style="color:#7dff9b">${p.credit||0} ج</strong></div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>نوع التسوية</label>
        <select id="badj-type">
          <option value="add_credit">إضافة رصيد للمريض (له)</option>
          <option value="remove_credit">خصم رصيد من المريض (له)</option>
          <option value="add_debt">إضافة مديونية على المريض (عليه)</option>
          <option value="remove_debt">إسقاط/تخفيض مديونية المريض (عليه)</option>
        </select>
      </div>
      <div class="form-group"><label>المبلغ</label><input type="number" id="badj-amount" min="0" placeholder="0"></div>
    </div>
    <div class="form-group" style="margin-top:.7rem"><label>السبب <span class="required-star">*</span></label><input id="badj-reason" placeholder="سبب التسوية..."></div>
  `,[
    {label:'✅ تنفيذ التسوية',class:'btn-success',onclick:`applyBalanceAdjust(${patientId})`},
    {label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}
  ]);
}

function applyBalanceAdjust(patientId){
  if(currentUser.role!=='admin'){showToast('هذه الميزة متاحة للأدمن فقط','danger');return;}
  const type=document.getElementById('badj-type')?.value;
  const amount=parseFloat(document.getElementById('badj-amount')?.value||0);
  const reason=document.getElementById('badj-reason')?.value?.trim();
  if(!amount||amount<=0){showToast('أدخل مبلغ صحيح','danger');return;}
  if(!reason){showToast('أدخل سبب التسوية','danger');return;}
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===patientId);
  if(!p) return;
  let detail='';
  switch(type){
    case 'add_credit': p.credit=(p.credit||0)+amount; detail=`إضافة رصيد ${amount} ج`; break;
    case 'remove_credit': p.credit=Math.max(0,(p.credit||0)-amount); detail=`خصم رصيد ${amount} ج`; break;
    case 'add_debt': p.debt=(p.debt||0)+amount; detail=`إضافة مديونية ${amount} ج`; break;
    case 'remove_debt': p.debt=Math.max(0,(p.debt||0)-amount); detail=`إسقاط مديونية ${amount} ج`; break;
  }
  DB.set('patients',patients);
  addLedgerEntry({
    type:'balance_adjust', patientId, patientName:p.fullName,
    aptId:null, amount:0, method:'cash',
    note:`${detail} — ${reason}`
  });
  addAuditLog('تسوية حساب مريض',`${p.fullName}: ${detail} — ${reason}`);
  showToast('✅ تم تنفيذ التسوية');
  closeModal();
  showPatientProfile(patientId);
}

/* ============================================================
   PRINT PATIENT FILE
   ============================================================ */
function printPatientFile(id){
  const p=(DB.get('patients')||[]).find(x=>x.id===id);
  if(!p) return;
  const apts=(DB.get('appointments')||[]).filter(a=>a.patientId===id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const cname=DB.get('clinicName')||'عيادة النيل';
  const logo=DB.get('clinicLogo');
  const w=window.open('','_blank','width=700,height=900');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>ملف مريض</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl}h2{text-align:center}.logo{display:block;max-height:60px;margin:0 auto 10px}hr{border:1px solid #ccc;margin:10px 0}.section{margin-bottom:15px}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:13px}.visit{background:#f9f9f9;border-right:3px solid #1a6b5a;padding:8px;margin-bottom:8px;border-radius:4px}h3{color:#1a6b5a;font-size:14px}</style>
  </head><body>
  ${logo?`<img src="${logo}" class="logo">`:''}
  <h2>${cname}</h2><h2 style="font-size:16px">ملف المريض</h2>
  <hr>
  <div class="section">
    <h3>البيانات الأساسية</h3>
    <div class="row"><span>الاسم:</span><strong>${p.fullName}</strong></div>
    <div class="row"><span>الكود:</span><span>${p.code}</span></div>
    <div class="row"><span>الهاتف:</span><span>${p.phone}</span></div>
    <div class="row"><span>العمر:</span><span>${p.age} ${p.ageType==='year'?'سنة':p.ageType==='month'?'شهر':'يوم'}${p.birthDate?' — '+p.birthDate:''}</span></div>
    <div class="row"><span>الجنس:</span><span>${p.gender==='male'?'ذكر':'أنثى'}</span></div>
    <div class="row"><span>تاريخ التسجيل:</span><span>${fmtDate(p.registeredAt)}</span></div>
    ${p.debt>0?`<div class="row"><span>المديونية:</span><strong style="color:red">${p.debt} ج</strong></div>`:''}
    ${p.credit>0?`<div class="row"><span>رصيد له:</span><strong style="color:green">${p.credit} ج</strong></div>`:''}
  </div>
  <hr>
  <div class="section">
    <h3>سجل الزيارات (${apts.length})</h3>
    ${apts.map(a=>`<div class="visit">
      <strong>${a.date} — ${a.serviceName}</strong> | ${a.doctorName}<br>
      ${a.complaint?`الشكوى: ${a.complaint}<br>`:''}
      ${a.medicalData?.diagnosis?`التشخيص: ${a.medicalData.diagnosis}<br>`:''}
      ${a.medicalData?.plan?`العلاج: ${a.medicalData.plan}<br>`:''}
      المدفوع: ${a.payment?.paid||0} ج من ${a.payment?.amount||0} ج
    </div>`).join('')||'<p>لا زيارات</p>'}
  </div>
  \x3Cscript\x3Ewindow.print();setTimeout(()=>window.close(),500)\x3C/script\x3E
  </body></html>`);
  w.document.close();
}

