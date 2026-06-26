/* ============================================================
   SERVICES / PACKAGES MANAGE (ADMIN)
   ============================================================ */
function renderServicesManage(c){
  const svcs=DB.get('services')||[];
  const users=DB.get('users')||[];
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">🔧 إدارة الخدمات</span>
      <button class="btn btn-sm btn-primary" onclick="addServiceAdminModal()">+ إضافة</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>الخدمة</th><th>السعر</th><th>الدكتور</th><th>نسبة الدكتور</th><th>الحالة</th><th>إجراءات</th></tr>
      ${svcs.map(s=>{
        const doc=users.find(u=>u.id===s.doctorId);
        const commDisplay=s.commission!=null?s.commission+'%':(doc?.commission||0)+'% (افتراضي)';
        return `<tr>
          <td>${s.name}</td><td>${s.price} ج</td>
          <td>${doc?.name||'عام'}</td>
          <td>${commDisplay}</td>
          <td><span class="badge ${s.active?'badge-success':'badge-gray'}">${s.active?'نشطة':'موقفة'}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="editServiceAdminModal(${s.id})">تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSvcAdmin(${s.id})">حذف</button>
          </td>
        </tr>`;
      }).join('')}
    </table></div>
  </div>`;
}

function addServiceAdminModal(){
  const docs=(DB.get('users')||[]).filter(u=>u.role==='doctor'||u.role==='admin');
  showModal('إضافة خدمة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الخدمة</label><input id="sa-name"></div>
      <div class="form-group"><label>السعر</label><input type="number" id="sa-price"></div>
      <div class="form-group"><label>الدكتور</label>
        <select id="sa-doc">
          <option value="0">عام (الكل)</option>
          ${docs.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>نسبة الدكتور على هذه الخدمة % (اختياري)</label>
        <input type="number" id="sa-commission" placeholder="اتركه فارغاً لاستخدام النسبة الافتراضية" min="0" max="100">
      </div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:'saveSvcAdmin()'},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function editServiceAdminModal(id){
  const s=(DB.get('services')||[]).find(x=>x.id===id);
  if(!s) return;
  const docs=(DB.get('users')||[]).filter(u=>u.role==='doctor'||u.role==='admin');
  showModal('تعديل خدمة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الخدمة</label><input id="sa-name" value="${s.name}"></div>
      <div class="form-group"><label>السعر</label><input type="number" id="sa-price" value="${s.price}"></div>
      <div class="form-group"><label>الدكتور</label>
        <select id="sa-doc">
          <option value="0" ${s.doctorId===0?'selected':''}>عام (الكل)</option>
          ${docs.map(d=>`<option value="${d.id}" ${s.doctorId===d.id?'selected':''}>${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>نسبة الدكتور على هذه الخدمة %</label>
        <input type="number" id="sa-commission" value="${s.commission!=null?s.commission:''}" placeholder="اتركه فارغاً للنسبة الافتراضية" min="0" max="100">
      </div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:`updateSvcAdmin(${id})`},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function saveSvcAdmin(){
  const name=document.getElementById('sa-name')?.value.trim();
  const price=parseFloat(document.getElementById('sa-price')?.value||0);
  const docId=parseInt(document.getElementById('sa-doc')?.value||0);
  const commRaw=document.getElementById('sa-commission')?.value;
  const commission=commRaw!==''&&commRaw!=null?parseFloat(commRaw):null;
  if(!name) return;
  const svcs=DB.get('services')||[];
  svcs.push({id:Date.now(),name,price,doctorId:docId,active:true,commission});
  DB.set('services',svcs);closeModal();showToast('تمت الإضافة');goTo('services-manage');
}

function updateSvcAdmin(id){
  const name=document.getElementById('sa-name')?.value.trim();
  const price=parseFloat(document.getElementById('sa-price')?.value||0);
  const docId=parseInt(document.getElementById('sa-doc')?.value||0);
  const commRaw=document.getElementById('sa-commission')?.value;
  const commission=commRaw!==''&&commRaw!=null?parseFloat(commRaw):null;
  if(!name) return;
  const svcs=DB.get('services')||[];
  const s=svcs.find(x=>x.id===id);
  if(s){s.name=name;s.price=price;s.doctorId=docId;s.commission=commission;DB.set('services',svcs);}
  closeModal();showToast('تم التعديل');goTo('services-manage');
}

function deleteSvcAdmin(id){
  if(!confirm('حذف الخدمة؟')) return;
  DB.set('services',(DB.get('services')||[]).filter(s=>s.id!==id));
  showToast('تم الحذف');goTo('services-manage');
}

function renderPackagesManage(c){
  const pkgs=DB.get('packages')||[];
  const users=DB.get('users')||[];
  c.innerHTML=`
  <div class="card">
    <div class="card-header">
      <span class="card-title">📦 إدارة الباقات</span>
      <button class="btn btn-sm btn-primary" onclick="addPkgAdminModal()">+ إضافة</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>الباقة</th><th>الجلسات</th><th>السعر</th><th>سعر/جلسة</th><th>الدكتور</th><th>إجراءات</th></tr>
      ${pkgs.map(p=>{
        const doc=users.find(u=>u.id===p.doctorId);
        return `<tr>
          <td>${p.name}</td><td>${p.sessions} جلسة</td>
          <td>${p.price} ج</td><td>${Math.round(p.price/p.sessions)} ج</td>
          <td>${doc?.name||'—'}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="editPkgAdminModal(${p.id})">تعديل</button>
            <button class="btn btn-sm btn-danger" onclick="deletePkgAdmin(${p.id})">حذف</button>
          </td>
        </tr>`;
      }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">لا باقات</td></tr>'}
    </table></div>
  </div>`;
}

function addPkgAdminModal(){
  const docs=(DB.get('users')||[]).filter(u=>u.role==='doctor'||u.role==='admin');
  showModal('إضافة باقة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الباقة</label><input id="pa-name"></div>
      <div class="form-group"><label>عدد الجلسات</label><input type="number" id="pa-sessions"></div>
      <div class="form-group"><label>السعر الكلي</label><input type="number" id="pa-price"></div>
      <div class="form-group"><label>الدكتور</label><select id="pa-doc">${docs.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}</select></div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:'savePkgAdmin()'},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function editPkgAdminModal(id){
  const p=(DB.get('packages')||[]).find(x=>x.id===id);
  if(!p) return;
  const docs=(DB.get('users')||[]).filter(u=>u.role==='doctor'||u.role==='admin');
  showModal('تعديل باقة',`
    <div class="form-grid">
      <div class="form-group"><label>اسم الباقة</label><input id="pa-name" value="${p.name}"></div>
      <div class="form-group"><label>عدد الجلسات</label><input type="number" id="pa-sessions" value="${p.sessions}"></div>
      <div class="form-group"><label>السعر الكلي</label><input type="number" id="pa-price" value="${p.price}"></div>
      <div class="form-group"><label>الدكتور</label><select id="pa-doc">${docs.map(d=>`<option value="${d.id}" ${p.doctorId===d.id?'selected':''}>${d.name}</option>`).join('')}</select></div>
    </div>
  `,[{label:'حفظ',class:'btn-primary',onclick:`updatePkgAdmin(${id})`},{label:'إلغاء',class:'btn-secondary',onclick:'closeModal()'}]);
}

function savePkgAdmin(){
  const name=document.getElementById('pa-name')?.value.trim();
  const sessions=parseInt(document.getElementById('pa-sessions')?.value||0);
  const price=parseFloat(document.getElementById('pa-price')?.value||0);
  const docId=parseInt(document.getElementById('pa-doc')?.value||0);
  if(!name||!sessions) return;
  const pkgs=DB.get('packages')||[];
  pkgs.push({id:Date.now(),name,sessions,price,usedSessions:0,doctorId:docId,active:true});
  DB.set('packages',pkgs);closeModal();showToast('تمت الإضافة');goTo('packages-manage');
}

function updatePkgAdmin(id){
  const name=document.getElementById('pa-name')?.value.trim();
  const sessions=parseInt(document.getElementById('pa-sessions')?.value||0);
  const price=parseFloat(document.getElementById('pa-price')?.value||0);
  const docId=parseInt(document.getElementById('pa-doc')?.value||0);
  if(!name||!sessions) return;
  const pkgs=DB.get('packages')||[];
  const p=pkgs.find(x=>x.id===id);
  if(p){p.name=name;p.sessions=sessions;p.price=price;p.doctorId=docId;DB.set('packages',pkgs);}
  closeModal();showToast('تم التعديل');goTo('packages-manage');
}

function deletePkgAdmin(id){
  if(!confirm('حذف الباقة؟')) return;
  DB.set('packages',(DB.get('packages')||[]).filter(p=>p.id!==id));
  showToast('تم الحذف');goTo('packages-manage');
}

/* ============================================================
   CLINIC SETTINGS
   ============================================================ */
function renderClinicSettings(c){
  const name=DB.get('clinicName')||'عيادة النيل';
  const theme=DB.get('clinicTheme')||'green';
  const logo=DB.get('clinicLogo');
  c.innerHTML=`
  <div class="card">
    <div class="card-header"><span class="card-title">⚙️ إعدادات العيادة</span></div>
    <div class="form-grid">
      <div class="form-group"><label>اسم العيادة</label><input id="set-name" value="${name}"></div>
    </div>

    <div class="section-divider">🎨 اللون والثيم</div>
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:1rem">
      ${[['green','زمردي (الافتراضي)','#2d6a6a'],['blue','أزرق طبي','#2b5fa8'],['purple','بنفسجي','#5c3d8c'],['red','أحمر داكن','#8c2d2d'],['slate','رمادي أردوازي','#3d4f6a'],['dark','داكن','#1a2a2a']].map(([v,l,col])=>`
        <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;padding:.5rem .8rem;border:2px solid ${theme===v?col:'var(--gray-border)'};border-radius:var(--radius-sm)">
          <input type="radio" name="theme-pick" value="${v}" ${theme===v?'checked':''}>
          <span style="width:14px;height:14px;background:${col};border-radius:50%;display:inline-block"></span>
          ${l}
        </label>`).join('')}
    </div>

    <div class="section-divider">🖼️ شعار العيادة</div>
    <div style="margin-bottom:.8rem">
      ${logo?`<img src="${logo}" style="max-height:80px;border-radius:8px;margin-bottom:.5rem;display:block"><button class="btn btn-sm btn-danger" onclick="removeLogo()">حذف الشعار</button>`:'<p style="color:var(--text-muted);font-size:.85rem">لم يُحدد شعار بعد</p>'}
      <br><input type="file" id="logo-file" accept="image/*" onchange="uploadLogo()" style="margin-top:.5rem">
    </div>

    <div style="margin-top:1rem">
      <button class="btn btn-primary" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>

    <div class="section-divider">💾 النسخ الاحتياطي التلقائي على السيرفر</div>
    <div class="alert alert-warning" style="margin-bottom:.8rem">
      <strong>🛡️ الحماية الكاملة:</strong> النسخ الاحتياطية بتتحفظ تلقائياً على السيرفر في مسار تحدده أنت. لو الداتابيز اتمسحت أو اتفيرست نقدر نرجع من أي نسخة.
    </div>
    <div class="form-grid" style="margin-bottom:.8rem">
      <div class="form-group">
        <label>📁 مسار مجلد الباكب على السيرفر</label>
        <input id="set-backup-path" value="${(DB.get('settings')||{}).backupPath||'C:/clinic_backups'}" placeholder="مثال: C:/clinic_backups أو /var/backups/clinic">
        <small style="color:var(--text-muted)">المسار يكون على جهاز السيرفر نفسه</small>
      </div>
      <div class="form-group">
        <label>⏰ مرة كل كم ساعة؟</label>
        <select id="set-backup-interval">
          ${[1,2,4,6,12,24].map(h=>`<option value="${h}" ${((DB.get('settings')||{}).backupIntervalHours||1)==h?'selected':''}>${h} ${h===1?'ساعة':'ساعات'}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:.8rem">
      <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
        <input type="checkbox" id="set-backup-enabled" ${((DB.get('settings')||{}).backupEnabled)?'checked':''}>
        تفعيل النسخ الاحتياطي التلقائي
      </label>
    </div>
    <div id="last-backup-time" style="font-size:.8rem;color:var(--text-muted);margin-bottom:.7rem"></div>
    <div class="btn-group">
      <button class="btn btn-success" onclick="doManualBackup()">💾 نسخة احتياطية الآن</button>
      <button class="btn btn-outline" onclick="listServerBackups()">📂 استعراض النسخ المحفوظة</button>
    </div>

    <div class="section-divider" style="margin-top:1.5rem;color:var(--danger)">⛔ منطقة الخطر</div>
    <button class="btn btn-danger" onclick="resetDB()">⚠️ مسح جميع البيانات</button>
  </div>`;
  // Show storage usage
  setTimeout(()=>{
    const el=document.getElementById('storage-usage');
    if(!el) return;
    try{
      let total=0;
      for(let k in localStorage){ if(k.startsWith('clinic_')) total+=localStorage[k].length; }
      const kb=Math.round(total/1024);
      const pct=Math.round(total/(5*1024*1024)*100);
      el.innerHTML=`📊 مساحة مستخدمة: <strong>${kb} KB</strong> من 5120 KB (${pct}%) ${pct>80?'<span style="color:var(--danger)">⚠️ قرب الامتلاء! صدّر نسخة احتياطية الآن</span>':''}`;
    }catch(e){}
  },100);
}

function uploadLogo(){
  const file=document.getElementById('logo-file')?.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    DB.set('clinicLogo',e.target.result);
    showToast('تم رفع الشعار');
    goTo('clinic-settings');
  };
  reader.readAsDataURL(file);
}

function removeLogo(){
  DB.set('clinicLogo',null);showToast('تم حذف الشعار');goTo('clinic-settings');
}

function saveSettings(){
  const name=document.getElementById('set-name')?.value.trim();
  const theme=document.querySelector('input[name="theme-pick"]:checked')?.value||'green';
  const backupPath=document.getElementById('set-backup-path')?.value.trim();
  const backupInterval=parseInt(document.getElementById('set-backup-interval')?.value||'1');
  const backupEnabled=document.getElementById('set-backup-enabled')?.checked||false;
  if(name){DB.set('clinicName',name);document.getElementById('clinic-name-top').textContent=name;}
  DB.set('clinicTheme',theme);
  applyTheme(theme);
  // حفظ إعدادات الباكب
  const settings = DB.get('settings')||{};
  settings.backupPath = backupPath;
  settings.backupIntervalHours = backupInterval;
  settings.backupEnabled = backupEnabled;
  DB.set('settings', settings);
  // إعادة تشغيل الباكب بالإعدادات الجديدة
  startServerAutoBackup();
  showToast('تم حفظ الإعدادات');
}

/* ============================================================
   INACTIVE PATIENTS REPORT (المنقطعون)
   ============================================================ */
function renderInactivePatients(c){
  c.innerHTML=`
  <div class="card">
    <div class="card-header"><span class="card-title">😴 تقرير المنقطعين عن الزيارة</span>
    <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨️ طباعة</button></div>
    <div style="display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap;margin-bottom:1rem">
      <div class="form-group" style="margin:0">
        <label>منقطع منذ (بالأيام)</label>
        <input type="number" id="inactive-days" value="30" min="1" style="width:120px;padding:.5rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)">
      </div>
      <div class="form-group" style="margin:0">
        <label>تصفية بالدكتور</label>
        <select id="inactive-doc" style="padding:.5rem .7rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)">
          <option value="">الكل</option>
          ${(DB.get('users')||[]).filter(u=>u.role==='doctor'||u.role==='admin').map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" onclick="doInactiveSearch()">🔍 بحث</button>
    </div>
    <div id="inactive-results">
      <p style="color:var(--text-muted);text-align:center;padding:2rem">اضغط "بحث" لعرض المنقطعين</p>
    </div>
  </div>`;
}

function doInactiveSearch(){
  const days=parseInt(document.getElementById('inactive-days')?.value||30);
  const docId=parseInt(document.getElementById('inactive-doc')?.value||0)||null;
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);
  const cutoffStr=cutoff.toISOString().split('T')[0];
  const patients=DB.get('patients')||[];
  const apts=DB.get('appointments')||[];
  const lastVisit={};
  apts.filter(a=>a.status==='done').forEach(a=>{
    if(!docId||a.doctorId===docId){
      if(!lastVisit[a.patientId]||a.date>lastVisit[a.patientId].date){
        lastVisit[a.patientId]={date:a.date,doctorName:a.doctorName,serviceName:a.serviceName};
      }
    }
  });
  const inactive=patients.filter(p=>{
    const lv=lastVisit[p.id];
    if(!lv) return false;
    return lv.date<cutoffStr;
  }).map(p=>({...p,lastVisit:lastVisit[p.id]}))
    .sort((a,b)=>a.lastVisit.date>b.lastVisit.date?1:-1);
  const el=document.getElementById('inactive-results');
  if(!inactive.length){el.innerHTML=`<div class="alert alert-success" style="margin:0">✅ لا يوجد منقطعون منذ ${days} يوماً</div>`;return;}
  el.innerHTML=`
    <div class="alert alert-warning" style="margin-bottom:1rem">⚠️ وُجد <strong>${inactive.length}</strong> مريض منقطع منذ أكثر من <strong>${days}</strong> يوماً</div>
    <div class="table-wrap"><table>
      <tr><th>الكود</th><th>الاسم</th><th>التليفون</th><th>آخر زيارة</th><th>آخر دكتور</th><th>آخر خدمة</th><th>المديونية</th><th>إجراءات</th></tr>
      ${inactive.map(p=>`<tr>
        <td>${p.code}</td>
        <td>${p.fullName}</td>
        <td><a href="https://wa.me/2${p.phone}" target="_blank" style="color:var(--primary)">${p.phone} 📲</a></td>
        <td style="color:var(--danger);font-weight:600">${p.lastVisit.date}</td>
        <td>${p.lastVisit.doctorName}</td>
        <td>${p.lastVisit.serviceName}</td>
        <td>${p.debt>0?`<span class="badge badge-danger">عليه: ${p.debt} ج</span>`:p.credit>0?`<span class="badge badge-success">له: ${p.credit} ج</span>`:'—'}</td>
        <td><button class="btn btn-sm btn-outline" onclick="showPatientProfile(${p.id})">الملف</button></td>
      </tr>`).join('')}
    </table></div>`;
}

