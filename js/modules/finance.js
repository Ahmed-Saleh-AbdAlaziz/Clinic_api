/* ============================================================
   DOCTOR COMMISSION REPORT
   ============================================================ */
function renderDoctorCommission(c){
  const apts=(DB.get('appointments')||[]).filter(a=>a.status==='done');
  const users=DB.get('users')||[];
  const doctors=users.filter(u=>u.role==='doctor');
  c.innerHTML=`
  <div class="card">
    <div class="card-header"><span class="card-title">💎 نسب الأطباء</span>
    <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨️ طباعة</button>
    </div>
    ${doctors.map(doc=>{
      const docApts=apts.filter(a=>a.doctorId===doc.id);
      const totalPaid=docApts.reduce((s,a)=>s+(a.payment?.paid||0),0);
      const totalComm=docApts.reduce((s,a)=>s+(a.doctorCommission||0),0);
      return `
      <div style="margin-bottom:1.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
          <h3 style="color:var(--primary)">${doc.name} — نسبة ${doc.commission||0}%</h3>
          <span class="badge badge-info">${docApts.length} حالة</span>
        </div>
        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);gap:.7rem">
          <div class="stat-card"><div class="stat-num" style="font-size:1.3rem">${totalPaid.toLocaleString()} ج</div><div class="stat-label">إجمالي الإيرادات</div></div>
          <div class="stat-card orange"><div class="stat-num" style="font-size:1.3rem;color:#e67e22">${totalComm.toLocaleString()} ج</div><div class="stat-label">إجمالي النسبة</div></div>
          <div class="stat-card green"><div class="stat-num" style="font-size:1.3rem;color:#27ae60">${(totalPaid-totalComm).toLocaleString()} ج</div><div class="stat-label">صافي العيادة</div></div>
        </div>
        <div class="table-wrap" style="margin-top:.5rem"><table>
          <tr><th>التاريخ</th><th>المريض</th><th>الخدمة</th><th>المدفوع</th><th>النسبة (${doc.commission||0}%)</th></tr>
          ${docApts.slice(-20).reverse().map(a=>`
          <tr>
            <td>${a.date}</td><td>${a.patientName}</td><td>${a.serviceName}</td>
            <td>${a.payment?.paid||0} ج</td>
            <td style="color:#e67e22;font-weight:600">${a.doctorCommission||0} ج</td>
          </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا بيانات</td></tr>'}
        </table></div>
      </div>`;
    }).join('')||'<p style="color:var(--text-muted)">لا أطباء</p>'}
  </div>`;
}

/* ============================================================
   EXPENSES
   ============================================================ */
function renderExpenses(c){
  const expenses=DB.get('expenses')||[];
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">🧾 المصاريف</span>
      <button class="btn btn-sm btn-primary" onclick="addExpenseModal()">+ إضافة مصروف</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>التاريخ</th><th>البند</th><th>المكان</th><th>المبلغ</th><th>أضيف بواسطة</th></tr>
      ${expenses.slice(-50).reverse().map(e=>`
      <tr>
        <td>${e.date}</td><td>${e.name}</td>
        <td>${e.location||'—'}</td>
        <td style="color:var(--danger)">${e.amount} ج</td>
        <td>${e.addedBy}</td>
      </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا مصاريف</td></tr>'}
    </table></div>
  </div>`;
}

function addExpenseModal(){
  showModal('إضافة مصروف',`
    <div class="form-grid">
      <div class="form-group"><label>البند</label><input id="exp-name" placeholder="وصف المصروف"></div>
      <div class="form-group"><label>المكان / المورّد</label><input id="exp-location" placeholder="مثال: صيدلية النيل، مستودع ..."></div>
      <div class="form-group"><label>المبلغ (ج)</label><input type="number" id="exp-amount" placeholder="0"></div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:'saveExpense()'},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function saveExpense(){
  const name=document.getElementById('exp-name')?.value.trim();
  const location=document.getElementById('exp-location')?.value.trim()||'';
  const amount=parseFloat(document.getElementById('exp-amount')?.value||0);
  if(!name||!amount) return;
  const expenses=DB.get('expenses')||[];
  expenses.push({id:Date.now(),name,location,amount,date:today(),addedBy:currentUser.name});
  DB.set('expenses',expenses);
  addLedgerEntry({
    type:'expense', patientId:null, patientName:'—',
    aptId:null, amount:-amount, method:'cash',
    note:`${name}${location?' — '+location:''}`
  });
  closeModal();showToast('تم إضافة المصروف');goTo('expenses');
}

/* ============================================================
   USERS MANAGE
   ============================================================ */
function renderUsersManage(c){
  const users=DB.get('users')||[];
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">👤 إدارة المستخدمين</span>
      <button class="btn btn-sm btn-primary" onclick="addUserModal()">+ مستخدم جديد</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>التخصص</th><th>النسبة %</th><th>الحالة</th><th>إجراءات</th></tr>
      ${users.map(u=>`
      <tr>
        <td>${u.name}</td><td>${u.username}</td>
        <td><span class="badge badge-info">${roleLabel(u.role)}</span></td>
        <td>${u.specialty||'—'}</td>
        <td>${u.role==='doctor'?(u.commission||0)+'%':'—'}</td>
        <td><span class="badge ${u.active?'badge-success':'badge-danger'}">${u.active?'نشط':'موقف'}</span></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-secondary" onclick="editUserModal(${u.id})">تعديل</button>
            <button class="btn btn-sm ${u.active?'btn-danger':'btn-success'}" onclick="toggleUser(${u.id})">${u.active?'إيقاف':'تفعيل'}</button>
          </div>
        </td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

function addUserModal(){
  showModal('إضافة مستخدم جديد',`
    <div class="form-grid">
      <div class="form-group"><label>الاسم الكامل</label><input id="u-name"></div>
      <div class="form-group"><label>اسم المستخدم</label><input id="u-username"></div>
      <div class="form-group"><label>كلمة المرور</label><input type="password" id="u-pass"></div>
      <div class="form-group"><label>الدور</label>
        <select id="u-role" onchange="toggleCommissionField()">
          <option value="secretary">سكرتاريا</option>
          <option value="doctor">دكتور</option>
          <option value="admin">أدمن</option>
        </select>
      </div>
      <div class="form-group"><label>التخصص</label><input id="u-specialty" placeholder="مثال: أطفال، عام..."></div>
      <div class="form-group" id="u-commission-group" style="display:none">
        <label>نسبة الدكتور %</label>
        <input type="number" id="u-commission" placeholder="0" min="0" max="100">
      </div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:'saveUser()'},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function toggleCommissionField(){
  const role=document.getElementById('u-role')?.value;
  const cg=document.getElementById('u-commission-group');
  if(cg) cg.style.display=role==='doctor'?'flex':'none';
}

function saveUser(){
  const name=document.getElementById('u-name')?.value.trim();
  const username=document.getElementById('u-username')?.value.trim();
  const pass=document.getElementById('u-pass')?.value.trim();
  const role=document.getElementById('u-role')?.value;
  const specialty=document.getElementById('u-specialty')?.value.trim();
  const commission=parseFloat(document.getElementById('u-commission')?.value||0);
  if(!name||!username||!pass){showToast('⚠️ الحقول الناقصة: الاسم، المستخدم، كلمة المرور','danger');return;}
  const users=DB.get('users')||[];
  if(users.find(u=>u.username===username)){showToast('اسم المستخدم موجود بالفعل','danger');return;}
  users.push({id:Date.now(),name,username,password:pass,role,specialty,commission,active:true,settings:{maxDebtVisits:3}});
  DB.set('users',users);closeModal();showToast('تم إضافة المستخدم');goTo('users-manage');
}

function editUserModal(id){
  const users=DB.get('users')||[];
  const u=users.find(x=>x.id===id);
  if(!u) return;
  showModal('تعديل المستخدم',`
    <div class="form-grid">
      <div class="form-group"><label>الاسم الكامل</label><input id="eu-name" value="${u.name}"></div>
      <div class="form-group"><label>كلمة المرور الجديدة</label><input type="password" id="eu-pass" placeholder="اتركها فارغة إذا لم تريد تغييرها"></div>
      <div class="form-group"><label>التخصص</label><input id="eu-specialty" value="${u.specialty||''}"></div>
      ${u.role==='doctor'?`<div class="form-group"><label>نسبة الدكتور %</label><input type="number" id="eu-commission" value="${u.commission||0}"></div>`:''}
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:`updateUser(${id})`},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function updateUser(id){
  const users=DB.get('users')||[];
  const u=users.find(x=>x.id===id);
  if(!u) return;
  u.name=document.getElementById('eu-name')?.value.trim()||u.name;
  const np=document.getElementById('eu-pass')?.value.trim();
  if(np) u.password=np;
  u.specialty=document.getElementById('eu-specialty')?.value.trim()||u.specialty;
  const uc=document.getElementById('eu-commission');
  if(uc) u.commission=parseFloat(uc.value||0);
  DB.set('users',users);closeModal();showToast('تم تعديل المستخدم');goTo('users-manage');
}

function toggleUser(id){
  const users=DB.get('users')||[];
  const u=users.find(x=>x.id===id);
  if(!u) return;
  u.active=!u.active;DB.set('users',users);showToast(`تم ${u.active?'تفعيل':'إيقاف'} المستخدم`);goTo('users-manage');
}

