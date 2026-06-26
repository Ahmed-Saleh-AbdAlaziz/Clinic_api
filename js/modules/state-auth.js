/* ============================================================
   STATE
   ============================================================ */
let currentUser = null;
let currentView = '';
let queueRefreshInterval = null;
let chatOpen = false;
let activeChatUser = null;

/* ============================================================
   LANGUAGE / I18N
   ============================================================ */
let currentLang = localStorage.getItem('clinic_lang') || 'ar';

const LANG = {
  ar: {
    logout:'خروج', patients:'المرضى', appointments:'المواعيد', payments:'المدفوعات',
    expenses:'المصاريف', settings:'الإعدادات', dashboard:'لوحة التحكم',
    reception:'حجز المواعيد', search:'البحث عن مريض', shiftReport:'تقرير الشفت',
    doctorQueue:'قائمة المرضى', examination:'فحص المريض', myServices:'خدماتي وباقاتي',
    myPatients:'مرضاي', myStats:'إحصائياتي', allPatients:'جميع المرضى',
    financeReport:'التقارير المالية', doctorComm:'نسب الأطباء', auditLog:'سجل العمليات',
    usersManage:'إدارة المستخدمين', servicesManage:'الخدمات', packagesManage:'الباقات',
    clinicSettings:'إعدادات العيادة', todayAppointments:'مواعيد اليوم',
    dir:'rtl', htmlLang:'ar'
  },
  en: {
    logout:'Logout', patients:'Patients', appointments:'Appointments', payments:'Payments',
    expenses:'Expenses', settings:'Settings', dashboard:'Dashboard',
    reception:'New Booking', search:'Patient Search', shiftReport:'Shift Report',
    doctorQueue:'Patient Queue', examination:'Examination', myServices:'My Services',
    myPatients:'My Patients', myStats:'My Stats', allPatients:'All Patients',
    financeReport:'Finance Report', doctorComm:'Doctor Commissions', auditLog:'Audit Log',
    usersManage:'User Management', servicesManage:'Services', packagesManage:'Packages',
    clinicSettings:'Clinic Settings', todayAppointments:"Today's Appointments",
    inactivePatients:'Inactive Patients',
    dir:'ltr', htmlLang:'en',
    // Extended UI keys
    waiting:'Waiting', called:'Called', inside:'Inside', done:'Done', cancelled:'Cancelled',
    cash:'Cash', visa:'Visa/Card', wallet:'E-Wallet',
    male:'Male', female:'Female',
    save:'Save', cancel:'Cancel', close:'Close', edit:'Edit', delete:'Delete',
    add:'Add', search2:'Search', print:'Print', export:'Export',
    confirmBooking:'Confirm Booking', clearForm:'Clear',
    todayRevenue:"Today's Revenue", totalPatients:'Total Patients',
    todayAppointmentsLbl:"Today's Appointments", examined:'Examined',
    patientName:'Patient Name', doctorName:'Doctor', service:'Service',
    date:'Date', time:'Time', status:'Status', paid:'Paid', remaining:'Remaining',
    method:'Method', actions:'Actions', code:'Code', phone:'Phone',
    age:'Age', source:'Source', registered:'Registered', debt:'Debt',
    totalRevenue:'Total Revenue', todayRevenueLbl:"Today's Revenue",
    totalExpenses:'Total Expenses', netProfit:'Net Profit',
    shiftDate:'Date', staff:'Staff', startTime:'Start', endTime:'End',
    total:'Total', open:'Open', closed:'Closed',
    name:'Name', username:'Username', role:'Role', specialty:'Specialty',
    commission:'Commission %', active:'Active', stopped:'Stopped',
    activate:'Activate', deactivate:'Deactivate',
    year:'year', month:'month', day:'day',
    package:'Package', session:'session', sessions:'sessions',
    myCommission:'My Commission', totalVisits:'Total Visits', todayPatients:"Today's Patients",
    last10:'Last 10 Patients', diagnosis:'Diagnosis', treatment:'Treatment Plan',
    complaint:'Complaint', examResults:'Exam Results', followup:'Follow-up Date',
    secNote:'Note for Secretary', finishExam:'Finish Exam', returnQueue:'Return to Queue',
    cancelRefund:'Cancel & Refund',
    sendMessage:'Send', internalMessages:'Internal Messages', chooseUser:'Select user...',
    backupTitle:'Backup & Data Safety', exportBackup:'Export Full Backup',
    importBackup:'Import Backup', dangerZone:'Danger Zone', deleteAll:'Delete All Data',
    clinicName:'Clinic Name', colorTheme:'Color & Theme',
    inactiveReport:'Inactive Patients Report', inactiveDays:'Inactive since (days)',
    filterByDoctor:'Filter by Doctor', searchBtn:'Search',
    lastVisit:'Last Visit', lastDoctor:'Last Doctor', lastService:'Last Service',
    debtPayment:'Pay Debt', preVisitRefund:'Refund (Patient Changed Mind)',
    confirmRefund:'Confirm Refund', refundReason:'Refund Reason',
    refundAmount:'Refunded Amount',
  }
};

function t(key){ return (LANG[currentLang]||LANG.ar)[key]||key; }

function toggleLang(){
  currentLang = currentLang==='ar'?'en':'ar';
  localStorage.setItem('clinic_lang', currentLang);
  applyLang();
  buildSidebar();
  renderView(currentView);
}

function applyLang(){
  const isEn=currentLang==='en';
  document.documentElement.lang = t('htmlLang');
  document.documentElement.dir = t('dir');
  document.body.style.fontFamily = isEn?"'Segoe UI',Arial,sans-serif":"'Segoe UI',Tahoma,Arial,sans-serif";
  const btn=document.getElementById('lang-btn');
  if(btn) btn.textContent=isEn?'عر':'EN';
  const logoutBtn=document.getElementById('logout-btn');
  if(logoutBtn) logoutBtn.textContent=t('logout');
}

/* Helper: translate common labels in English mode */
function tUI(arText, enText){ return currentLang==='en'?enText:arText; }

/* Status labels — translated */
function statusLabel(s){
  const ar={waiting:'انتظار',called:'نودي عليه',inside:'داخل',done:'انتهى',cancelled:'ملغي'};
  const en={waiting:'Waiting',called:'Called',inside:'Inside',done:'Done',cancelled:'Cancelled'};
  return (currentLang==='en'?en:ar)[s]||s;
}
function payMethodLabel(m){
  const ar={cash:'نقدي',visa:'فيزا',wallet:'محفظة'};
  const en={cash:'Cash',visa:'Visa/Card',wallet:'E-Wallet'};
  return (currentLang==='en'?en:ar)[m]||m||'—';
}
function roleLabel(r){
  if(currentLang==='en') return r==='admin'?'Admin':r==='doctor'?'Doctor':'Secretary';
  return r==='admin'?'أدمن':r==='doctor'?'دكتور':'سكرتاريا';
}

/* ============================================================
   AUTO-BACKUP ON BROWSER CLOSE
   ============================================================ */
function setupAutoBackup(){
  window.addEventListener('beforeunload', function(e){
    try{
      const keys=['users','patients','appointments','services','packages','shifts','expenses','patientCounter','appointmentCounter','clinicName','clinicTheme','clinicLogo','messages','auditLog','pendingRefunds','ledger'];
      const data={_backupDate:new Date().toISOString(),_version:'v5',_autoBackup:true};
      keys.forEach(k=>{data[k]=DB.get(k);});
      // Save to localStorage as a rolling auto-backup (keeps last 3)
      const backups=JSON.parse(localStorage.getItem('clinic_auto_backups')||'[]');
      backups.push({ts:Date.now(),data:JSON.stringify(data)});
      // Keep last 3 auto-backups
      if(backups.length>3) backups.shift();
      localStorage.setItem('clinic_auto_backups',JSON.stringify(backups));
    }catch(err){/* silent */}
  });
}

/* Restore from auto-backup */
function showAutoBackupRestore(){
  const backups=JSON.parse(localStorage.getItem('clinic_auto_backups')||'[]');
  if(!backups.length){showToast('لا توجد نسخ احتياطية تلقائية محفوظة','warning');return;}
  const body=backups.slice().reverse().map((b,i)=>{
    const d=new Date(b.ts);
    const info=JSON.parse(b.data||'{}');
    const pts=(info.patients||[]).length;
    const apts=(info.appointments||[]).length;
    return `<div style="background:var(--gray-light);padding:.8rem;border-radius:var(--radius-sm);margin-bottom:.5rem;display:flex;justify-content:space-between;align-items:center">
      <div>
        <strong>${d.toLocaleString('ar-EG')}</strong>
        <div style="font-size:.8rem;color:var(--text-muted)">${pts} مريض • ${apts} موعد</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="restoreAutoBackup(${backups.length-1-i})">استرداد</button>
    </div>`;
  }).join('');
  showModal('🔄 استرداد من نسخة تلقائية',body,[{label:'إغلاق',class:'btn-secondary',onclick:'closeModal()'}]);
}

function restoreAutoBackup(idx){
  const backups=JSON.parse(localStorage.getItem('clinic_auto_backups')||'[]');
  const b=backups[idx];
  if(!b){showToast('النسخة غير موجودة','danger');return;}
  if(!confirm('سيتم استبدال البيانات الحالية بهذه النسخة. هل تريد المتابعة؟')) return;
  const d=JSON.parse(b.data||'{}');
  Object.entries(d).forEach(([k,v])=>{if(!k.startsWith('_')) DB.set(k,v);});
  showToast('✅ تم الاسترداد من النسخة التلقائية');
  closeModal();
  setTimeout(()=>location.reload(),1000);
}

/* ============================================================
   AUTH
   ============================================================ */
async function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value.trim();
  const remember=document.getElementById('remember-me').checked;
  let user = null;
  try {
    const r = await apiCall('login', {username: u, password: p});
    if (!r || !r.ok) { showToast('بيانات الدخول غير صحيحة','danger'); return; }
    user = r.user;
    if (r.permissions) window._userPermissions = r.permissions;
  } catch(e) { showToast('⛔ لا يوجد اتصال بالسيرفر','danger'); return; }
  if(!user){showToast('بيانات الدخول غير صحيحة','danger');return;}
  // remember-me: localStorage مقبول هنا لأنه بيانات الدخول بس مش داتا العيادة
  if(remember){localStorage.setItem('clinic_saved_user',u);localStorage.setItem('clinic_saved_pass',p);}
  else{localStorage.removeItem('clinic_saved_user');localStorage.removeItem('clinic_saved_pass');}
  currentUser=user;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('current-user-name').textContent=user.name;
  document.getElementById('current-role-badge').textContent=roleLabel(user.role);
  applyTheme(DB.get('clinicTheme')||'green');
  applyLang();
  buildSidebar();
  if(user.role==='secretary') openShiftIfNeeded();
  startClock();
  startQueueLiveRefresh();
  startMessagePoll();
  // MySQL sync: pull latest data from server then start background sync
  pullFromServer().then(()=>{
    goTo(defaultView());
    startServerAutoBackup(); // ابدأ الباكب التلقائي بعد تحميل الإعدادات
  });
  startSyncLoop();
  // Load clinic logo in topbar
  const logo=DB.get('clinicLogo');
  const logoSpan=document.getElementById('topbar-logo-img');
  if(logo&&logoSpan){
    logoSpan.innerHTML=`<img src="${logo}" style="height:34px;border-radius:5px;margin-left:.4rem;margin-right:.4rem;vertical-align:middle">`;
    document.getElementById('clinic-name-top').previousSibling && 
      document.querySelector('.topbar-brand')?.childNodes?.forEach(n=>{if(n.nodeType===3&&n.textContent.includes('🏥'))n.textContent='';});
  }
}

function loadSavedCredentials(){
  const u=localStorage.getItem('clinic_saved_user');
  const p=localStorage.getItem('clinic_saved_pass');
  if(u&&p){
    document.getElementById('login-user').value=u;
    document.getElementById('login-pass').value=p;
    document.getElementById('remember-me').checked=true;
  }
  // Load clinic name/logo on login screen
  const cname=DB.get('clinicName');
  if(cname) document.getElementById('login-clinic-name').textContent=cname;
  const logo=DB.get('clinicLogo');
  if(logo) document.getElementById('login-logo-img').innerHTML=`<img src="${logo}" style="max-height:70px;border-radius:8px;margin-bottom:.5rem">`;
}

function logout(){
  if(currentUser?.role==='secretary') endShiftPrompt();
  else{currentUser=null;if(queueRefreshInterval)clearInterval(queueRefreshInterval);location.reload();}
}

function defaultView(){
  if(currentUser.role==='admin') return 'dashboard';
  if(currentUser.role==='doctor') return 'doctor-queue';
  return 'reception';
}

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(theme){
  document.body.className='';
  if(theme&&theme!=='green') document.body.classList.add('theme-'+theme);
}

/* ============================================================
   LIVE QUEUE REFRESH
   ============================================================ */
function startQueueLiveRefresh(){
  if(queueRefreshInterval) clearInterval(queueRefreshInterval);
  queueRefreshInterval=setInterval(()=>{
    if(currentView==='doctor-queue') renderView('doctor-queue');
    if(currentView==='today-appointments') renderView('today-appointments');
    if(currentView==='dashboard') renderView('dashboard');
  },5000);
}

