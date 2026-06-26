/* ============================================================
   RECEPTION — BOOKING
   ============================================================ */
function renderReception(c){
  const docs=(DB.get('users')||[]).filter(u=>u.role==='doctor'||u.role==='admin');
  c.innerHTML=`
  <div style="display:grid;grid-template-columns:1fr 340px;gap:1.2rem">
    <div class="card">
      <div class="card-header"><span class="card-title">🏥 حجز موعد جديد</span></div>
      
      <div class="section-divider">بيانات المريض الأساسية</div>
      <div class="form-group" style="margin-bottom:.9rem">
        <label>الاسم الرباعي الكامل <span class="required-star">*</span></label>
        <input class="required-field" id="r-fullname" placeholder="الاسم الأول الثاني الثالث الرابع" oninput="cleanNameInput(this);receptionSearch()" style="font-size:1rem;padding:.65rem .9rem">
        <span id="r-name-hint" style="font-size:.75rem;color:var(--text-muted)">أدخل الاسم الرباعي مفصولاً بمسافة واحدة بين كل اسم</span>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>رقم الهاتف <span class="required-star">*</span></label>
          <input class="required-field" id="r-phone" type="tel" placeholder="01xxxxxxxxx">
        </div>
        <div class="form-group">
          <label>الجنس <span class="required-star">*</span></label>
          <select class="required-field" id="r-gender">
            <option value="">اختر</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
      </div>

      <!-- AGE SECTION -->
      <div class="form-grid" style="margin-top:.8rem">
        <div class="form-group">
          <label>طريقة تسجيل العمر <span class="required-star">*</span></label>
          <div style="display:flex;gap:.5rem;margin-top:.2rem">
            <label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.85rem">
              <input type="radio" name="age-mode" value="year" checked onchange="toggleAgeMode()"> بالسنة (افتراضي)
            </label>
            <label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.85rem">
              <input type="radio" name="age-mode" value="calendar" onchange="toggleAgeMode()"> تاريخ الميلاد
            </label>
          </div>
        </div>
      </div>
      <div id="age-by-year" class="form-grid" style="margin-top:.5rem">
        <div class="form-group">
          <label>العمر <span class="required-star">*</span></label>
          <div style="display:flex;gap:.5rem">
            <input class="required-field" id="r-age" type="number" placeholder="العمر" style="flex:1" onchange="checkChildAge()">
            <select id="r-age-type" style="width:90px" onchange="checkChildAge()">
              <option value="year">سنة</option>
              <option value="month">شهر</option>
              <option value="day">يوم</option>
            </select>
          </div>
        </div>
      </div>
      <div id="age-by-calendar" class="hidden form-grid" style="margin-top:.5rem">
        <div class="form-group">
          <label>تاريخ الميلاد <span class="required-star">*</span></label>
          <input type="date" id="r-birthdate" max="${today()}" onchange="calcAgeFromCalendar()">
        </div>
        <div class="form-group">
          <label>العمر المحسوب</label>
          <input id="r-age-calc" readonly style="background:var(--gray-light)" placeholder="سيُحسب تلقائياً">
        </div>
      </div>

      <div class="form-grid" style="margin-top:.5rem">
        <div class="form-group">
          <label>مصدر المريض</label>
          <select id="r-source">
            <option>مريض قديم</option><option>إعلان</option><option>سوشيال ميديا</option><option>توصية</option><option>أخرى</option>
          </select>
        </div>
      </div>

      <div id="child-fields" class="hidden">
        <div class="section-divider">⚠️ بيانات الطفل (أقل من 3 سنوات)</div>
        <div class="form-grid">
          <div class="form-group"><label>الوزن (كجم)</label><input id="r-weight" type="number" step=".1" placeholder="الوزن"></div>
          <div class="form-group"><label>محيط الرأس (سم)</label><input id="r-head" type="number" step=".1" placeholder="محيط الرأس"></div>
        </div>
      </div>

      <!-- OPTIONAL EXTRA DATA -->
      <div style="margin-top:.8rem">
        <label class="optional-toggle">
          <input type="checkbox" id="toggle-optional" onchange="document.getElementById('optional-fields').classList.toggle('hidden',!this.checked)">
          ➕ إظهار البيانات الإضافية (ولي الأمر، الشكوى...)
        </label>
      </div>
      <div id="optional-fields" class="hidden" style="margin-top:.5rem">
        <div class="form-grid">
          <div class="form-group"><label>اسم الأم</label><input id="r-mom" placeholder="اسم الأم"></div>
          <div class="form-group"><label>هاتف الأم</label><input id="r-mom-phone" placeholder="هاتف الأم"></div>
          <div class="form-group"><label>اسم الأب</label><input id="r-dad" placeholder="اسم الأب"></div>
          <div class="form-group"><label>هاتف الأب</label><input id="r-dad-phone" placeholder="هاتف الأب"></div>
        </div>
      </div>

      <div class="section-divider">تفاصيل الحجز</div>
      <div class="form-grid">
        <div class="form-group">
          <label>الدكتور <span class="required-star">*</span></label>
          <select class="required-field" id="r-doctor" onchange="loadDoctorServices()">
            <option value="">اختر الدكتور</option>
            ${docs.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>نوع الحجز <span class="required-star">*</span></label>
          <select id="r-booking-type" onchange="toggleBookingType()">
            <option value="service">خدمة منفردة</option>
            <option value="package">اشتراك في باقة</option>
            <option value="both">خدمة + باقة</option>
          </select>
        </div>
        <div class="form-group" id="r-service-group">
          <label>الخدمة <span class="required-star">*</span></label>
          <select id="r-service" onchange="calcPayment()">
            <option value="">اختر الخدمة أولاً</option>
          </select>
        </div>
        <div class="form-group hidden" id="r-package-group">
          <label>الباقة</label>
          <select id="r-package" onchange="calcPayment()">
            <option value="">بدون باقة</option>
          </select>
        </div>
        <div class="form-group">
          <label>تاريخ الموعد <span class="required-star">*</span></label>
          <input class="required-field" type="date" id="r-date" value="${today()}" min="${today()}">
        </div>
        <div class="form-group">
          <label>وقت الموعد</label>
          <input type="time" id="r-time" value="09:00">
        </div>
        <div class="form-group" id="complaint-group">
          <label>الشكوى الرئيسية</label>
          <input id="r-complaint" placeholder="ما يشتكي منه المريض؟">
        </div>
      </div>

      <div class="section-divider">الدفع</div>
      <div id="price-breakdown" style="background:var(--primary-light);border-radius:var(--radius-sm);padding:.8rem;margin-bottom:.8rem;font-size:.88rem"></div>
      <div class="form-grid">
        <div class="form-group">
          <label>طريقة الدفع</label>
          <select id="r-pay-method" onchange="toggleWallet()">
            <option value="cash">نقدي</option>
            <option value="visa">فيزا / كارت</option>
            <option value="wallet">محفظة إلكترونية</option>
          </select>
        </div>
        <div class="form-group hidden" id="wallet-field">
          <label>رقم المحفظة</label>
          <input id="r-wallet-num" placeholder="رقم التحويل">
        </div>
        <div class="form-group">
          <label>المبلغ المدفوع</label>
          <input type="number" id="r-paid" placeholder="0" oninput="calcDebt()">
        </div>
        <div class="form-group">
          <label>إجمالي السعر</label>
          <input type="number" id="r-price" placeholder="0" readonly style="background:var(--gray-light)">
        </div>
      </div>
      <div id="debt-alert" class="hidden"></div>
      <div style="margin-top:1.2rem" class="btn-group">
        <button class="btn btn-primary" onclick="bookAppointment()">✅ تأكيد الحجز</button>
        <button class="btn btn-secondary" onclick="clearReceptionForm()">🔄 مسح</button>
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header"><span class="card-title">🔍 بحث مريض موجود</span></div>
        <input id="r-search" placeholder="ابحث بالاسم أو التليفون..." oninput="receptionSearch()" style="width:100%;padding:.6rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)">
        <div id="search-results" style="margin-top:.7rem;max-height:250px;overflow-y:auto"></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 طابور اليوم</span></div>
        <div id="today-queue-mini"></div>
      </div>
    </div>
  </div>`;
  renderTodayQueueMini();
  loadDoctorServices();
  calcPayment();
}

function cleanNameInput(el){
  // Prevent more than one space between words
  let v=el.value.replace(/  +/g,' ');
  if(v!==el.value){const pos=el.selectionStart-(el.value.length-v.length);el.value=v;el.selectionStart=el.selectionEnd=pos;}
}

function validateFullName(name){
  const parts=name.trim().split(/\s+/).filter(Boolean);
  if(parts.length<4) return 'الاسم يجب أن يكون رباعياً على الأقل (4 كلمات أو أكثر)';
  return null;
}

function toggleAgeMode(){
  const mode=document.querySelector('input[name="age-mode"]:checked').value;
  document.getElementById('age-by-year').classList.toggle('hidden',mode!=='year');
  document.getElementById('age-by-calendar').classList.toggle('hidden',mode!=='calendar');
}

function calcAgeFromCalendar(){
  const bd=document.getElementById('r-birthdate').value;
  if(!bd) return;
  const res=calcAgeFromBirth(bd);
  if(res){
    document.getElementById('r-age-calc').value=`${res.age} ${res.ageType==='year'?'سنة':res.ageType==='month'?'شهر':'يوم'}`;
    document.getElementById('r-age').value=res.age;
    document.getElementById('r-age-type').value=res.ageType;
    checkChildAge();
  }
}

function toggleBookingType(){
  const bt=document.getElementById('r-booking-type').value;
  document.getElementById('r-service-group').classList.toggle('hidden',bt==='package');
  document.getElementById('r-package-group').classList.toggle('hidden',bt==='service');
  calcPayment();
}

function checkChildAge(){
  const age=parseFloat(document.getElementById('r-age')?.value||0);
  const type=document.getElementById('r-age-type')?.value;
  const isChild=(type==='year'&&age<3)||(type==='month')||(type==='day');
  document.getElementById('child-fields')?.classList.toggle('hidden',!isChild);
}

function toggleWallet(){
  const m=document.getElementById('r-pay-method')?.value;
  document.getElementById('wallet-field')?.classList.toggle('hidden',m!=='wallet');
}

function loadDoctorServices(){
  const docId=parseInt(document.getElementById('r-doctor')?.value||0);
  const svcSel=document.getElementById('r-service');
  const pkgSel=document.getElementById('r-package');
  if(!svcSel) return;
  const svcs=(DB.get('services')||[]).filter(s=>s.active&&(s.doctorId===docId||s.doctorId===0));
  const pkgs=(DB.get('packages')||[]).filter(p=>p.active&&p.doctorId===docId);
  svcSel.innerHTML='<option value="">اختر الخدمة</option>'+svcs.map(s=>`<option value="${s.id}" data-price="${s.price}">${s.name} — ${s.price} ج</option>`).join('');
  pkgSel.innerHTML='<option value="">اختر الباقة</option>'+pkgs.map(p=>`<option value="${p.id}" data-price="${p.price}">${p.name} (${p.sessions-p.usedSessions} جلسة متبقية) — ${p.price} ج</option>`).join('');
  calcPayment();
}

function calcPayment(){
  const bt=document.getElementById('r-booking-type')?.value||'service';
  const svcSel=document.getElementById('r-service');
  const pkgSel=document.getElementById('r-package');
  const svcOpt=svcSel?.selectedOptions[0];
  const pkgOpt=pkgSel?.selectedOptions[0];
  const svcPrice=parseFloat(svcOpt?.dataset?.price||0);
  const pkgPrice=parseFloat(pkgOpt?.dataset?.price||0);
  let total=0;
  let breakdown='';
  if(bt==='service'){total=svcPrice;breakdown=svcOpt&&svcPrice?`<strong>الخدمة:</strong> ${svcOpt.text.split('—')[0].trim()} = ${svcPrice} ج`:'اختر خدمة لمعرفة السعر';}
  else if(bt==='package'){total=pkgPrice;breakdown=pkgOpt&&pkgPrice?`<strong>الباقة:</strong> ${pkgOpt.text.split('—')[0].trim()} = ${pkgPrice} ج`:'اختر باقة لمعرفة السعر';}
  else{
    total=svcPrice+pkgPrice;
    breakdown=`${svcPrice?`<strong>الخدمة:</strong> ${svcPrice} ج`:''}${svcPrice&&pkgPrice?' + ':''}${pkgPrice?`<strong>الباقة:</strong> ${pkgPrice} ج`:''}${total?` = <strong>${total} ج</strong>`:''}`;
  }
  const priceInput=document.getElementById('r-price');
  if(priceInput) priceInput.value=total||0;
  const bkEl=document.getElementById('price-breakdown');
  if(bkEl) bkEl.innerHTML=breakdown||'<span style="color:var(--text-muted)">حدد الدكتور والخدمة لعرض السعر</span>';
  calcDebt();
}

function calcDebt(){
  const price=parseFloat(document.getElementById('r-price')?.value||0);
  const paid=parseFloat(document.getElementById('r-paid')?.value||0);
  const diff=price-paid;
  const el=document.getElementById('debt-alert');
  if(!el) return;
  if(price>0&&diff>0&&paid>=0){el.className='alert alert-warning';el.textContent=`⚠️ يتبقى على المريض: ${diff} جنيه`;el.classList.remove('hidden');}
  else if(paid>price&&price>0){el.className='alert alert-success';el.textContent=`✅ باقي يُرد للمريض: ${paid-price} جنيه`;el.classList.remove('hidden');}
  else{el.classList.add('hidden');}
}

function receptionSearch(){
  const q=(document.getElementById('r-search')||document.getElementById('r-fullname'))?.value?.trim()?.toLowerCase();
  if(!q||q.length<2){if(document.getElementById('search-results')) document.getElementById('search-results').innerHTML='';return;}
  const patients=DB.get('patients')||[];
  const found=patients.filter(p=>(p.fullName||'').toLowerCase().includes(q)||p.phone?.includes(q));
  const el=document.getElementById('search-results');
  if(!el) return;
  el.innerHTML=found.slice(0,6).map(p=>`
    <div class="queue-item" onclick="fillPatientData(${p.id})" style="cursor:pointer">
      <div>
        <strong>${p.fullName}</strong>
        ${p.debt>0?`<span class="badge badge-danger" style="margin-right:.4rem">مديون: ${p.debt} ج</span>`:''}
        ${p.credit>0?`<span class="badge badge-success" style="margin-right:.4rem">له: ${p.credit} ج</span>`:''}
      </div>
      <div style="font-size:.78rem;color:var(--text-muted)">${p.phone} • ${p.code}</div>
      ${p.debt>0?`<div style="margin-top:.3rem"><button class="btn btn-sm btn-warning" onclick="event.stopPropagation();openDebtPaymentModal(${p.id})">💰 سداد مديونية</button> <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();fillPatientData(${p.id})">+ حجز جديد</button></div>`:''}
    </div>`).join('')||'<p style="color:var(--text-muted);font-size:.85rem">لا نتائج</p>';
}

function fillPatientData(id){
  const p=(DB.get('patients')||[]).find(x=>x.id===id);
  if(!p) return;
  document.getElementById('r-fullname').value=p.fullName||'';
  document.getElementById('r-phone').value=p.phone;
  document.getElementById('r-age').value=p.age;
  document.getElementById('r-age-type').value=p.ageType||'year';
  if(p.birthDate) document.getElementById('r-birthdate').value=p.birthDate;
  document.getElementById('r-gender').value=p.gender;
  if(document.getElementById('search-results')) document.getElementById('search-results').innerHTML='';
  if(p.debt>0){
    showToast(`⚠️ تنبيه: على هذا المريض مديونية ${p.debt} جنيه`,'warning');
  } else {
    showToast('تم تحميل بيانات المريض');
  }
  window._existingPatientId=id;
  checkChildAge();
}

function bookAppointment(){
  const fullName=document.getElementById('r-fullname').value.trim();
  const nameErr=validateFullName(fullName);
  if(nameErr){showToast('⚠️ '+nameErr,'danger');document.getElementById('r-fullname').focus();return;}

  const phone=document.getElementById('r-phone').value.trim();
  const age=document.getElementById('r-age').value.trim();
  const gender=document.getElementById('r-gender').value;
  const docId=parseInt(document.getElementById('r-doctor').value||0);
  const date=document.getElementById('r-date').value;
  const bt=document.getElementById('r-booking-type').value;
  const svcId=bt!=='package'?parseInt(document.getElementById('r-service').value||0):0;
  const pkgId=bt!=='service'?parseInt(document.getElementById('r-package').value||0):0;

  const missing=[];
  if(!fullName) missing.push('الاسم الرباعي');
  if(!phone) missing.push('رقم الهاتف');
  if(!age) missing.push('العمر');
  if(!gender) missing.push('الجنس');
  if(!docId) missing.push('الدكتور');
  if(!date) missing.push('تاريخ الموعد');
  if(bt==='service'&&!svcId) missing.push('الخدمة');
  if(bt==='package'&&!pkgId) missing.push('الباقة');
  if(bt==='both'&&(!svcId||!pkgId)) missing.push('الخدمة والباقة');

  if(missing.length){showToast('⚠️ الحقول الناقصة: '+missing.join(' — '),'danger');return;}

  const patients=DB.get('patients')||[];
  let patient=window._existingPatientId?patients.find(p=>p.id===window._existingPatientId):null;
  if(!patient){
    // Check for duplicate phone
    const dup=patients.find(p=>p.phone===phone);
    if(dup&&!confirm(`يوجد مريض بنفس التليفون: ${dup.fullName}\nهل تريد المتابعة كمريض جديد؟`)) return;
    const code=DB.nextPatientCode();
    patient={
      id:Date.now(),code,fullName,phone,
      age,ageType:document.getElementById('r-age-type').value,
      birthDate:document.getElementById('r-birthdate')?.value||'',
      gender,
      weight:document.getElementById('r-weight')?.value||'',
      headCirc:document.getElementById('r-head')?.value||'',
      parentMom:document.getElementById('r-mom')?.value||'',momPhone:document.getElementById('r-mom-phone')?.value||'',
      parentDad:document.getElementById('r-dad')?.value||'',dadPhone:document.getElementById('r-dad-phone')?.value||'',
      complaint:document.getElementById('r-complaint')?.value||'',
      source:document.getElementById('r-source').value,
      doctorId:docId,registeredAt:new Date().toISOString(),
      status:'waiting',visits:[],packages:[],balance:0,debt:0,credit:0
    };
    patients.push(patient);
    DB.set('patients',patients);
  }

  const svcs=DB.get('services')||[];
  const svc=svcs.find(s=>s.id===svcId);
  const docs=DB.get('users')||[];
  const doc=docs.find(d=>d.id===docId);
  const apts=DB.get('appointments')||[];
  const todayQ=apts.filter(a=>a.date===date&&a.doctorId===docId).length+1;
  const price=parseFloat(document.getElementById('r-price').value||0);
  const paid=parseFloat(document.getElementById('r-paid').value||0);

  const apt={
    id:DB.nextApptId(),
    patientId:patient.id,patientCode:patient.code,
    patientName:fullName,
    doctorId:docId,doctorName:doc?.name||'',
    serviceId:svcId,serviceName:svc?.name||'',
    packageId:pkgId||null,
    date,time:document.getElementById('r-time').value,
    status:'waiting',arrivedAt:new Date().toISOString(),
    calledAt:null,enteredAt:null,queueNum:todayQ,
    payment:{amount:price,paid,method:document.getElementById('r-pay-method').value,walletNum:document.getElementById('r-wallet-num')?.value||''},
    complaint:document.getElementById('r-complaint')?.value||'',
    registeredBy:currentUser.id,registeredByName:currentUser.name,
    shiftId:getCurrentShiftId()
  };

  // Update debt / credit on patient
  if(price>paid){
    patient.debt=(patient.debt||0)+(price-paid);
    const pi=patients.findIndex(x=>x.id===patient.id);
    if(pi>=0){patients[pi]=patient;DB.set('patients',patients);}
  } else if(paid>price){
    patient.credit=(patient.credit||0)+(paid-price);
    const pi=patients.findIndex(x=>x.id===patient.id);
    if(pi>=0){patients[pi]=patient;DB.set('patients',patients);}
  }

  if(paid>0) updateShiftRevenue(paid,document.getElementById('r-pay-method').value);
  apts.push(apt);
  DB.set('appointments',apts);
  // Log to ledger
  if(paid>0){
    addLedgerEntry({
      type: pkgId ? 'package_payment' : 'payment',
      patientId: patient.id, patientName: fullName,
      aptId: apt.id, amount: paid,
      method: document.getElementById('r-pay-method').value,
      note: `${svc?.name||'باقة'} — حجز جديد`
    });
  }
  if(price>paid && price>0){
    addLedgerEntry({
      type:'partial_payment',
      patientId:patient.id, patientName:fullName,
      aptId:apt.id, amount:0,
      method:document.getElementById('r-pay-method').value,
      note:`مديونية ${price-paid} ج من ${svc?.name||''}`
    });
  }
  addAuditLog('حجز موعد',`مريض: ${apt.patientName} | دكتور: ${apt.doctorName} | خدمة: ${apt.serviceName}`);
  showToast(`✅ تم حجز المريض رقم ${todayQ} في الطابور`);
  clearReceptionForm();
  renderTodayQueueMini();
}

function clearReceptionForm(){
  window._existingPatientId=null;
  ['r-fullname','r-phone','r-age','r-complaint','r-paid','r-price','r-weight','r-head','r-mom','r-mom-phone','r-dad','r-dad-phone','r-birthdate','r-age-calc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['r-gender','r-source','r-doctor','r-service','r-package','r-pay-method','r-booking-type'].forEach(id=>{const el=document.getElementById(id);if(el)el.selectedIndex=0;});
  document.getElementById('child-fields')?.classList.add('hidden');
  document.getElementById('debt-alert')?.classList.add('hidden');
  document.getElementById('optional-fields')?.classList.add('hidden');
  document.getElementById('toggle-optional').checked=false;
  const rb=document.querySelector('input[name="age-mode"][value="year"]');
  if(rb){rb.checked=true;toggleAgeMode();}
  const bd=document.getElementById('price-breakdown');
  if(bd) bd.innerHTML='<span style="color:var(--text-muted)">حدد الدكتور والخدمة لعرض السعر</span>';
}

function renderTodayQueueMini(){
  const el=document.getElementById('today-queue-mini');
  if(!el) return;
  const apts=(DB.get('appointments')||[]).filter(a=>a.date===today()).sort((a,b)=>a.queueNum-b.queueNum);
  el.innerHTML=apts.length?apts.map(a=>`
    <div class="queue-item ${a.status==='called'?'called':a.status==='inside'?'inside':''}">
      <div class="queue-num">${a.queueNum}</div>
      <div class="queue-info">
        <div class="queue-name">${a.patientName}</div>
        <div class="queue-meta">${a.doctorName}</div>
      </div>
      <span class="badge ${statusBadge(a.status)}">${statusLabel(a.status)}</span>
    </div>`).join(''):'<p style="color:var(--text-muted);text-align:center;padding:1rem">لا مواعيد اليوم</p>';
}

