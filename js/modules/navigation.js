/* ============================================================
   SIDEBAR NAV
   ============================================================ */
function buildSidebar(){
  const r=currentUser.role;
  const L=LANG[currentLang]||LANG.ar;
  const isAr=currentLang==='ar';
  const items=r==='admin'?[
    {sec:isAr?'الرئيسية':'Main'},
    {id:'dashboard',icon:'📊',label:L.dashboard},
    {id:'all-patients',icon:'👥',label:L.allPatients},
    {sec:isAr?'المالية':'Finance'},
    {id:'finance-report',icon:'💰',label:L.financeReport},
    {id:'vault',icon:'🏦',label:isAr?'الخزنة الموحدة':'Unified Vault'},
    {id:'doctor-commission',icon:'💎',label:L.doctorComm},
    {id:'expenses',icon:'🧾',label:L.expenses},
    {sec:isAr?'الإعدادات':'Settings'},
    {id:'users-manage',icon:'👤',label:L.usersManage},
    {id:'services-manage',icon:'🔧',label:L.servicesManage},
    {id:'packages-manage',icon:'📦',label:L.packagesManage},
    {id:'clinic-settings',icon:'⚙️',label:L.clinicSettings},
    {id:'audit-log',icon:'📋',label:L.auditLog},
    {id:'inactive-patients',icon:'😴',label:L.inactivePatients||'تقرير المنقطعين'},
    {id:'health-dashboard',icon:'🖥️',label:'لوحة صحة النظام'},
  ]:r==='doctor'?[
    {sec:isAr?'الطوابير':'Queue'},
    {id:'doctor-queue',icon:'📋',label:L.doctorQueue},
    {id:'doctor-examination',icon:'🩺',label:L.examination},
    {sec:isAr?'إدارتي':'My Panel'},
    {id:'my-services',icon:'🔧',label:L.myServices},
    {id:'my-patients',icon:'👥',label:L.myPatients},
    {id:'my-stats',icon:'📊',label:L.myStats},
  ]:[
    {sec:isAr?'الاستقبال':'Reception'},
    {id:'reception',icon:'🏥',label:L.reception},
    {id:'today-appointments',icon:'📅',label:L.todayAppointments},
    {id:'patient-search',icon:'🔍',label:L.search},
    {sec:isAr?'المالية':'Finance'},
    {id:'shift-report',icon:'💵',label:L.shiftReport},
    {id:'payments',icon:'💳',label:L.payments},
    {id:'expenses',icon:'🧾',label:L.expenses},
  ];
  const sb=document.getElementById('sidebar');
  sb.innerHTML=items.map(i=>i.sec?`<div class="nav-section">${i.sec}</div>`:`<div class="nav-item" id="nav-${i.id}" onclick="goTo('${i.id}')">${i.icon} <span>${i.label}</span></div>`).join('');
}

function goTo(view){
  currentView=view;
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
  const nav=document.getElementById('nav-'+view);
  if(nav) nav.classList.add('active');
  renderView(view);
}

/* إعادة رسم الصفحة الحالية — بيستخدمها sync لما السيرفر يرجع */
function renderCurrentPage(){ if(currentView) renderView(currentView); }

/* ============================================================
   RENDER VIEWS
   ============================================================ */
function renderView(v){
  const c=document.getElementById('main-content');
  const views={
    'dashboard': renderDashboard,
    'reception': renderReception,
    'today-appointments': renderTodayAppointments,
    'patient-search': renderPatientSearch,
    'shift-report': renderShiftReport,
    'payments': renderPayments,
    'doctor-queue': renderDoctorQueue,
    'doctor-examination': renderDoctorExam,
    'my-services': renderMyServices,
    'my-patients': renderMyPatients,
    'my-stats': renderMyStats,
    'all-patients': renderAllPatients,
    'finance-report': renderFinanceReport,
    'vault': renderVault,
    'doctor-commission': renderDoctorCommission,
    'expenses': renderExpenses,
    'users-manage': renderUsersManage,
    'services-manage': renderServicesManage,
    'packages-manage': renderPackagesManage,
    'clinic-settings': renderClinicSettings,
    'audit-log': renderAuditLog,
    'inactive-patients': renderInactivePatients,
    'health-dashboard': renderHealthDashboard,
  };
  c.innerHTML='';
  if(views[v]) views[v](c);
  else c.innerHTML=`<div class="card"><p>هذه الصفحة قيد التطوير</p></div>`;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard(c){
  const apts=DB.get('appointments')||[];
  const todayApts=apts.filter(a=>a.date===today());
  const patients=DB.get('patients')||[];
  const todayRevenue=todayApts.reduce((s,a)=>s+(a.payment?.paid||0),0);
  c.innerHTML=`
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-num">${todayApts.length}</div><div class="stat-label">${tUI('مواعيد اليوم',"Today's Appointments")}</div></div>
    <div class="stat-card green"><div class="stat-num green">${todayApts.filter(a=>a.status==='done').length}</div><div class="stat-label">${tUI('تم فحصهم','Examined')}</div></div>
    <div class="stat-card blue"><div class="stat-num" style="color:#2980b9">${patients.length}</div><div class="stat-label">${tUI('إجمالي المرضى','Total Patients')}</div></div>
    <div class="stat-card orange"><div class="stat-num" style="color:#e67e22">${todayRevenue.toLocaleString()} ${tUI('ج','EGP')}</div><div class="stat-label">${tUI('إيرادات اليوم',"Today's Revenue")}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
    <div class="card">
      <div class="card-header"><span class="card-title">${tUI('مواعيد اليوم',"Today's Appointments")}</span></div>
      ${todayApts.length?todayApts.map(a=>`
        <div class="queue-item">
          <div class="queue-num">${a.queueNum}</div>
          <div class="queue-info">
            <div class="queue-name">${a.patientName}</div>
            <div class="queue-meta">${a.doctorName} • ${a.serviceName}</div>
          </div>
          <span class="badge ${statusBadge(a.status)}">${statusLabel(a.status)}</span>
        </div>`).join(''):`<p style="color:var(--text-muted);text-align:center;padding:1rem">${tUI('لا توجد مواعيد اليوم','No appointments today')}</p>`}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">${tUI('تقرير الشفتات اليوم',"Today's Shift Report")}</span></div>
      ${renderShiftsSummaryHTML()}
    </div>
  </div>`;
}

function renderShiftsSummaryHTML(){
  const shifts=DB.get('shifts')||[];
  const todayShifts=shifts.filter(s=>s.date===today());
  if(!todayShifts.length) return '<p style="color:var(--text-muted);text-align:center;padding:1rem">لم تبدأ أي شفتات اليوم</p>';
  return todayShifts.map(s=>`
    <div style="padding:.7rem;background:var(--gray-light);border-radius:var(--radius-sm);margin-bottom:.5rem">
      <strong>${s.secName}</strong> — ${s.startTime}${s.endTime?' → '+s.endTime:'(جاري)'}
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:.3rem">
        كاش: ${s.cash||0} ج | فيزا: ${s.visa||0} ج | محفظة: ${s.wallet||0} ج
      </div>
    </div>`).join('');
}

