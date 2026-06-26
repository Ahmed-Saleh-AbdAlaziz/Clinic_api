/* ============================================================
   AUDIT LOG
   ============================================================ */
function renderAuditLog(c){
  const logs=DB.get('auditLog')||[];
  c.innerHTML=`
  <div class="card">
    <div class="card-header"><span class="card-title">📋 سجل العمليات</span>
    <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨️ طباعة</button>
    </div>
    <div class="table-wrap"><table>
      <tr><th>التاريخ والوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr>
      ${logs.slice(-100).reverse().map(l=>`
      <tr>
        <td style="font-size:.8rem">${l.time}</td>
        <td>${l.user}</td>
        <td><span class="badge badge-info">${l.action}</span></td>
        <td>${l.details}</td>
      </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لا سجلات</td></tr>'}
    </table></div>
  </div>`;
}

/* ============================================================
   EXPORTS
   ============================================================ */
function exportTodayPhones(){
  const apts=(DB.get('appointments')||[]).filter(a=>a.date===today());
  const patients=DB.get('patients')||[];
  const phones=apts.map(a=>{const p=patients.find(x=>x.id===a.patientId);return p?`${p.fullName}\t${p.phone}`:''}).filter(Boolean).join('\n');
  downloadText(`clinic_phones_${today()}.txt`,phones);
}

function exportAllPhones(){
  const patients=DB.get('patients')||[];
  const txt=patients.map(p=>`${p.fullName}\t${p.phone}`).join('\n');
  downloadText(`all_phones_${today()}.txt`,txt);
}

function exportVCF(){
  const patients=DB.get('patients')||[];
  const vcf=patients.map(p=>`BEGIN:VCARD\nVERSION:3.0\nFN:${p.fullName}\nTEL;TYPE=CELL:+2${p.phone}\nEND:VCARD`).join('\n');
  const blob=new Blob([vcf],{type:'text/vcard;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`clinic_contacts_${today()}.vcf`;a.click();
  showToast('تم تصدير VCF');
}

function exportTodayPatients(){
  const apts=(DB.get('appointments')||[]).filter(a=>a.date===today());
  const rows=['رقم\tالمريض\tالدكتور\tالخدمة\tالوقت\tالحالة\tالمدفوع',...apts.map(a=>`${a.queueNum}\t${a.patientName}\t${a.doctorName}\t${a.serviceName}\t${a.time}\t${statusLabel(a.status)}\t${a.payment?.paid||0}`)];
  downloadText(`today_appointments_${today()}.tsv`,rows.join('\n'));
}

function downloadText(name,content){
  const blob=new Blob(['\ufeff'+content],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  showToast('تم التصدير');
}

/* ============================================================
   BACKUP
   ============================================================ */
function exportBackup(){
  const keys=['users','patients','appointments','services','packages','shifts','expenses','patientCounter','appointmentCounter','clinicName','clinicTheme','clinicLogo','messages','auditLog','pendingRefunds','ledger'];
  const data={_backupDate:new Date().toISOString(),_version:'v5'};
  keys.forEach(k=>{data[k]=DB.get(k);});
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`clinic_backup_${today()}_${Date.now()}.json`;a.click();
  addAuditLog('نسخة احتياطية','تم تصدير نسخة احتياطية كاملة');
  showToast('✅ تم تصدير النسخة الاحتياطية الكاملة');
}

function importBackup(){
  const inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=e=>{
    const f=e.target.files[0];if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        // Validate it's a clinic backup
        if(!d.patients&&!d.appointments){showToast('ملف غير صالح — لا يبدو أنه نسخة احتياطية للعيادة','danger');return;}
        const count={patients:(d.patients||[]).length,appointments:(d.appointments||[]).length,users:(d.users||[]).length};
        if(!confirm(`سيتم استيراد:\n• ${count.patients} مريض\n• ${count.appointments} موعد\n• ${count.users} مستخدم\n\nهذا سيستبدل البيانات الحالية. هل تريد المتابعة؟`)) return;
        Object.entries(d).forEach(([k,v])=>{if(!k.startsWith('_')) DB.set(k,v);});
        showToast('✅ تم استيراد النسخة الاحتياطية بنجاح');
        setTimeout(()=>location.reload(),1500);
      }catch(err){showToast('خطأ في قراءة الملف: '+err.message,'danger');}
    };r.readAsText(f);
  };inp.click();
}

function resetDB(){
  if(!confirm('⚠️ هذا الإجراء سيمسح جميع البيانات من السيرفر! هل أنت متأكد؟')) return;
  if(!confirm('تأكيد أخير: سيتم حذف جميع المرضى والمواعيد والبيانات نهائياً!')) return;
  apiCall('reset_all',{}).then(()=>{ Object.keys(_memCache).forEach(k=>delete _memCache[k]); location.reload(); });
}

/* ============================================================
   CHAT / MESSAGING
   ============================================================ */
function startMessagePoll(){
  setInterval(()=>{
    if(!currentUser) return;
    const msgs=DB.get('messages')||[];
    const unread=msgs.filter(m=>m.toId===currentUser.id&&!m.read);
    const badge=document.getElementById('chat-unread-badge');
    if(badge){
      badge.textContent=unread.length;
      badge.classList.toggle('hidden',unread.length===0);
    }
    if(!chatOpen&&unread.length>0){
      const latest=unread[unread.length-1];
      if(latest&&latest.id!==window._lastNotifiedMsgId){
        window._lastNotifiedMsgId=latest.id;
        showNotifPopup(`💬 رسالة من ${latest.fromName}: ${latest.text.substring(0,50)}`,null);
      }
    }
  },3000);
}

function openChat(){
  chatOpen=true;
  const overlay=document.createElement('div');
  overlay.className='chat-overlay';overlay.id='chat-overlay';
  overlay.onclick=e=>{if(e.target===overlay) closeChat();};
  const users=(DB.get('users')||[]).filter(u=>u.active&&u.id!==currentUser.id);
  overlay.innerHTML=`
  <div class="chat-box">
    <div class="chat-header">
      <span>💬 الرسائل الداخلية</span>
      <button onclick="closeChat()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.2rem">×</button>
    </div>
    <div class="chat-users-list">
      <select id="chat-to" style="width:100%;padding:.4rem;border:1px solid var(--gray-border);border-radius:var(--radius-sm)" onchange="loadChatWith(this.value)">
        <option value="">اختر المستخدم...</option>
        ${users.map(u=>`<option value="${u.id}">${u.name} (${roleLabel(u.role)})</option>`).join('')}
      </select>
      <div style="margin-top:.4rem">
        <label style="font-size:.78rem;color:var(--text-muted)">إرسال لأكثر من مستخدم:</label>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.2rem">
          ${users.map(u=>`<label style="display:flex;align-items:center;gap:.2rem;font-size:.78rem"><input type="checkbox" value="${u.id}" id="cm-${u.id}"> ${u.name}</label>`).join('')}
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-msgs"><p style="text-align:center;color:var(--text-muted);font-size:.85rem">اختر مستخدماً لبدء المحادثة</p></div>
    <div class="chat-input-area">
      <input id="chat-msg-input" placeholder="اكتب رسالة..." onkeydown="if(event.key==='Enter')sendMessage()">
      <button class="btn btn-primary btn-sm" onclick="sendMessage()">إرسال</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function closeChat(){
  chatOpen=false;activeChatUser=null;
  document.getElementById('chat-overlay')?.remove();
}

function loadChatWith(userId){
  if(!userId) return;
  activeChatUser=parseInt(userId);
  const msgs=DB.get('messages')||[];
  // Mark as read
  msgs.forEach(m=>{if(m.toId===currentUser.id&&m.fromId===activeChatUser) m.read=true;});
  DB.set('messages',msgs);
  const conv=msgs.filter(m=>(m.fromId===currentUser.id&&m.toId===activeChatUser)||(m.fromId===activeChatUser&&m.toId===currentUser.id)).sort((a,b)=>a.ts-b.ts);
  const el=document.getElementById('chat-msgs');
  if(!el) return;
  el.innerHTML=conv.length?conv.map(m=>`
    <div class="chat-msg ${m.fromId===currentUser.id?'sent':'received'}">
      <div>${m.text}</div>
      <div class="msg-meta">${m.fromName} • ${m.timeStr}</div>
    </div>`).join(''):'<p style="text-align:center;color:var(--text-muted);font-size:.85rem">لا رسائل بعد</p>';
  el.scrollTop=el.scrollHeight;
}

function sendMessage(){
  const text=document.getElementById('chat-msg-input')?.value.trim();
  if(!text) return;
  const msgs=DB.get('messages')||[];
  const now_=new Date();
  // Check multi-select
  const checks=document.querySelectorAll('[id^="cm-"]:checked');
  const recipients=checks.length>0?[...checks].map(c=>parseInt(c.value)):(activeChatUser?[activeChatUser]:[]);
  if(!recipients.length){showToast('اختر مستخدماً','warning');return;}
  recipients.forEach(rid=>{
    msgs.push({id:Date.now()+Math.random(),fromId:currentUser.id,fromName:currentUser.name,toId:rid,text,ts:now_.getTime(),timeStr:now_.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}),read:false});
  });
  DB.set('messages',msgs);
  document.getElementById('chat-msg-input').value='';
  if(activeChatUser&&recipients.includes(activeChatUser)) loadChatWith(activeChatUser);
  showToast('تم إرسال الرسالة');
}

