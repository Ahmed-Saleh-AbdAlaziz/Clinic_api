/* ============================================================
   PAYMENTS MODAL
   ============================================================ */
function showPaymentModal(aptId){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  showModal(`💳 دفع — ${a.patientName}`,`
    <div class="payment-summary">
      <div class="payment-row"><span>الخدمة:</span><strong>${a.serviceName}</strong></div>
      <div class="payment-row"><span>سعر الخدمة:</span><strong>${a.payment.amount} ج</strong></div>
      <div class="payment-row"><span>المدفوع:</span><strong style="color:#7dff9b">${a.payment.paid} ج</strong></div>
      <div class="payment-total" style="display:flex;justify-content:space-between">
        <span>المتبقي:</span><strong>${Math.max(0,a.payment.amount-a.payment.paid)} ج</strong>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>مبلغ إضافي</label>
        <input type="number" id="pay-extra" placeholder="0" value="${Math.max(0,a.payment.amount-a.payment.paid)}">
      </div>
      <div class="form-group">
        <label>طريقة الدفع</label>
        <select id="pay-method-m">
          <option value="cash">نقدي</option><option value="visa">فيزا</option><option value="wallet">محفظة</option>
        </select>
      </div>
    </div>
  `,[
    {label:'تأكيد الدفع',class:'btn-success',onclick:`addPayment(${aptId})`},
    {label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}
  ]);
}

function addPayment(aptId){
  const extra=parseFloat(document.getElementById('pay-extra')?.value||0);
  const method=document.getElementById('pay-method-m')?.value||'cash';
  if(!extra) return;
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const prevOwed=Math.max(0,(a.payment.amount||0)-(a.payment.paid||0));
  a.payment.paid=(a.payment.paid||0)+extra;
  DB.set('appointments',apts);
  if(prevOwed>0){
    const patients=DB.get('patients')||[];
    const p=patients.find(x=>x.id===a.patientId);
    if(p){p.debt=Math.max(0,(p.debt||0)-Math.min(extra,prevOwed));DB.set('patients',patients);}
  }
  updateShiftRevenue(extra,method);
  addLedgerEntry({
    type:'debt_payment', patientId:a.patientId, patientName:a.patientName,
    aptId:a.id, amount:extra, method, note:`سداد جزء من ${a.serviceName}`
  });
  addAuditLog('دفع إضافي',`${a.patientName}: ${extra} ج`);
  showToast('✅ تم تسجيل الدفع');
  closeModal();
}

/* ============================================================
   DEBT PAYMENT + PRE-VISIT REFUND MODAL (SECRETARY)
   ============================================================ */
function openDebtPaymentModal(patientId){
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===patientId);
  if(!p) return;
  const debtApts=(DB.get('appointments')||[]).filter(a=>a.patientId===patientId&&a.payment?.amount>a.payment?.paid&&a.status!=='cancelled');
  showModal(`💳 سداد مديونية — ${p.fullName}`,`
    <div class="payment-summary" style="margin-bottom:1rem">
      <div class="payment-row"><span>المديونية الإجمالية:</span><strong style="color:#ff6b6b">${p.debt||0} ج</strong></div>
    </div>
    ${debtApts.length?debtApts.map(a=>`
      <div style="background:var(--gray-light);border-radius:var(--radius-sm);padding:.7rem;margin-bottom:.5rem;border-right:3px solid var(--danger)">
        <div style="display:flex;justify-content:space-between">
          <strong>${a.date} — ${a.serviceName}</strong>
          <span style="color:var(--danger)">${(a.payment.amount-a.payment.paid)} ج متبقي</span>
        </div>
        <div class="form-grid" style="margin-top:.5rem">
          <div class="form-group">
            <label>المبلغ المراد سداده</label>
            <input type="number" id="debt-pay-${a.id}" value="${Math.max(0,a.payment.amount-a.payment.paid)}" max="${Math.max(0,a.payment.amount-a.payment.paid)}">
          </div>
          <div class="form-group">
            <label>طريقة الدفع</label>
            <select id="debt-method-${a.id}">
              <option value="cash">نقدي</option><option value="visa">فيزا</option><option value="wallet">محفظة</option>
            </select>
          </div>
        </div>
        <button class="btn btn-success btn-sm" style="margin-top:.3rem" onclick="payDebtForAppt(${a.id},${patientId})">✅ سداد هذا الموعد</button>
      </div>`).join(''):`<p style="color:var(--text-muted);text-align:center">لا مديونيات مفصّلة — قد تكون قديمة</p>`}
  `,[{label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}]);
}

function payDebtForAppt(aptId, patientId){
  const amount=parseFloat(document.getElementById('debt-pay-'+aptId)?.value||0);
  const method=document.getElementById('debt-method-'+aptId)?.value||'cash';
  if(!amount||amount<=0){showToast('أدخل مبلغ صحيح','danger');return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const owed=Math.max(0,(a.payment.amount||0)-(a.payment.paid||0));
  const paying=Math.min(amount,owed);
  a.payment.paid=(a.payment.paid||0)+paying;
  DB.set('appointments',apts);
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===patientId);
  if(p){p.debt=Math.max(0,(p.debt||0)-paying);DB.set('patients',patients);}
  updateShiftRevenue(paying,method);
  addLedgerEntry({
    type:'debt_payment', patientId, patientName:a.patientName,
    aptId, amount:paying, method, note:`سداد مديونية — ${a.serviceName}`
  });
  addAuditLog('سداد مديونية',`${a.patientName}: ${paying} ج`);
  showToast(`✅ تم سداد ${paying} ج`);
  closeModal();
  if(document.getElementById('ps-q')) doPatientSearch();
}

/* Pre-visit refund: patient paid but changed mind and won't come */
function openPreVisitRefundModal(aptId){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const paid=a.payment?.paid||0;
  if(paid<=0){showToast('لا يوجد مبلغ مدفوع لاسترداده','warning');return;}
  showModal(`💰 إرجاع مال — ${a.patientName}`,`
    <div class="alert alert-warning" style="margin-bottom:1rem">
      <strong>⚠️ تنبيه:</strong> المريض دفع ولم يحضر أو غيّر رأيه. سيتم إلغاء الحجز وإرجاع المبلغ المدفوع.
    </div>
    <div class="payment-summary">
      <div class="payment-row"><span>الخدمة:</span><strong>${a.serviceName}</strong></div>
      <div class="payment-row"><span>المبلغ المدفوع:</span><strong style="color:#7dff9b">${paid} ج</strong></div>
    </div>
    <div class="form-group" style="margin-top:1rem">
      <label>سبب الإرجاع <span class="required-star">*</span></label>
      <input id="prerefund-reason" placeholder="مثال: المريض غيّر رأيه / ظرف طارئ...">
    </div>
    <div class="form-group" style="margin-top:.7rem">
      <label>المبلغ المُعاد</label>
      <input type="number" id="prerefund-amount" value="${paid}">
    </div>
  `,[
    {label:'✅ تأكيد الإرجاع',class:'btn-danger',onclick:`doPreVisitRefund(${aptId})`},
    {label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}
  ]);
}

function doPreVisitRefund(aptId){
  const reason=document.getElementById('prerefund-reason')?.value.trim();
  const amount=parseFloat(document.getElementById('prerefund-amount')?.value||0);
  if(!reason){showToast('أدخل سبب الإرجاع','danger');return;}
  if(amount<=0){showToast('أدخل مبلغ صحيح','danger');return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  // Deduct from shift
  updateShiftRevenue(-amount, a.payment?.method||'cash');
  // Clear any remaining debt on this appointment
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===a.patientId);
  if(p){
    const wasOwed=Math.max(0,(a.payment?.amount||0)-(a.payment?.paid||0));
    p.debt=Math.max(0,(p.debt||0)-wasOwed);
    DB.set('patients',patients);
  }
  // Zero out appointment payment
  a.payment={...a.payment,paid:0,amount:0};
  a.status='cancelled';
  a.refundReason=reason;
  a.refundAmount=amount;
  a.refundConfirmedAt=new Date().toISOString();
  DB.set('appointments',apts);
  addAuditLog('إرجاع مال (قبل الكشف)',`${a.patientName}: ${amount} ج — ${reason}`);
  addLedgerEntry({
    type:'refund', patientId:a.patientId, patientName:a.patientName,
    aptId:a.id, amount:-amount, method:a.payment?.method||'cash',
    note:`إرجاع قبل الكشف — ${reason}`
  });
  showToast(`✅ تم إرجاع ${amount} ج وإلغاء الحجز`);
  closeModal();
  goTo('today-appointments');
}
function openShiftIfNeeded(){
  const shifts=DB.get('shifts')||[];
  const open=shifts.find(s=>s.userId===currentUser.id&&s.date===today()&&!s.endTime);
  if(!open){
    const shift={id:Date.now(),userId:currentUser.id,secName:currentUser.name,date:today(),startTime:now(),endTime:null,cash:0,visa:0,wallet:0,patients:0};
    shifts.push(shift);
    DB.set('shifts',shifts);
    DB.set('currentShift_'+currentUser.id,shift.id);
  }
}

function getCurrentShiftId(){return DB.get('currentShift_'+currentUser?.id);}

function updateShiftRevenue(amount,method){
  const shiftId=getCurrentShiftId();
  if(!shiftId) return;
  const shifts=DB.get('shifts')||[];
  const s=shifts.find(x=>x.id===shiftId);
  if(!s) return;
  if(method==='cash') s.cash=(s.cash||0)+amount;
  else if(method==='visa') s.visa=(s.visa||0)+amount;
  else s.wallet=(s.wallet||0)+amount;
  s.patients=(s.patients||0)+(amount>0?1:0);
  DB.set('shifts',shifts);
}

function endShiftPrompt(){
  const shiftId=getCurrentShiftId();
  const shifts=DB.get('shifts')||[];
  const s=shifts.find(x=>x.id===shiftId);
  if(s){
    s.endTime=now();DB.set('shifts',shifts);
    alert(`تقرير الشفت:\n👤 ${s.secName}\n⏰ ${s.startTime} — ${s.endTime}\n💵 نقدي: ${s.cash||0} ج\n💳 فيزا: ${s.visa||0} ج\n📱 محفظة: ${s.wallet||0} ج\n🏥 المرضى: ${s.patients||0}`);
  }
  currentUser=null;if(queueRefreshInterval)clearInterval(queueRefreshInterval);location.reload();
}

function renderShiftReport(c){
  const shifts=DB.get('shifts')||[];
  const myShifts=currentUser.role==='admin'?shifts:shifts.filter(s=>s.userId===currentUser.id);
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">💵 تقرير الشفتات</span>
      ${currentUser.role==='secretary'?`<button class="btn btn-danger btn-sm" onclick="endShiftPrompt()">إغلاق الشفت</button>`:''}
    </div>
    <div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>الموظف</th><th>البداية</th><th>النهاية</th><th>نقدي</th><th>فيزا</th><th>محفظة</th><th>الإجمالي</th><th>المرضى</th><th>الحالة</th></tr>
      ${myShifts.slice(-30).reverse().map(s=>`
      <tr>
        <td>${s.date}</td><td>${s.secName}</td><td>${s.startTime}</td><td>${s.endTime||'جاري'}</td>
        <td>${s.cash||0} ج</td><td>${s.visa||0} ج</td><td>${s.wallet||0} ج</td>
        <td><strong>${((s.cash||0)+(s.visa||0)+(s.wallet||0))} ج</strong></td>
        <td>${s.patients||0}</td>
        <td><span class="badge ${s.endTime?'badge-success':'badge-warning'}">${s.endTime?'مغلق':'مفتوح'}</span></td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

function renderPayments(c){
  const apts=(DB.get('appointments')||[]).filter(a=>a.payment?.paid>0||a.payment?.amount>0);
  c.innerHTML=`
  <div class="card">
    <div class="card-header"><span class="card-title">💳 سجل المدفوعات</span>
    <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨️ طباعة</button></div>
    <div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>المريض</th><th>الخدمة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الطريقة</th><th class="no-print">إجراءات</th></tr>
      ${apts.slice(-80).reverse().map(a=>`
      <tr>
        <td>${a.date}</td><td>${a.patientName}</td><td>${a.serviceName}</td>
        <td>${a.payment?.amount||0} ج</td>
        <td style="color:#27ae60;font-weight:600">${a.payment?.paid||0} ج</td>
        <td style="${a.payment?.amount>a.payment?.paid?'color:var(--danger)':''}">${Math.max(0,(a.payment?.amount||0)-(a.payment?.paid||0))} ج</td>
        <td>${payMethodLabel(a.payment?.method)}</td>
        <td class="no-print"><button class="btn btn-sm btn-outline" onclick="printReceipt(${a.id})">🖨️</button></td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

