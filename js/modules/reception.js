/* ============================================================
   TODAY APPOINTMENTS (SECRETARY)
   ============================================================ */
function renderTodayAppointments(c){
  const apts=(DB.get('appointments')||[]).filter(a=>a.date===today()).sort((a,b)=>a.queueNum-b.queueNum);
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">📅 ${tUI('مواعيد اليوم',"Today's Appointments")} (${apts.length} ${tUI('موعد','appointments')})</span>
      <div class="btn-group">
        <button class="btn btn-sm btn-secondary no-print" onclick="exportTodayPhones()">📱 ${tUI('تصدير التليفونات','Export Phones')}</button>
        <button class="btn btn-sm btn-outline no-print" onclick="exportVCF()">📇 ${tUI('تصدير VCF','Export VCF')}</button>
        <button class="btn btn-sm btn-outline no-print" onclick="exportTodayPatients()">📄 ${tUI('تصدير Excel','Export Excel')}</button>
        <button class="btn btn-sm btn-primary no-print" onclick="window.print()">🖨️ ${tUI('طباعة','Print')}</button>
      </div>
    </div>
    <div class="table-wrap">
    <table>
      <tr><th>${tUI('رقم','#')}</th><th>${tUI('المريض','Patient')}</th><th>${tUI('الدكتور','Doctor')}</th><th>${tUI('الخدمة','Service')}</th><th>${tUI('الوقت','Time')}</th><th>${tUI('الحالة','Status')}</th><th>${tUI('المدفوع / المتبقي','Paid / Remaining')}</th><th class="no-print">${tUI('إجراءات','Actions')}</th></tr>
      ${apts.map(a=>`
      <tr>
        <td><strong>${a.queueNum}</strong></td>
        <td>
          <div>${a.patientName}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${a.patientCode}</div>
        </td>
        <td>${a.doctorName}</td>
        <td>${a.serviceName}${a.packageId?'<br><span class="badge badge-info" style="font-size:.7rem">+ باقة</span>':''}</td>
        <td>${a.time}</td>
        <td><span class="badge ${statusBadge(a.status)}">${statusLabel(a.status)}</span></td>
        <td>
          <div style="color:#27ae60;font-weight:600">${a.payment?.paid||0} ج</div>
          ${a.payment?.amount>a.payment?.paid?`<div style="color:var(--danger);font-size:.75rem">متبقي: ${a.payment.amount-a.payment.paid} ج</div>`:''}
        </td>
        <td class="no-print">
          <div class="btn-group">
            ${a.status==='waiting'?`<button class="btn btn-sm btn-warning" onclick="callPatient(${a.id})">نادِ</button>`:''}
            ${a.status!=='done'&&a.status!=='cancelled'?`<button class="btn btn-sm btn-danger" onclick="openCancelOptionsModal(${a.id})">⚙️ إلغاء/استرداد</button>`:''}
            ${currentUser.role==='admin'?`<button class="btn btn-sm btn-outline" onclick="openServiceChargesModal(${a.id})" title="إضافة/حذف رسوم خدمات">💲 الخدمات</button>`:''}
            <button class="btn btn-sm btn-secondary" onclick="showPaymentModal(${a.id})">دفع</button>
            <button class="btn btn-sm btn-outline" onclick="printReceipt(${a.id})">🖨️</button>
          </div>
        </td>
      </tr>`).join('')}
    </table>
    </div>
  </div>`;
}

function callPatient(id){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===id);
  if(!a) return;
  a.status='called';a.calledAt=new Date().toISOString();
  DB.set('appointments',apts);
  showToast(`📢 تم نداء ${a.patientName}`);
  goTo('today-appointments');
}

function cancelAppt(id){
  if(!confirm('هل تريد إلغاء هذا الموعد؟')) return;
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===id);
  if(!a) return;
  if(a.payment?.paid>0){
    const reason=prompt('سبب الإلغاء والاسترداد؟');
    if(!reason) return;
    a.refundReason=reason;a.refundAmount=a.payment.paid;
    updateShiftRevenue(-a.payment.paid,a.payment.method);
    // Update patient debt (remove unpaid portion)
    const patients=DB.get('patients')||[];
    const p=patients.find(x=>x.id===a.patientId);
    if(p&&a.payment.amount>a.payment.paid){
      p.debt=Math.max(0,(p.debt||0)-(a.payment.amount-a.payment.paid));
      DB.set('patients',patients);
    }
    // Zero out entire service amount — cancelled means nothing owed
    a.payment.paid=0;
    a.payment.amount=0;
  } else if(a.payment?.amount>0){
    // No money paid but there was an amount (debt case) — clear it
    const patients=DB.get('patients')||[];
    const p=patients.find(x=>x.id===a.patientId);
    if(p){
      p.debt=Math.max(0,(p.debt||0)-(a.payment.amount||0));
      DB.set('patients',patients);
    }
    a.payment.amount=0;
  }
  a.status='cancelled';
  DB.set('appointments',apts);
  addAuditLog('إلغاء موعد',`${a.patientName}: ${a.refundReason||'بدون استرداد'}`);
  showToast('تم إلغاء الموعد');goTo('today-appointments');
}

/* ============================================================
   CANCEL / REFUND OPTIONS — three choices for today's appointments
   1) Partial refund + keep appointment active
   2) Full refund + cancel appointment
   3) Cancel appointment without any refund
   ============================================================ */
function openCancelOptionsModal(aptId){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const paid=a.payment?.paid||0;
  showModal(`⚙️ خيارات الإلغاء / الاسترداد — ${a.patientName}`,`
    <div class="payment-summary" style="margin-bottom:1rem">
      <div class="payment-row"><span>الخدمة:</span><strong>${a.serviceName}</strong></div>
      <div class="payment-row"><span>السعر الإجمالي:</span><strong>${a.payment?.amount||0} ج</strong></div>
      <div class="payment-row"><span>المدفوع:</span><strong style="color:#7dff9b">${paid} ج</strong></div>
    </div>
    ${paid>0?`
    <div style="background:var(--gray-light);border-radius:var(--radius-sm);padding:.8rem;margin-bottom:.8rem">
      <strong>1️⃣ استرجاع جزء من المال وإكمال الحجز</strong>
      <p style="font-size:.78rem;color:var(--text-muted);margin:.3rem 0">يتم تقليل السعر والمدفوع بنفس القيمة، ويستمر الحجز كما هو.</p>
      <div class="form-grid">
        <div class="form-group"><label>المبلغ المسترجَع</label><input type="number" id="opt-partial-amt" min="0" max="${paid}" placeholder="0"></div>
        <div class="form-group"><label>طريقة الإرجاع</label>
          <select id="opt-partial-mth"><option value="cash">نقدي</option><option value="visa">فيزا</option><option value="wallet">محفظة</option></select>
        </div>
        <div class="form-group"><label>السبب</label><input id="opt-partial-rsn" placeholder="اختياري"></div>
      </div>
      <button class="btn btn-sm btn-warning" style="margin-top:.5rem" onclick="doPartialRefundKeepAppt(${aptId})">✅ تأكيد الاسترجاع الجزئي</button>
    </div>
    <div style="background:var(--gray-light);border-radius:var(--radius-sm);padding:.8rem;margin-bottom:.8rem">
      <strong>2️⃣ استرجاع المال كله وإلغاء الحجز</strong>
      <p style="font-size:.78rem;color:var(--text-muted);margin:.3rem 0">يتم رد كل المدفوع (${paid} ج) للمريض، وإلغاء الحجز نهائياً.</p>
      <div class="form-group"><label>السبب</label><input id="opt-full-rsn" placeholder="سبب الإلغاء والاسترداد"></div>
      <button class="btn btn-sm btn-danger" style="margin-top:.5rem" onclick="doFullRefundCancel(${aptId})">↩️ تأكيد الاسترجاع الكامل والإلغاء</button>
    </div>`:''}
    <div style="background:var(--gray-light);border-radius:var(--radius-sm);padding:.8rem">
      <strong>${paid>0?'3️⃣':'1️⃣'} إلغاء الحجز بدون استرجاع المال</strong>
      ${paid>0?`<p style="font-size:.78rem;color:var(--text-muted);margin:.3rem 0">يتم إلغاء الحجز والاحتفاظ بالمبلغ المدفوع (${paid} ج) كإيراد دون رده، وإسقاط أي متبقي.</p>`:`<p style="font-size:.78rem;color:var(--text-muted);margin:.3rem 0">لا يوجد مبلغ مدفوع — سيتم إلغاء الحجز فقط.</p>`}
      <button class="btn btn-sm btn-secondary" style="margin-top:.5rem" onclick="doCancelNoRefund(${aptId})">🚫 تأكيد الإلغاء بدون استرجاع</button>
    </div>
  `,[{label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}]);
}

/* Option 1: refund part of the money, keep the appointment active at the reduced price */
function doPartialRefundKeepAppt(aptId){
  const amount=parseFloat(document.getElementById('opt-partial-amt')?.value||0);
  const method=document.getElementById('opt-partial-mth')?.value||'cash';
  const reason=document.getElementById('opt-partial-rsn')?.value||'';
  if(!amount||amount<=0){showToast('أدخل مبلغ صحيح','danger');return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a){showToast('خطأ في الموعد','danger');return;}
  if(amount>(a.payment.paid||0)){showToast(`لا يمكن استرجاع أكثر من المدفوع (${a.payment.paid} ج)`,'danger');return;}
  a.payment.paid=Math.max(0,(a.payment.paid||0)-amount);
  a.payment.amount=Math.max(0,(a.payment.amount||0)-amount);
  DB.set('appointments',apts);
  updateShiftRevenue(-amount, method);
  addLedgerEntry({
    type:'partial_refund', patientId:a.patientId, patientName:a.patientName,
    aptId:a.id, amount:-amount, method,
    note:`استرجاع جزئي مع إكمال الحجز — ${a.serviceName}${reason?' — '+reason:''}`
  });
  addAuditLog('استرجاع جزئي (إكمال الحجز)',`${a.patientName}: ${amount} ج — ${reason||'بدون سبب'}`);
  showToast(`✅ تم استرجاع ${amount} ج وتعديل السعر إلى ${a.payment.amount} ج`);
  closeModal();goTo('today-appointments');
}

/* Option 2: refund the full paid amount and cancel the appointment */
function doFullRefundCancel(aptId){
  const reason=document.getElementById('opt-full-rsn')?.value?.trim()||'إلغاء مع استرداد كامل';
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const amount=a.payment?.paid||0;
  if(amount>0) updateShiftRevenue(-amount, a.payment?.method||'cash');
  // Clear any remaining debt tied to this appointment
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===a.patientId);
  if(p){
    const wasOwed=Math.max(0,(a.payment?.amount||0)-(a.payment?.paid||0));
    p.debt=Math.max(0,(p.debt||0)-wasOwed);
    DB.set('patients',patients);
  }
  a.payment={...a.payment,paid:0,amount:0};
  a.status='cancelled';
  a.refundReason=reason;
  a.refundAmount=amount;
  a.refundConfirmedAt=new Date().toISOString();
  DB.set('appointments',apts);
  if(amount>0){
    addLedgerEntry({
      type:'refund', patientId:a.patientId, patientName:a.patientName,
      aptId:a.id, amount:-amount, method:a.payment?.method||'cash',
      note:`إلغاء + استرداد كامل — ${reason}`
    });
  }
  addAuditLog('إلغاء موعد مع استرداد كامل',`${a.patientName}: ${amount} ج — ${reason}`);
  showToast(`✅ تم إلغاء الحجز${amount>0?' وإرجاع '+amount+' ج':''}`);
  closeModal();goTo('today-appointments');
}

/* Option 3: cancel the appointment without refunding any of the money already paid */
function doCancelNoRefund(aptId){
  if(!confirm('سيتم إلغاء الحجز بدون إرجاع أي مبلغ مدفوع للمريض. هل تريد الاستمرار؟')) return;
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  const paid=a.payment?.paid||0;
  const owed=Math.max(0,(a.payment?.amount||0)-paid);
  if(owed>0){
    const patients=DB.get('patients')||[];
    const p=patients.find(x=>x.id===a.patientId);
    if(p){p.debt=Math.max(0,(p.debt||0)-owed);DB.set('patients',patients);}
  }
  a.payment.amount=paid; // no remaining due — money already paid stays as revenue
  a.status='cancelled';
  a.refundReason='إلغاء بدون استرداد';
  DB.set('appointments',apts);
  addAuditLog('إلغاء موعد بدون استرداد',`${a.patientName}: ${paid} ج (محتفظ بها)`);
  showToast('🚫 تم إلغاء الحجز بدون استرجاع المال');
  closeModal();goTo('today-appointments');
}

/* ============================================================
   ADMIN: ADD/REMOVE SERVICE CHARGES ON A PATIENT'S APPOINTMENT
   ============================================================ */
function openServiceChargesModal(aptId){
  if(currentUser.role!=='admin'){showToast('هذه الميزة متاحة للأدمن فقط','danger');return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  if(!a.extraCharges) a.extraCharges=[];
  showModal(`💲 إدارة أسعار الخدمات — ${a.patientName}`,`
    <div class="payment-summary" style="margin-bottom:1rem">
      <div class="payment-row"><span>الخدمة الأساسية:</span><strong>${a.serviceName}</strong></div>
      <div class="payment-row"><span>السعر الإجمالي الحالي:</span><strong>${a.payment?.amount||0} ج</strong></div>
      <div class="payment-row"><span>المدفوع:</span><strong style="color:#7dff9b">${a.payment?.paid||0} ج</strong></div>
    </div>
    <div style="margin-bottom:.8rem">
      <strong>خدمات / رسوم إضافية على هذا الموعد:</strong>
      ${a.extraCharges.length?a.extraCharges.map(ch=>`
        <div style="display:flex;justify-content:space-between;align-items:center;background:var(--gray-light);border-radius:var(--radius-sm);padding:.5rem .8rem;margin-top:.4rem">
          <span>${ch.name} — <strong>${ch.price} ج</strong></span>
          <button class="btn btn-sm btn-danger" onclick="removeServiceCharge(${aptId},'${ch.id}')">🗑️ حذف</button>
        </div>`).join(''):'<p style="color:var(--text-muted);font-size:.85rem;margin-top:.4rem">لا توجد رسوم إضافية</p>'}
    </div>
    <div class="section-divider">إضافة خدمة / رسم جديد</div>
    <div class="form-grid">
      <div class="form-group"><label>اسم الخدمة / الرسم</label><input id="chg-name" placeholder="مثال: أشعة، تحليل، أدوية..."></div>
      <div class="form-group"><label>السعر</label><input type="number" id="chg-price" min="0" placeholder="0"></div>
    </div>
    <button class="btn btn-sm btn-success" style="margin-top:.6rem" onclick="addServiceCharge(${aptId})">➕ إضافة للحساب</button>
  `,[{label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}]);
}

function addServiceCharge(aptId){
  if(currentUser.role!=='admin'){showToast('هذه الميزة متاحة للأدمن فقط','danger');return;}
  const name=document.getElementById('chg-name')?.value.trim();
  const price=parseFloat(document.getElementById('chg-price')?.value||0);
  if(!name||!price||price<=0){showToast('أدخل اسم وسعر صحيحين','danger');return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  if(!a.extraCharges) a.extraCharges=[];
  const charge={id:Date.now().toString(),name,price,addedAt:new Date().toISOString(),addedBy:currentUser.name};
  a.extraCharges.push(charge);
  a.payment.amount=(a.payment.amount||0)+price;
  DB.set('appointments',apts);
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===a.patientId);
  if(p){p.debt=(p.debt||0)+price;DB.set('patients',patients);}
  addAuditLog('إضافة رسم خدمة',`${a.patientName}: ${name} — ${price} ج`);
  showToast('✅ تم إضافة الرسم للحساب');
  openServiceChargesModal(aptId);
}

function removeServiceCharge(aptId,chargeId){
  if(currentUser.role!=='admin'){showToast('هذه الميزة متاحة للأدمن فقط','danger');return;}
  if(!confirm('هل تريد حذف هذا الرسم من حساب المريض؟')) return;
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a||!a.extraCharges) return;
  const idx=a.extraCharges.findIndex(c=>c.id===chargeId);
  if(idx===-1) return;
  const ch=a.extraCharges[idx];
  a.extraCharges.splice(idx,1);
  const removable=Math.max(0,(a.payment.amount||0)-(a.payment.paid||0)); // unpaid portion that can be removed
  const reduceAmount=Math.min(ch.price,removable);
  a.payment.amount=Math.max(a.payment.paid||0,(a.payment.amount||0)-ch.price);
  DB.set('appointments',apts);
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===a.patientId);
  if(p){p.debt=Math.max(0,(p.debt||0)-reduceAmount);DB.set('patients',patients);}
  addAuditLog('حذف رسم خدمة',`${a.patientName}: ${ch.name} — ${ch.price} ج`);
  showToast('🗑️ تم حذف الرسم من الحساب');
  openServiceChargesModal(aptId);
}

