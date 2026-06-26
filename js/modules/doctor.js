/* ============================================================
   DOCTOR QUEUE — LIVE
   ============================================================ */
function renderDoctorQueue(c){
  const docId=currentUser.role==='admin'?null:currentUser.id;
  let apts=(DB.get('appointments')||[]).filter(a=>a.date===today()&&(docId===null||a.doctorId===docId)).sort((a,b)=>a.queueNum-b.queueNum);
  const waiting=apts.filter(a=>a.status==='waiting'||a.status==='called');
  const done=apts.filter(a=>a.status==='done');
  c.innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 280px;gap:1.2rem">
    <div>
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card"><div class="stat-num">${apts.length}</div><div class="stat-label">${tUI('إجمالي اليوم','Total Today')}</div></div>
        <div class="stat-card orange"><div class="stat-num" style="color:#e67e22">${waiting.length}</div><div class="stat-label">${tUI('في الانتظار','Waiting')}</div></div>
        <div class="stat-card green"><div class="stat-num" style="color:#27ae60">${done.length}</div><div class="stat-label">${tUI('تم فحصهم','Examined')}</div></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 ${tUI('طابور المرضى','Patient Queue')}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">${tUI('يتحدث تلقائياً كل 5 ثواني','Auto-refreshes every 5 seconds')}</span>
        </div>
        ${apts.map(a=>`
        <div class="queue-item ${a.status==='inside'?'inside':a.status==='called'?'called':''}" onclick="openExamination(${a.id})">
          <div class="queue-num">${a.queueNum}</div>
          <div class="queue-info">
            <div class="queue-name">${a.patientName}</div>
            <div class="queue-meta">${a.serviceName}${a.packageId?' + باقة':''} • ${a.time}</div>
            ${a.complaint?`<div style="font-size:.78rem;color:var(--text-muted)">الشكوى: ${a.complaint}</div>`:''}
          </div>
          <div style="text-align:left">
            <span class="badge ${statusBadge(a.status)}">${statusLabel(a.status)}</span>
            ${a.payment?.amount>a.payment?.paid?`<div class="queue-debt">متبقي: ${a.payment.amount-a.payment.paid} ج</div>`:''}
          </div>
        </div>`).join('')||'<p style="text-align:center;color:var(--text-muted);padding:2rem">لا مرضى اليوم</p>'}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">📊 ملخص</span></div>
      <div>
        ${waiting.length>0?`<div class="alert alert-warning">المريض التالي:<br><strong>${waiting[0]?.patientName}</strong></div>`:''}
        <p style="color:var(--text-muted);font-size:.85rem">انقر على مريض لفتح ملفه والبدء في الفحص</p>
      </div>
    </div>
  </div>`;
}

let currentExamPatient=null;

function openExamination(aptId){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a) return;
  currentExamPatient=aptId;
  a.status='inside';a.enteredAt=new Date().toISOString();
  DB.set('appointments',apts);
  goTo('doctor-examination');
}

/* ============================================================
   DOCTOR EXAMINATION
   ============================================================ */
function renderDoctorExam(c){
  if(!currentExamPatient){c.innerHTML=`<div class="card"><p style="text-align:center;color:var(--text-muted);padding:2rem">اختر مريضاً من الطابور أولاً</p><div style="text-align:center;margin-top:1rem"><button class="btn btn-primary" onclick="goTo('doctor-queue')">← الطابور</button></div></div>`;return;}
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===currentExamPatient);
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===a?.patientId);
  if(!a||!p){c.innerHTML='<div class="card"><p>خطأ في تحميل البيانات</p></div>';return;}
  const prevVisits=apts.filter(x=>x.patientId===p.id&&x.id!==a.id&&x.status==='done').sort((x,y)=>new Date(y.date)-new Date(x.date));
  c.innerHTML=`
  <div class="patient-card-lg" style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;font-size:.9rem">
    <div><strong>المريض:</strong> ${p.fullName}</div>
    <div><strong>الكود:</strong> ${p.code}</div>
    <div><strong>العمر:</strong> ${p.age} ${p.ageType==='year'?'سنة':p.ageType==='month'?'شهر':'يوم'} — ${p.gender==='male'?'ذكر':'أنثى'}</div>
    <div><strong>التليفون:</strong> ${p.phone}</div>
    <div><strong>الخدمة:</strong> ${a.serviceName}${a.packageId?' + باقة':''}</div>
    <div><strong>الشكوى:</strong> ${a.complaint||'—'}</div>
    ${p.debt>0?`<div style="color:var(--danger);font-weight:600;grid-column:1/-1">⚠️ مديونية: ${p.debt} ج</div>`:''}
    ${p.credit>0?`<div style="color:#27ae60;font-weight:600;grid-column:1/-1">💚 رصيد للمريض: ${p.credit} ج</div>`:''}
  </div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.2rem">
    <div>
      <div class="tabs">
        <div class="tab active" onclick="switchTab(this,'exam-main')">الفحص الحالي</div>
        <div class="tab" onclick="switchTab(this,'exam-history')">السجل الطبي (${prevVisits.length})</div>
        ${p.weight||p.headCirc?`<div class="tab" onclick="switchTab(this,'exam-child')">بيانات الطفل</div>`:''}
      </div>
      <div id="exam-main">
        <div class="medical-section">
          <div class="medical-section-title">🩺 الشكوى والأعراض</div>
          <div class="form-group"><label>الشكوى الرئيسية</label><textarea id="ex-complaint" rows="2">${a.complaint||''}</textarea></div>
        </div>
        <div class="medical-section">
          <div class="medical-section-title">🔬 الفحص السريري</div>
          <div class="form-group"><label>نتائج الفحص</label><textarea id="ex-exam" rows="3" placeholder="نتائج الفحص السريري..."></textarea></div>
        </div>
        <div class="medical-section">
          <div class="medical-section-title">📋 التشخيص</div>
          <div class="form-group"><label>التشخيص</label><textarea id="ex-diagnosis" rows="2" placeholder="التشخيص..."></textarea></div>
        </div>
        <div class="medical-section">
          <div class="medical-section-title">💊 خطة العلاج والروشتة</div>
          <div class="form-group"><label>خطة العلاج</label><textarea id="ex-plan" rows="3" placeholder="الأدوية والتعليمات..."></textarea></div>
          <div class="form-grid" style="margin-top:.7rem">
            <div class="form-group"><label>موعد المتابعة</label><input type="date" id="ex-followup" min="${today()}"></div>
            <div class="form-group"><label>ملاحظات للسكرتاريا</label><input id="ex-sec-note" placeholder="ملاحظة للسكرتاريا..."></div>
          </div>
        </div>
        ${p.weight||p.headCirc?`
        <div class="medical-section">
          <div class="medical-section-title">📏 تحديث قياسات الطفل</div>
          <div class="form-grid">
            <div class="form-group"><label>الوزن الحالي (كجم)</label><input type="number" id="ex-weight" step=".1" placeholder="${p.weight||''}"></div>
            <div class="form-group"><label>محيط الرأس (سم)</label><input type="number" id="ex-head" step=".1" placeholder="${p.headCirc||''}"></div>
          </div>
        </div>`:''}
      </div>
      <div id="exam-history" class="hidden">
        ${prevVisits.length?prevVisits.map(v=>`
          <div class="visit-history-item">
            <div style="font-weight:600;margin-bottom:.3rem">${v.date} — ${v.serviceName}</div>
            ${v.medicalData?.complaint?`<div><em>الشكوى:</em> ${v.medicalData.complaint}</div>`:''}
            ${v.medicalData?.diagnosis?`<div><em>التشخيص:</em> ${v.medicalData.diagnosis}</div>`:''}
            ${v.medicalData?.plan?`<div><em>العلاج:</em> ${v.medicalData.plan}</div>`:''}
          </div>`).join(''):'<p style="color:var(--text-muted)">لا زيارات سابقة</p>'}
      </div>
      ${p.weight||p.headCirc?`<div id="exam-child" class="hidden"><div class="medical-section"><div class="medical-section-title">👶 بيانات الطفل</div><p>الوزن: <strong>${p.weight||'—'} كجم</strong></p><p>محيط الرأس: <strong>${p.headCirc||'—'} سم</strong></p></div></div>`:''}
    </div>
    <div>
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><span class="card-title">إجراءات</span></div>
        <div class="btn-group" style="flex-direction:column;gap:.5rem">
          <button class="btn btn-success" style="justify-content:center" onclick="finishExam()">✅ ${tUI('إنهاء الفحص','Finish Exam')}</button>
          <button class="btn btn-secondary" style="justify-content:center" onclick="returnToQueueWithoutFinish()">↩️ ${tUI('إرجاع للطابور','Return to Queue')}</button>
          <button class="btn btn-danger" style="justify-content:center" onclick="cancelExamWithRefund()">❌ ${tUI('إلغاء وإرجاع المال','Cancel & Refund')}</button>
        </div>
      </div>
      ${a.payment?.amount>a.payment?.paid?`
      <div class="alert alert-warning">
        <strong>⚠️ مديونية</strong><br>متبقي: ${a.payment.amount-a.payment.paid} ج
      </div>`:''}
    </div>
  </div>`;
}

function finishExam(){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===currentExamPatient);
  if(!a) return;
  a.status='done';a.doneAt=new Date().toISOString();
  a.medicalData={
    complaint:document.getElementById('ex-complaint')?.value||'',
    exam:document.getElementById('ex-exam')?.value||'',
    diagnosis:document.getElementById('ex-diagnosis')?.value||'',
    plan:document.getElementById('ex-plan')?.value||'',
    followup:document.getElementById('ex-followup')?.value||'',
    secNote:document.getElementById('ex-sec-note')?.value||''
  };
  const wt=document.getElementById('ex-weight')?.value;
  const hd=document.getElementById('ex-head')?.value;
  if(wt||hd){
    const patients=DB.get('patients')||[];
    const p=patients.find(x=>x.id===a.patientId);
    if(p){if(wt)p.weight=wt;if(hd)p.headCirc=hd;DB.set('patients',patients);}
  }
  // Calc doctor commission — uses service-specific commission if set, otherwise doctor default
  const users=DB.get('users')||[];
  const doc=users.find(u=>u.id===a.doctorId);
  if(doc&&a.payment?.paid>0){
    const svcs=DB.get('services')||[];
    const svc=svcs.find(s=>s.id===a.serviceId);
    const commRate=svc?.commission!=null?svc.commission:(doc.commission||0);
    if(commRate>0){
      a.doctorCommission=Math.round(a.payment.paid*(commRate/100));
      a.commissionRate=commRate;
    }
  }
  DB.set('appointments',apts);
  addAuditLog('إنهاء فحص',`${a.patientName} — ${a.serviceName}`);
  showToast('✅ تم إنهاء الفحص بنجاح');
  currentExamPatient=null;
  goTo('doctor-queue');
}

function returnToQueueWithoutFinish(){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===currentExamPatient);
  if(!a) return;
  a.status='waiting';
  DB.set('appointments',apts);
  currentExamPatient=null;
  goTo('doctor-queue');
}

function cancelExamWithRefund(){
  if(!confirm('هل تريد إلغاء الكشف وإرجاع المال للمريض؟')) return;
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===currentExamPatient);
  if(!a) return;
  const refund=a.payment?.paid||0;
  a.status='cancelled';
  a.cancelledWithRefund=true;
  a.refundAmount=refund;
  a.refundPendingAt=new Date().toISOString();
  DB.set('appointments',apts);
  // Notify secretary via internal notification
  const notifs=DB.get('pendingRefunds')||[];
  notifs.push({aptId:a.id,patientName:a.patientName,amount:refund,doctorName:currentUser.name,time:now(),confirmed:false});
  DB.set('pendingRefunds',notifs);
  addAuditLog('إلغاء كشف مع استرداد',`${a.patientName}: ${refund} ج`);
  showToast('تم إرسال طلب الاسترداد للسكرتاريا','warning');
  currentExamPatient=null;
  goTo('doctor-queue');
}

/* Check refund notifications for secretary */
function checkPendingRefunds(){
  if(currentUser?.role!=='secretary') return;
  const notifs=(DB.get('pendingRefunds')||[]).filter(n=>!n.confirmed);
  notifs.forEach(n=>{
    const pid='refund-popup-'+n.aptId;
    // Only show if not already displayed
    if(!document.getElementById(pid)){
      showNotifPopup(
        `💰 طلب استرداد مال\nالمريض: ${n.patientName}\nالمبلغ: ${n.amount} ج\n(طلب من ${n.doctorName} الساعة ${n.time})`,
        ()=>{ confirmRefund(n.aptId); },
        pid
      );
    }
  });
}

function confirmRefund(aptId){
  const apts=DB.get('appointments')||[];
  const a=apts.find(x=>x.id===aptId);
  if(!a){showToast('خطأ: لم يتم العثور على الموعد','danger');return;}
  const refundAmt=a.refundAmount||0;
  if(refundAmt>0){
    updateShiftRevenue(-refundAmt, a.payment?.method||'cash');
  }
  // Fix patient record: clear BOTH debt (unpaid portion) AND service amount (since cancelled)
  const patients=DB.get('patients')||[];
  const p=patients.find(x=>x.id===a.patientId);
  if(p){
    const wasOwed=Math.max(0,(a.payment?.amount||0)-(a.payment?.paid||0));
    p.debt=Math.max(0,(p.debt||0)-wasOwed);
    DB.set('patients',patients);
  }
  // Zero out payment completely — service was cancelled, no amount owed
  a.payment={...a.payment, paid:0, amount:0};
  a.refundConfirmedAt=new Date().toISOString();
  DB.set('appointments',apts);
  const notifs=(DB.get('pendingRefunds')||[]).map(n=>n.aptId===aptId?{...n,confirmed:true}:n);
  DB.set('pendingRefunds',notifs);
  addAuditLog('تأكيد استرداد',`${a.patientName}: ${refundAmt} ج`);
  addLedgerEntry({
    type:'refund', patientId:a.patientId, patientName:a.patientName,
    aptId:a.id, amount:-refundAmt, method:a.payment?.method||'cash',
    note:`إلغاء كشف — استرداد كامل (طلب الدكتور)`
  });
  showToast(`✅ تم تأكيد الاسترداد: ${refundAmt} ج — تم خصمها من الخزنة`);
}

/* ============================================================
   MY SERVICES (DOCTOR)
   ============================================================ */
function renderMyServices(c){
  const svcs=(DB.get('services')||[]).filter(s=>s.doctorId===currentUser.id);
  const pkgs=(DB.get('packages')||[]).filter(p=>p.doctorId===currentUser.id);
  c.innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem">
    <div class="card">
      <div class="card-header">
        <span class="card-title">🔧 الخدمات</span>
        <button class="btn btn-sm btn-primary" onclick="addServiceModal()">+ إضافة</button>
      </div>
      ${svcs.map(s=>`
        <div class="pkg-item">
          <div><strong>${s.name}</strong> — <span style="color:var(--primary)">${s.price} ج</span></div>
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="editServiceModal(${s.id})">تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="deleteService(${s.id})">حذف</button>
          </div>
        </div>`).join('')||'<p style="color:var(--text-muted)">لا خدمات</p>'}
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">📦 الباقات</span>
        <button class="btn btn-sm btn-primary" onclick="addPackageModal()">+ إضافة</button>
      </div>
      ${pkgs.map(p=>`
        <div class="pkg-item">
          <div>
            <strong>${p.name}</strong><br>
            <span style="font-size:.82rem;color:var(--text-muted)">${p.sessions} جلسة — ${p.price} ج (${Math.round(p.price/p.sessions)} ج/جلسة)</span>
          </div>
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="editPackageModal(${p.id})">تعديل</button>
          </div>
        </div>`).join('')||'<p style="color:var(--text-muted)">لا باقات</p>'}
    </div>
  </div>`;
}

function addServiceModal(){
  const users=DB.get('users')||[];
  const doc=users.find(u=>u.id===currentUser.id);
  const defaultComm=doc?.commission||0;
  showModal('إضافة خدمة جديدة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الخدمة</label><input id="svc-name" placeholder="اسم الخدمة"></div>
      <div class="form-group"><label>السعر (ج)</label><input type="number" id="svc-price" placeholder="0"></div>
      <div class="form-group">
        <label>نسبة الدكتور على هذه الخدمة %</label>
        <input type="number" id="svc-commission" placeholder="${defaultComm}" value="${defaultComm}" min="0" max="100">
        <span style="font-size:.75rem;color:var(--text-muted)">اتركها كالافتراضي أو عدّلها لهذه الخدمة تحديداً</span>
      </div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:'saveService()'},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function editServiceModal(id){
  const s=(DB.get('services')||[]).find(x=>x.id===id);
  if(!s) return;
  const users=DB.get('users')||[];
  const doc=users.find(u=>u.id===currentUser.id);
  const defaultComm=s.commission!=null?s.commission:(doc?.commission||0);
  showModal('تعديل الخدمة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الخدمة</label><input id="svc-name" value="${s.name}"></div>
      <div class="form-group"><label>السعر (ج)</label><input type="number" id="svc-price" value="${s.price}"></div>
      <div class="form-group">
        <label>نسبة الدكتور على هذه الخدمة %</label>
        <input type="number" id="svc-commission" value="${defaultComm}" min="0" max="100">
      </div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:`updateService(${id})`},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function saveService(){
  const name=document.getElementById('svc-name')?.value.trim();
  const price=parseFloat(document.getElementById('svc-price')?.value||0);
  const commission=document.getElementById('svc-commission')?.value;
  const users=DB.get('users')||[];
  const doc=users.find(u=>u.id===currentUser.id);
  const commVal=commission!==''?parseFloat(commission):(doc?.commission||0);
  if(!name) return;
  const svcs=DB.get('services')||[];
  svcs.push({id:Date.now(),name,price,doctorId:currentUser.id,active:true,commission:commVal});
  DB.set('services',svcs);closeModal();showToast('تم إضافة الخدمة');goTo('my-services');
}

function updateService(id){
  const name=document.getElementById('svc-name')?.value.trim();
  const price=parseFloat(document.getElementById('svc-price')?.value||0);
  const commVal=parseFloat(document.getElementById('svc-commission')?.value||0);
  if(!name) return;
  const svcs=DB.get('services')||[];
  const s=svcs.find(x=>x.id===id);
  if(s){s.name=name;s.price=price;s.commission=commVal;DB.set('services',svcs);}
  closeModal();showToast('تم تعديل الخدمة');goTo('my-services');
}

function deleteService(id){
  if(!confirm('حذف الخدمة؟')) return;
  DB.set('services',(DB.get('services')||[]).filter(s=>s.id!==id));
  showToast('تم الحذف');goTo('my-services');
}

function addPackageModal(){
  showModal('إضافة باقة جديدة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الباقة</label><input id="pkg-name" placeholder="مثال: باقة 10 جلسات"></div>
      <div class="form-group"><label>عدد الجلسات</label><input type="number" id="pkg-sessions" placeholder="10"></div>
      <div class="form-group"><label>سعر الباقة (ج)</label><input type="number" id="pkg-price" placeholder="0"></div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:'savePackage()'},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function editPackageModal(id){
  const p=(DB.get('packages')||[]).find(x=>x.id===id);
  if(!p) return;
  showModal('تعديل الباقة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الباقة</label><input id="pkg-name" value="${p.name}"></div>
      <div class="form-group"><label>عدد الجلسات</label><input type="number" id="pkg-sessions" value="${p.sessions}"></div>
      <div class="form-group"><label>سعر الباقة (ج)</label><input type="number" id="pkg-price" value="${p.price}"></div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:`updatePackage(${id})`},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function savePackage(){
  const name=document.getElementById('pkg-name')?.value.trim();
  const sessions=parseInt(document.getElementById('pkg-sessions')?.value||0);
  const price=parseFloat(document.getElementById('pkg-price')?.value||0);
  if(!name||!sessions) return;
  const pkgs=DB.get('packages')||[];
  pkgs.push({id:Date.now(),name,sessions,price,usedSessions:0,doctorId:currentUser.id,active:true});
  DB.set('packages',pkgs);closeModal();showToast('تم إضافة الباقة');goTo('my-services');
}

function updatePackage(id){
  const name=document.getElementById('pkg-name')?.value.trim();
  const sessions=parseInt(document.getElementById('pkg-sessions')?.value||0);
  const price=parseFloat(document.getElementById('pkg-price')?.value||0);
  if(!name||!sessions) return;
  const pkgs=DB.get('packages')||[];
  const p=pkgs.find(x=>x.id===id);
  if(p){p.name=name;p.sessions=sessions;p.price=price;DB.set('packages',pkgs);}
  closeModal();showToast('تم تعديل الباقة');goTo('my-services');
}

/* ============================================================
   MY PATIENTS (DOCTOR)
   ============================================================ */
function renderMyPatients(c){
  const docId=currentUser.id;
  const apts=DB.get('appointments')||[];
  const myPatientIds=[...new Set(apts.filter(a=>a.doctorId===docId).map(a=>a.patientId))];
  const patients=(DB.get('patients')||[]).filter(p=>myPatientIds.includes(p.id));
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">👥 مرضاي (${patients.length})</span>
      <input id="mp-search" placeholder="بحث..." style="padding:.4rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)" oninput="filterMyPatients()">
    </div>
    <div id="mp-list">
    <div class="table-wrap"><table>
      <tr><th>الكود</th><th>الاسم</th><th>التليفون</th><th>الزيارات</th><th>آخر زيارة</th><th>إجراءات</th></tr>
      ${patients.map(p=>{
        const pApts=apts.filter(a=>a.patientId===p.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
        return `<tr>
          <td>${p.code}</td>
          <td>${p.fullName}</td>
          <td>${p.phone}</td>
          <td>${pApts.length}</td>
          <td>${pApts[0]?.date||'—'}</td>
          <td><button class="btn btn-sm btn-outline" onclick="showPatientProfile(${p.id})">الملف</button></td>
        </tr>`;
      }).join('')}
    </table></div>
    </div>
  </div>`;
}

function filterMyPatients(){
  const q=document.getElementById('mp-search')?.value.toLowerCase()||'';
  document.querySelectorAll('#mp-list tbody tr').forEach(tr=>{
    tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none';
  });
}

/* ============================================================
   MY STATS (DOCTOR)
   ============================================================ */
function renderMyStats(c){
  const docId=currentUser.id;
  const apts=(DB.get('appointments')||[]).filter(a=>a.doctorId===docId);
  const today_=apts.filter(a=>a.date===today());
  const revenue=apts.reduce((s,a)=>s+(a.payment?.paid||0),0);
  const totalComm=apts.reduce((s,a)=>s+(a.doctorCommission||0),0);
  const users=DB.get('users')||[];
  const doc=users.find(u=>u.id===docId);
  c.innerHTML=`
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-num">${apts.length}</div><div class="stat-label">إجمالي الزيارات</div></div>
    <div class="stat-card green"><div class="stat-num" style="color:#27ae60">${today_.length}</div><div class="stat-label">مرضى اليوم</div></div>
    <div class="stat-card blue"><div class="stat-num" style="color:#2980b9">${revenue.toLocaleString()} ج</div><div class="stat-label">إجمالي الإيرادات</div></div>
    <div class="stat-card orange"><div class="stat-num" style="color:#e67e22">${totalComm.toLocaleString()} ج</div><div class="stat-label">نسبتي (${doc?.commission||0}%)</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">آخر 10 مرضى</span></div>
    <div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>المريض</th><th>الخدمة</th><th>الحالة</th><th>المدفوع</th><th>النسبة</th></tr>
      ${apts.slice(-10).reverse().map(a=>`
      <tr>
        <td>${a.date}</td><td>${a.patientName}</td><td>${a.serviceName}</td>
        <td><span class="badge ${statusBadge(a.status)}">${statusLabel(a.status)}</span></td>
        <td>${a.payment?.paid||0} ج</td>
        <td style="color:#e67e22">${a.doctorCommission?a.doctorCommission+' ج':'—'}</td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

