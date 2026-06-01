/* ===== 06-plan.js ===== (extracted from index.html lines 2997-3961) */
function switchPlanTab(tab) {
  ['new','list','confirm','history'].forEach(t => {
    const el = document.getElementById('planTab-' + t);
    if (!el) return;
    el.style.background = t === tab ? '#00695C' : 'transparent';
    el.style.color = t === tab ? 'white' : 'var(--text2)';
    el.style.fontWeight = t === tab ? '600' : '500';
  });
  document.getElementById('planTabNew').style.display = tab === 'new' ? 'block' : 'none';
  document.getElementById('planTabList').style.display = tab === 'list' ? 'block' : 'none';
  document.getElementById('planTabConfirm').style.display = tab === 'confirm' ? 'block' : 'none';
  document.getElementById('planTabHistory').style.display = tab === 'history' ? 'block' : 'none';
  if (tab === 'list') loadPlanList();
  if (tab === 'confirm') loadPlanConfirm();
  if (tab === 'history') loadPlanHistory();
}

// --- Init plan page ---
function initPlanPage() {
  if (!allData.length) { setTimeout(initPlanPage, 500); return; }

  // populate filters (ทำแค่ครั้งแรก)
  const types = [...new Set(allData.map(d => d.instrument_type).filter(Boolean))].sort();
  const depts = [...new Set(allData.map(d => d.department).filter(Boolean))].sort();
  const tSel = document.getElementById('planFilterType');
  const dSel = document.getElementById('planFilterDept');
  if (tSel && tSel.options.length <= 1) {
    tSel.innerHTML = '<option value="">ทุกประเภท</option>' + types.map(t => `<option value="${t}">${t.split(' (')[0]}</option>`).join('');
  }
  if (dSel && dSel.options.length <= 1) {
    dSel.innerHTML = '<option value="">ทุกหน่วยงาน</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  // ถ้ามี planSelectedItems รอ pre-select ให้ filter ตาม type ของ item นั้น
  if (planSelectedItems.length > 0) {
    const firstItem = planSelectedItems[0];
    const tSel2 = document.getElementById('planFilterType');
    if (tSel2 && firstItem.instrument_type) tSel2.value = firstItem.instrument_type;
  }

  // โหลดข้อมูลทันที ไม่ reset planSelectedItems
  filterPlanInstruments();

  // แสดง tab confirm เฉพาะ admin
  const role = currentUser?.role;
  const confirmTab = document.getElementById('planTab-confirm');
  if (confirmTab) confirmTab.style.display = role === 'admin' ? 'inline-flex' : 'none';
  if (role === 'admin') loadPlanConfirmBadge();

  // แสดง tab new เฉพาะ editor/admin
  const newTab = document.getElementById('planTab-new');
  if (newTab) newTab.style.display = (role === 'admin' || role === 'editor') ? 'inline-flex' : 'none';
}

// --- Filter เครื่องมือ ---
function filterPlanInstruments() {
  const type   = document.getElementById('planFilterType')?.value?.trim() || '';
  const dept   = document.getElementById('planFilterDept')?.value?.trim() || '';
  const status = document.getElementById('planFilterStatus')?.value?.trim() || '';

  planFilteredItems = allData.filter(d => {
    if (type && d.instrument_type !== type) return false;
    if (dept && d.department !== dept) return false;
    if (status) {
      const days = d.days_left;
      if (status === 'overdue' && !(days !== null && days < 0)) return false;
      if (status === 'warning' && !(days !== null && days >= 0 && days <= 30)) return false;
      if (status === 'ok'      && !(days !== null && days > 30)) return false;
    }
    return true;
  });
  renderPlanInstrumentTable();
}

function renderPlanInstrumentTable() {
  const tbody = document.getElementById('planInstrumentBody');
  if (!tbody) return;
  document.getElementById('planFilterCount').textContent = `แสดง ${planFilteredItems.length.toLocaleString()} รายการ`;
  if (!planFilteredItems.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">ไม่พบข้อมูล</td></tr>';
    return;
  }
  const bd = 'border-bottom:1px solid var(--border)';
  let firstSelectedIdx = -1;
  tbody.innerHTML = planFilteredItems.map((d, i) => {
    const days = d.days_left;
    const isSelected = planSelectedItems.some(s => s.id == d.id);
    if (isSelected && firstSelectedIdx === -1) firstSelectedIdx = i;
    const checked = isSelected ? 'checked' : '';
    const rowBg = isSelected ? 'background:#e8f5e9;' : '';
    let badge = '';
    if (days !== null && days < 0) badge = `<span style="background:var(--red-light);color:var(--red);font-size:11px;padding:2px 8px;border-radius:20px">เกินกำหนด</span>`;
    else if (days !== null && days <= 30) badge = `<span style="background:var(--amber-light);color:var(--amber);font-size:11px;padding:2px 8px;border-radius:20px">ใกล้ครบ ${days}วัน</span>`;
    else badge = `<span style="background:var(--green-light);color:var(--green);font-size:11px;padding:2px 8px;border-radius:20px">ปกติ</span>`;
    const due = d.due_date ? d.due_date.slice(0,10).split('-').reverse().join('/') : '–';
    const typShort = (d.instrument_type||'–').split(' (')[0];
    return `<tr style="${rowBg}" id="planRow_${i}">
      <td style="padding:8px 12px;${bd};text-align:center"><input type="checkbox" ${checked} onchange="togglePlanItem(${i}, this)"></td>
      <td style="padding:8px 12px;${bd};color:var(--accent);font-weight:600">${d.id_code||'–'}</td>
      <td style="padding:8px 12px;${bd};font-weight:500">${d.instrument_name||'–'}</td>
      <td style="padding:8px 12px;${bd};color:var(--text2);font-size:12px">${typShort}</td>
      <td style="padding:8px 12px;${bd};color:var(--text2)">${d.department||'–'}</td>
      <td style="padding:8px 12px;${bd};color:var(--text2)">${due}</td>
      <td style="padding:8px 12px;${bd};text-align:center">${badge}</td>
    </tr>`;
  }).join('');
  updatePlanSelectCount();

  // scroll ไปหารายการที่ pre-select
  if (firstSelectedIdx >= 0) {
    setTimeout(() => {
      const row = document.getElementById(`planRow_${firstSelectedIdx}`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

function togglePlanItem(idx, cb) {
  const d = planFilteredItems[idx];
  if (cb.checked) {
    if (!planSelectedItems.some(s => s.id == d.id)) planSelectedItems.push(d);
  } else {
    planSelectedItems = planSelectedItems.filter(s => s.id != d.id);
  }
  updatePlanSelectCount();
}

function toggleAllPlanCheck(cb) {
  if (cb.checked) {
    planFilteredItems.forEach(d => { if (!planSelectedItems.some(s => s.id == d.id)) planSelectedItems.push(d); });
  } else {
    const ids = planFilteredItems.map(d => d.id);
    planSelectedItems = planSelectedItems.filter(s => !ids.map(String).includes(String(s.id)));
  }
  renderPlanInstrumentTable();
}

function selectAllPlanItems() {
  planFilteredItems.forEach(d => { if (!planSelectedItems.some(s => s.id == d.id)) planSelectedItems.push(d); });
  renderPlanInstrumentTable();
}

function clearPlanSelection() {
  planSelectedItems = [];
  renderPlanInstrumentTable();
}

function updatePlanSelectCount() {
  const el = document.getElementById('planSelectCount');
  if (el) el.textContent = `เลือก ${planSelectedItems.length} รายการ`;
}

// --- Step 2 ---
function goToPlanStep2() {
  if (!planSelectedItems.length) { showToast('กรุณาเลือกเครื่องมืออย่างน้อย 1 รายการ', 'error'); return; }
  document.getElementById('planStep1').style.display = 'none';
  document.getElementById('planStep2').style.display = 'block';
  // update step badges
  document.getElementById('stepBadge2').style.background = '#00695C';
  document.getElementById('stepBadge2').style.color = 'white';
  document.getElementById('stepLabel2').style.color = '#00695C';
  // แสดงรายการเครื่องมือที่เลือก
  document.getElementById('planStep2Count').textContent = planSelectedItems.length;
  document.getElementById('planSelectedList').innerHTML = planSelectedItems.map(d =>
    `<span style="background:var(--green-light);color:var(--green);font-size:11px;padding:3px 10px;border-radius:20px">${d.id_code||d.instrument_name}</span>`
  ).join('');
}

function backToPlanStep1() {
  document.getElementById('planStep2').style.display = 'none';
  document.getElementById('planStep1').style.display = 'block';
  document.getElementById('stepBadge2').style.background = 'var(--surface2)';
  document.getElementById('stepBadge2').style.color = 'var(--text3)';
  document.getElementById('stepLabel2').style.color = 'var(--text3)';
}

// --- File handling ---
function handlePlanFileSelect(input) {
  if (input.files[0]) setPlanFile(input.files[0]);
}

function handlePlanDrop(e) {
  e.preventDefault();
  document.getElementById('planDropZone').style.borderColor = 'var(--border)';
  if (e.dataTransfer.files[0]) setPlanFile(e.dataTransfer.files[0]);
}

function setPlanFile(file) {
  planFileObj = file;
  document.getElementById('planDropZone').style.display = 'none';
  const prev = document.getElementById('planFilePreview');
  prev.style.display = 'flex';
  document.getElementById('planFileName').textContent = file.name + ' (' + (file.size/1024).toFixed(0) + ' KB)';
}

function clearPlanFile() {
  planFileObj = null;
  document.getElementById('planDropZone').style.display = 'block';
  document.getElementById('planFilePreview').style.display = 'none';
  document.getElementById('planFileInput').value = '';
}

// --- Submit plan ---
async function submitPlan() {
  const title = document.getElementById('planTitle').value.trim();
  const date = document.getElementById('planDate').value;
  if (!title) { showToast('กรุณากรอกชื่อแผน', 'error'); return; }
  if (!date) { showToast('กรุณาเลือกวันที่นัดสอบ', 'error'); return; }
  if (!planFileObj) { showToast('กรุณาแนบไฟล์แผน', 'error'); return; }

  showLoading('กำลังอัพโหลดไฟล์...');
  try {
    // upload file
    const ext = planFileObj.name.split('.').pop();
    const fileName = `plan_${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('calibration-plans').upload(fileName, planFileObj);
    if (upErr) throw upErr;

    const { data: urlData } = sb.storage.from('calibration-plans').getPublicUrl(fileName);

    // create plan record
    const { data: plan, error: pErr } = await sb.from('calibration_plans').insert({
      title, planned_date: date,
      created_by: currentUser.username,
      plan_file_url: urlData?.publicUrl || fileName,
      status: 'pending_plan'
    }).select().single();
    if (pErr) throw pErr;

    // create plan items
    const items = planSelectedItems.map(d => ({
      plan_id: plan.id,
      instrument_id: d.id,
      instrument_type: d.instrument_type,
      department: d.department,
      instrument_name: d.instrument_name,
      id_code: d.id_code
    }));
    const { error: iErr } = await sb.from('calibration_plan_items').insert(items);
    if (iErr) throw iErr;

    hideLoading();
    await logPlanAudit(plan.id, 'สร้างแผน', `สร้างแผน "${title}" วันนัดสอบ ${date}`);
    showToast('✅ ส่งแผนให้ Admin เรียบร้อยแล้ว', 'success');

    // reset
    planSelectedItems = [];
    planFileObj = null;
    document.getElementById('planTitle').value = '';
    document.getElementById('planDate').value = '';
    clearPlanFile();
    backToPlanStep1();
    filterPlanInstruments();

    // update badge
    loadPlanConfirmBadge();

  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// --- Load plan list ---
async function loadPlanList() {
  const el = document.getElementById('planListContainer');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">กำลังโหลด...</div>';

  const { data, error } = await sb.from('calibration_plans')
    .select('*, calibration_plan_items(id, id_code, instrument_name, instrument_type, department, instrument_id)')
    .order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<div style="color:var(--red);padding:16px">โหลดไม่สำเร็จ</div>'; return; }
  if (!data?.length) { el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">ยังไม่มีแผนการสอบเทียบ</div>'; return; }

  const isAdmin = currentUser?.role === 'admin';

  const statusMap = {
    pending_plan: { lbl:'🟡 รอ Admin ยืนยันแผน', color:'#854F0B', bg:'#FAEEDA' },
    planned:      { lbl:'✅ วางแผนแล้ว',          color:'#3B6D11', bg:'#EAF3DE' },
    pending_cert: { lbl:'🔵 รอ Admin ยืนยันสอบ',  color:'#185FA5', bg:'#E6F1FB' },
    completed:    { lbl:'🏆 สอบเทียบแล้ว',         color:'#0F6E56', bg:'#E1F5EE' },
    rejected:     { lbl:'❌ ถูกปฏิเสธ',            color:'#A32D2D', bg:'#FCEBEB' },
  };

  el.innerHTML = data.map(p => {
    const s = statusMap[p.status] || { lbl:'–', color:'#888', bg:'#f5f5f5' };
    const items = p.calibration_plan_items || [];
    const cnt = items.length;
    const date = p.planned_date ? new Date(p.planned_date).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '–';
    const created = p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';
    const canAttachCert = p.status === 'planned' && (currentUser?.role === 'editor' || currentUser?.role === 'admin');

    // สร้าง rows เครื่องมือ
    const itemRows = items.map(it => {
      const inst = allData.find(d => d.id == it.instrument_id);
      const days = inst?.days_left;
      let badge = '';
      if (days !== null && days !== undefined) {
        if (days < 0) badge = `<span style="background:#FCEBEB;color:#A32D2D;font-size:11px;padding:1px 8px;border-radius:20px">เกินกำหนด</span>`;
        else if (days <= 30) badge = `<span style="background:#FAEEDA;color:#854F0B;font-size:11px;padding:1px 8px;border-radius:20px">ใกล้ครบ ${days}วัน</span>`;
        else badge = `<span style="background:#EAF3DE;color:#3B6D11;font-size:11px;padding:1px 8px;border-radius:20px">ปกติ</span>`;
      }
      const due = inst?.due_date ? inst.due_date.slice(0,10).split('-').reverse().join('/') : '–';
      return `<div style="display:grid;grid-template-columns:160px 1fr 100px 100px;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border);font-size:12px">
        <span style="color:var(--accent);font-weight:600">${it.id_code||'–'}</span>
        <span style="color:var(--text)">${it.instrument_name||'–'} <span style="color:var(--text3)">· ${it.department||'–'}</span></span>
        <span style="color:var(--text3)">Due: ${due}</span>
        <span>${badge}</span>
      </div>`;
    }).join('');

    return `<div style="background:white;border:0.5px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:0">
      <div style="padding:14px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-size:15px;font-weight:600;color:var(--text)">${p.title}</span>
            <span style="background:${s.bg};color:${s.color};font-size:11px;padding:2px 10px;border-radius:20px;font-weight:500">${s.lbl}</span>
          </div>
          <div style="font-size:12px;color:var(--text3)">วันนัดสอบ: ${date} &nbsp;·&nbsp; ${cnt} เครื่องมือ &nbsp;·&nbsp; สร้างโดย: ${p.created_by} &nbsp;·&nbsp; ${created}</div>
          ${p.status === 'rejected' && p.reject_reason ? `<div style="margin-top:5px;font-size:11px;background:#FCEBEB;color:#A32D2D;padding:4px 10px;border-radius:6px;display:inline-block">⚠️ สาเหตุ: ${p.reject_reason}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
          ${p.plan_file_url ? `<button onclick="viewPlanFile('${p.plan_file_url}')" style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px">📄 ไฟล์แผน</button>` : ''}
          ${cnt > 0 ? `<button onclick="togglePlanItems('items_${p.id}')" style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px">📋 รายการ (${cnt})</button>` : ''}
          ${p.cert_file_url ? `<button onclick="viewPlanFile('${p.cert_file_url}')" style="padding:5px 10px;background:#EAF3DE;border:1px solid #C0DD97;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:#3B6D11;display:flex;align-items:center;gap:4px">📋 ดูไฟล์ Cert</button>` : ''}
          ${canAttachCert ? `<button onclick="openAttachCertModal('${p.id}')" style="padding:5px 10px;background:#E6F1FB;border:1px solid #B5D4F4;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:#185FA5;font-weight:600">📎 แนบไฟล์หลังสอบ</button>` : ''}
          ${ `<button data-plan-id="${p.id}" data-plan-title="${encodeURIComponent(p.title||'')}" onclick="openAuditPlanModal(this.dataset.planId, decodeURIComponent(this.dataset.planTitle))" style="padding:5px 10px;background:#F3F0FF;border:1px solid #C4B5FD;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:#5B21B6;display:flex;align-items:center;gap:4px">🕐 ประวัติ</button>` }
          ${ (isAdmin || currentUser?.role === 'editor') && p.status !== 'completed' ? `<button data-plan-id="${p.id}" data-plan-title="${encodeURIComponent(p.title||'')}" data-plan-date="${p.planned_date||''}" onclick="openEditPlanModal(this.dataset.planId, decodeURIComponent(this.dataset.planTitle), this.dataset.planDate)" style="padding:5px 10px;background:#FFF7E6;border:1px solid #FCD34D;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:#92400E;display:flex;align-items:center;gap:4px">✏️ แก้ไข</button>` : '' }
          ${isAdmin ? `<button onclick="deletePlan('${p.id}')" style="padding:5px 10px;background:#FCEBEB;border:1px solid #F7C1C1;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:#A32D2D;display:flex;align-items:center;gap:4px">🗑 ลบ</button>` : ''}
        </div>
      </div>
      ${cnt > 0 ? `<div id="items_${p.id}" style="display:none;border-top:0.5px solid var(--border);background:var(--surface2);padding:10px 16px">
        <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">รายการเครื่องมือ</div>
        ${itemRows}
      </div>` : ''}
    </div>`;
  }).join('');
}

function togglePlanItems(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function viewPlanFile(url) {
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─── Plan History (Tab) ──────────────────────────────────────────────────────

async function loadPlanHistory() {
  const el = document.getElementById('planHistoryContainer');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">กำลังโหลด...</div>';

  const filterAction = document.getElementById('historyFilterAction')?.value || '';
  // ดึงชื่อแผนทั้งหมดมา cache ก่อน
  const { data: plansData } = await sb.from('calibration_plans').select('id, title');
  const planMap = {};
  (plansData || []).forEach(p => { planMap[p.id] = p.title; });

  let query = sb.from('plan_audit_log')
    .select('id, plan_id, action, action_by, action_at, note')
    .order('action_at', { ascending: false })
    .limit(200);
  if (filterAction) query = query.eq('action', filterAction);

  const { data, error } = await query;
  if (error) {
    console.error('plan_audit_log error:', error);
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--red);font-size:12px">โหลดไม่สำเร็จ: ' + error.message + '</div>';
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:12px">ยังไม่มีประวัติการดำเนินการ</div>';
    return;
  }

  const actionColor = {
    'สร้างแผน':   { bg:'#E8F5E9', color:'#2E7D32', icon:'🆕' },
    'แก้ไขแผน':  { bg:'#FFF8E1', color:'#F57F17', icon:'✏️' },
    'อนุมัติแผน': { bg:'#E3F2FD', color:'#1565C0', icon:'✅' },
    'ปฏิเสธแผน': { bg:'#FCEBEB', color:'#A32D2D', icon:'❌' },
    'แนบไฟล์สอบ':{ bg:'#F3E5F5', color:'#6A1B9A', icon:'📎' },
    'ยืนยันสอบ':  { bg:'#E0F7FA', color:'#00695C', icon:'🏆' },
    'ลบแผน':     { bg:'#FFEBEE', color:'#B71C1C', icon:'🗑️' },
  };

  el.innerHTML = data.map(log => {
    const ac = actionColor[log.action] || { bg:'#F5F5F5', color:'#666', icon:'📝' };
    const dt = new Date(log.action_at);
    const dateStr = dt.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
    const timeStr = dt.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
    const planTitle = planMap[log.plan_id] || '(ถูกลบแล้ว)';
    return `<div style="background:white;border:1px solid var(--border);border-left:4px solid ${ac.color};border-radius:8px;padding:10px 14px;display:flex;align-items:flex-start;gap:12px">
      <div style="width:30px;height:30px;background:${ac.bg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${ac.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:${ac.color};background:${ac.bg};padding:1px 8px;border-radius:20px">${log.action}</span>
          <span style="font-size:12px;color:var(--text);font-weight:500">${planTitle}</span>
        </div>
        ${log.note ? `<div style="font-size:11px;color:var(--text2);margin-top:3px">${log.note}</div>` : ''}
        <div style="font-size:11px;color:var(--text3);margin-top:3px">โดย <span style="color:var(--accent);font-weight:600">${log.action_by}</span> &nbsp;·&nbsp; ${dateStr} ${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── Plan Audit Log Functions ───────────────────────────────────────────────

async function logPlanAudit(planId, action, note = '') {
  try {
    await sb.from('plan_audit_log').insert({
      plan_id: planId,
      action: action,
      action_by: currentUser?.username || 'unknown',
      note: note
    });
  } catch(e) { console.warn('audit log error:', e.message); }
}

// ─── Reject Plan ─────────────────────────────────────────────────────────────

function openRejectModal(planId) {
  document.getElementById('rejectPlanId').value = planId;
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectPlanModal').style.display = 'flex';
}

function closeRejectModal() {
  document.getElementById('rejectPlanModal').style.display = 'none';
}

async function submitRejectPlan() {
  const planId = document.getElementById('rejectPlanId').value;
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { showToast('กรุณาระบุสาเหตุที่ปฏิเสธ', 'error'); return; }
  showLoading('กำลังบันทึก...');
  try {
    const { error } = await sb.from('calibration_plans').update({
      status: 'rejected',
      reject_reason: reason
    }).eq('id', planId);
    if (error) throw error;
    await logPlanAudit(planId, 'ปฏิเสธแผน', `สาเหตุ: ${reason}`);
    hideLoading();
    showToast('❌ ปฏิเสธแผนเรียบร้อย', 'success');
    closeRejectModal();
    loadPlanConfirm();
    loadPlanConfirmBadge();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// ─── Edit Plan ───────────────────────────────────────────────────────────────

function openEditPlanModal(planId, title, date) {
  document.getElementById('editPlanId').value = planId;
  document.getElementById('editPlanTitle').value = title;
  document.getElementById('editPlanDate').value = date ? date.slice(0,10) : '';
  document.getElementById('editPlanNote').value = '';
  document.getElementById('editPlanModal').style.display = 'flex';
}

function closeEditPlanModal() {
  document.getElementById('editPlanModal').style.display = 'none';
}

async function submitEditPlan() {
  const planId = document.getElementById('editPlanId').value;
  const title  = document.getElementById('editPlanTitle').value.trim();
  const date   = document.getElementById('editPlanDate').value;
  const note   = document.getElementById('editPlanNote').value.trim();
  if (!title) { showToast('กรุณากรอกชื่อแผน', 'error'); return; }
  if (!date)  { showToast('กรุณาเลือกวันที่', 'error'); return; }
  showLoading('กำลังบันทึก...');
  try {
    const { error } = await sb.from('calibration_plans').update({
      title, planned_date: date
    }).eq('id', planId);
    if (error) throw error;
    await logPlanAudit(planId, 'แก้ไขแผน', note || `แก้ไขชื่อเป็น "${title}" วันที่ ${date}`);
    hideLoading();
    showToast('✅ แก้ไขแผนเรียบร้อย', 'success');
    closeEditPlanModal();
    loadPlanList();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// ─── Audit Trail Modal ───────────────────────────────────────────────────────

async function openAuditPlanModal(planId, planTitle) {
  document.getElementById('auditPlanTitle').textContent = '📌 ' + (planTitle || '–');
  document.getElementById('auditPlanList').innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">กำลังโหลด...</div>';
  document.getElementById('auditPlanModal').style.display = 'flex';

  const { data, error } = await sb.from('plan_audit_log')
    .select('id, plan_id, action, action_by, action_at, note')
    .eq('plan_id', planId)
    .order('action_at', { ascending: false });

  const el = document.getElementById('auditPlanList');
  if (error || !data?.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">ยังไม่มีประวัติการดำเนินการ</div>';
    return;
  }

  const actionIcon = {
    'สร้างแผน':    '🆕',
    'อนุมัติแผน':  '✅',
    'ปฏิเสธแผน':  '❌',
    'แก้ไขแผน':   '✏️',
    'แนบไฟล์สอบ': '📎',
    'ยืนยันสอบ':  '🏆',
    'ลบแผน':      '🗑️',
  };

  el.innerHTML = data.map((log, i) => {
    const dt = new Date(log.action_at);
    const dateStr = dt.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
    const timeStr = dt.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
    const icon = actionIcon[log.action] || '📝';
    const isLast = i === data.length - 1;
    return `<div style="display:flex;gap:12px;padding:10px 0;${!isLast ? 'border-bottom:1px solid var(--border)' : ''}">
      <div style="flex-shrink:0;width:32px;height:32px;background:var(--surface2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${log.action}</div>
        ${log.note ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${log.note}</div>` : ''}
        <div style="font-size:11px;color:var(--text3);margin-top:3px">โดย <span style="color:var(--accent);font-weight:500">${log.action_by}</span> &nbsp;·&nbsp; ${dateStr} ${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

function closeAuditPlanModal() {
  document.getElementById('auditPlanModal').style.display = 'none';
}

async function deletePlan(planId) {
  if (!confirm('ลบแผนนี้? ข้อมูลและไฟล์จะถูกลบถาวร')) return;
  showLoading('กำลังลบ...');
  try {
    // log ก่อนลบ เพราะหลังลบแล้ว record หาย
    await logPlanAudit(planId, 'ลบแผน', 'ลบแผนสอบเทียบออกจากระบบ');
    const { error: ie } = await sb.from('calibration_plan_items').delete().eq('plan_id', planId);
    if (ie) throw ie;
    const { error: pe } = await sb.from('calibration_plans').delete().eq('id', planId);
    if (pe) throw pe;
    hideLoading();
    // ไม่ log หลังลบเพราะ record ถูกลบแล้ว
    showToast('✅ ลบแผนเรียบร้อย', 'success');
    loadPlanList();
    loadPlanConfirmBadge();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// --- Load confirm list (Admin) ---
async function loadPlanConfirm() {
  const el = document.getElementById('planConfirmContainer');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">กำลังโหลด...</div>';
  const { data, error } = await sb.from('calibration_plans')
    .select('*, calibration_plan_items(id, id_code, instrument_name, instrument_type, department, instrument_id)')
    .in('status', ['pending_plan', 'pending_cert'])
    .order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<div style="color:var(--red);padding:16px">โหลดไม่สำเร็จ</div>'; return; }
  if (!data?.length) { el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">ไม่มีรายการรอยืนยัน ✅</div>'; return; }

  el.innerHTML = data.map(p => {
    const items = p.calibration_plan_items || [];
    const cnt = items.length;
    const date = p.planned_date ? new Date(p.planned_date).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '–';
    const isPendingPlan = p.status === 'pending_plan';
    const isPendingCert = p.status === 'pending_cert';
    const badgeLbl = isPendingPlan ? '🟡 รอยืนยันแผน' : '🔵 รอยืนยันสอบ';
    const badgeBg = isPendingPlan ? '#fff8e1' : '#e3f2fd';
    const badgeColor = isPendingPlan ? '#F57F17' : '#1565C0';

    // สร้าง rows รายการเครื่องมือ
    const itemRows = items.map((it, idx) => {
      const inst = allData.find(d => d.id == it.instrument_id);
      const days = inst?.days_left;
      let badge = '';
      if (days !== null && days !== undefined) {
        if (days < 0) badge = `<span style="background:#FCEBEB;color:#A32D2D;font-size:10px;padding:1px 6px;border-radius:20px">เกินกำหนด</span>`;
        else if (days <= 30) badge = `<span style="background:#FAEEDA;color:#854F0B;font-size:10px;padding:1px 6px;border-radius:20px">ใกล้ครบ ${days}วัน</span>`;
        else badge = `<span style="background:#EAF3DE;color:#3B6D11;font-size:10px;padding:1px 6px;border-radius:20px">ปกติ</span>`;
      }
      const due = inst?.due_date ? inst.due_date.slice(0,10).split('-').reverse().join('/') : '–';
      return `<div style="display:grid;grid-template-columns:30px 140px 1fr 90px 80px;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border);font-size:11px">
        <span style="color:var(--text3);text-align:center">${idx+1}</span>
        <span style="color:var(--accent);font-weight:600;font-family:var(--mono)">${it.id_code||'–'}</span>
        <span style="color:var(--text)">${it.instrument_name||'–'} <span style="color:var(--text3)">· ${it.department||'–'}</span></span>
        <span style="color:var(--text3)">Due: ${due}</span>
        <span>${badge}</span>
      </div>`;
    }).join('');

    return `<div style="background:white;border:1.5px solid ${isPendingPlan ? '#ffe082' : '#90caf9'};border-radius:14px;overflow:hidden">
      <div style="padding:14px 18px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px">${p.title}</div>
            <div style="font-size:11px;color:var(--text3)">วันนัดสอบ: ${date} &nbsp;|&nbsp; ${cnt} เครื่องมือ &nbsp;|&nbsp; ส่งโดย: ${p.created_by}</div>
          </div>
          <span style="background:${badgeBg};color:${badgeColor};font-size:11px;padding:3px 10px;border-radius:20px;white-space:nowrap;font-weight:500">${badgeLbl}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${cnt > 0 ? `<button onclick="togglePlanItems('confirm_items_${p.id}')" style="padding:5px 12px;background:var(--accent-light);border:1px solid #c5d9ef;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:var(--accent);font-weight:500">📋 รายการ (${cnt})</button>` : ''}
          ${p.plan_file_url ? `<button onclick="window.open('${p.plan_file_url}','_blank')" style="padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer">📄 ดูไฟล์แผน</button>` : ''}
          ${p.cert_file_url ? `<button onclick="window.open('${p.cert_file_url}','_blank')" style="padding:5px 12px;background:var(--green-light);border:1px solid #b8e0bf;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:var(--green)">📋 ดูไฟล์ Cert</button>` : ''}
          ${isPendingPlan ? `<button onclick="confirmPlan('${p.id}','planned')" style="padding:5px 14px;background:#00695C;color:white;border:none;border-radius:6px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer">✅ ยืนยันแผน</button>` : ''}
          ${isPendingCert ? `<button onclick="confirmPlan('${p.id}','completed')" style="padding:5px 14px;background:#1565C0;color:white;border:none;border-radius:6px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer">✅ ยืนยันสอบเทียบแล้ว</button>` : ''}
          <button data-plan-id="${p.id}" onclick="openRejectModal(this.dataset.planId)" style="padding:5px 12px;background:var(--red-light);color:var(--red);border:1px solid #f5c6c4;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer">❌ ปฏิเสธ</button>
          <button data-plan-id="${p.id}" data-plan-title="${encodeURIComponent(p.title||'')}" onclick="openAuditPlanModal(this.dataset.planId, decodeURIComponent(this.dataset.planTitle))" style="padding:5px 12px;background:#F3F0FF;border:1px solid #C4B5FD;border-radius:6px;font-family:var(--font);font-size:12px;cursor:pointer;color:#5B21B6">🕐 ประวัติ</button>
        </div>
      </div>
      ${cnt > 0 ? `<div id="confirm_items_${p.id}" style="display:none;border-top:1px solid var(--border);background:var(--surface2);padding:10px 18px">
        <div style="display:grid;grid-template-columns:30px 140px 1fr 90px 80px;gap:8px;padding:4px 0;margin-bottom:4px;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase">
          <span>#</span><span>รหัส</span><span>เครื่องมือ</span><span>Due</span><span>สถานะ</span>
        </div>
        ${itemRows}
      </div>` : ''}
    </div>`;
  }).join('');
}

// --- Confirm plan ---
async function confirmPlan(planId, newStatus) {
  showLoading('กำลังอัพเดทสถานะ...');
  try {
    const updateData = { status: newStatus };
    if (newStatus === 'planned') updateData.plan_confirmed_by = currentUser.username;
    if (newStatus === 'completed') updateData.cert_confirmed_by = currentUser.username;
    const { error } = await sb.from('calibration_plans').update(updateData).eq('id', planId);
    if (error) throw error;
    hideLoading();
    await logPlanAudit(planId, newStatus === 'planned' ? 'อนุมัติแผน' : newStatus === 'completed' ? 'ยืนยันสอบ' : 'ปฏิเสธแผน', `เปลี่ยนสถานะเป็น ${newStatus}`);
    showToast('✅ อัพเดทสถานะเรียบร้อย', 'success');
    loadPlanConfirm();
    loadPlanConfirmBadge();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// --- Attach cert after calibration ---
let attachCertPlanId = null;
function openAttachCertModal(planId) {
  attachCertPlanId = planId;
  document.getElementById('attachCertModal').classList.add('open');
}
function closeAttachCertModal() {
  document.getElementById('attachCertModal').classList.remove('open');
  attachCertPlanId = null;
  document.getElementById('certAttachFile').value = '';
}
async function submitAttachCert() {
  const file = document.getElementById('certAttachFile').files[0];
  if (!file) { showToast('กรุณาเลือกไฟล์', 'error'); return; }
  showLoading('กำลังอัพโหลด...');
  try {
    const ext = file.name.split('.').pop();
    const fileName = `cert_${attachCertPlanId}_${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('calibration-plans').upload(fileName, file);
    if (upErr) throw upErr;
    const { data: urlData } = sb.storage.from('calibration-plans').getPublicUrl(fileName);
    const { error } = await sb.from('calibration_plans').update({
      cert_file_url: urlData?.publicUrl || fileName,
      status: 'pending_cert'
    }).eq('id', attachCertPlanId);
    if (error) throw error;
    hideLoading();
    await logPlanAudit(attachCertPlanId, 'แนบไฟล์สอบ', 'แนบไฟล์หลังสอบเทียบ รอ Admin ยืนยัน');
    showToast('✅ ส่งไฟล์ให้ Admin ยืนยันแล้ว', 'success');
    closeAttachCertModal();
    loadPlanList();
    loadPlanConfirmBadge();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// --- Badge notification ---
async function loadPlanConfirmBadge() {
  if (currentUser?.role !== 'admin') return;
  const { count } = await sb.from('calibration_plans')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending_plan', 'pending_cert']);
  const badge = document.getElementById('planConfirmBadge');
  const navBadge = document.getElementById('navPlanBadge');
  if (badge) { badge.textContent = count || 0; badge.style.display = count > 0 ? 'inline' : 'none'; }
  if (navBadge) { navBadge.textContent = count || 0; navBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
}


function exportExcel() {
  if (!filteredData.length) { showToast('ไม่มีข้อมูลให้ Export', 'error'); return; }
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }

  const headers = ['#','ประเภทเครื่องมือ','ชื่อเครื่องจักร','สถานที่ใช้งาน','ชื่อเครื่องมือ',
    'ยี่ห้อ/รุ่น','Range','Tolerance (±)','S/N','หน่วยงาน','ID Code','CERT.',
    'วันสอบเทียบ','วันครบกำหนด','เหลือ (วัน)','ความถี่สอบเทียบ','ภายใน/ภายนอก','สถานะ','Remark'];

  const rows = filteredData.map((d, i) => {
    const days = d.days_left;
    const status = days === null ? '–' : days < 0 ? 'เลยกำหนด' : days <= 30 ? 'ใกล้ครบ' : 'ปกติ';
    return [i+1, d.instrument_type||'', d.machine_name||'', d.location||'', d.instrument_name||'',
      d.brand||'', d.range_val||'', d.tolerance ? '±'+d.tolerance : '', d.serial_no||'',
      d.department||'', d.id_code||'', d.cert_no||'', d.cal_date||'', d.due_date||'',
      days !== null ? days : '', d.cal_frequency||'', d.cal_type||'', status, d.remark||''];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:4},{wch:32},{wch:20},{wch:16},{wch:24},{wch:20},{wch:12},{wch:14},
    {wch:16},{wch:12},{wch:20},{wch:16},{wch:14},{wch:14},{wch:10},{wch:20},{wch:14},{wch:12},{wch:24}];
  XLSX.utils.book_append_sheet(wb, ws, 'เครื่องมือ');
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  XLSX.writeFile(wb, 'calibration_' + today + '.xlsx');
  showToast('✅ Export ' + filteredData.length + ' รายการสำเร็จ', 'success');
}

// ====================================================
// IMPORT EXCEL
// ====================================================
let importRows = [];

const IMPORT_COL_MAP = {
  'ประเภทเครื่องมือ':'instrument_type','instrument_type':'instrument_type',
  'ชื่อเครื่องจักร':'machine_name','machine_name':'machine_name',
  'สถานที่ใช้งาน':'location','สถานที่':'location','location':'location',
  'ชื่อเครื่องมือ':'instrument_name','เครื่องมือ':'instrument_name','instrument_name':'instrument_name',
  'ยี่ห้อ/รุ่น':'brand','ยี่ห้อ':'brand','brand':'brand',
  'range':'range_val','range_val':'range_val',
  'tolerance (±)':'tolerance','tolerance':'tolerance',
  's/n':'serial_no','serial_no':'serial_no','serial no.':'serial_no',
  'หน่วยงาน':'department','department':'department',
  'id code':'id_code','id_code':'id_code','idcode':'id_code',
  // Cert ใหม่ (มี 2026) → cert_no ปัจจุบัน
  'cert. 2026':'cert_no','cert.2026':'cert_no',
  // วันสอบใหม่ (มี 2026) → cal_date ปัจจุบัน
  'วันสอบเทียบ 2026':'cal_date','วันสอบเทียบ2026':'cal_date',
  // ถ้าไม่มี 2026 → cert. และวันสอบเทียบ = ปัจจุบัน
  'cert.':'cert_no','เลขที่ certificate':'cert_no',
  'วันสอบเทียบ':'cal_date','วันที่สอบเทียบ':'cal_date','cal_date':'cal_date',
  'วันครบกำหนด':'due_date','ครบกำหนด':'due_date','due_date':'due_date',
  'ความถี่สอบเทียบ':'cal_frequency','ความถี่':'cal_frequency','cal_frequency':'cal_frequency',
  'ภายใน/ภายนอก':'cal_type','cal_type':'cal_type',
  'remark':'remark','หมายเหตุ':'remark',
};

function downloadTemplate() {
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }
  const headers = ['ประเภทเครื่องมือ','ชื่อเครื่องจักร','สถานที่ใช้งาน','ชื่อเครื่องมือ',
    'ยี่ห้อ/รุ่น','Range','Tolerance (±)','S/N','หน่วยงาน','ID Code','CERT.',
    'วันสอบเทียบ','วันครบกำหนด','ความถี่สอบเทียบ','ภายใน/ภายนอก','Remark'];
  const example = ['มวล/น้ำหนัก (Mass/Weight)','MIX 1000L','ตึก 5/1','Electronic Balance',
    'AND/GF-3000','30 kg','0.01 g','A1234567','PMP1','PMP1BB01-WI01','25B001-0',
    '2025-01-15','2026-01-15','1 ครั้ง/ปี','ภายนอก',''];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'import_template.xlsx');
}

function openImportModal() { resetImport(); document.getElementById('importModal').classList.add('open'); }
function closeImportModal() { document.getElementById('importModal').classList.remove('open'); resetImport(); }

function resetImport() {
  importRows = [];
  document.getElementById('importStep1').style.display = 'block';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importProgress').style.display = 'none';
  const fi = document.getElementById('importFileInput');
  if (fi) fi.value = '';
}

function handleImportFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length < 2) { showToast('ไม่พบข้อมูลในไฟล์', 'error'); return; }

      const excelHeaders = raw[0].map(h => String(h).trim());
      const fieldMap = {};
      // ตรวจว่ามี Cert. 2026 ไหม — ถ้ามีให้ cert. เก่าเป็น prev
      const hasNew2026 = excelHeaders.some(h => h.toLowerCase().includes('2026'));
      excelHeaders.forEach((h, i) => {
        const key = h.toLowerCase();
        if (IMPORT_COL_MAP[key]) {
          // ถ้าไม่มี 2026 และ key เป็น cert. → map เป็น cert_no (ปัจจุบัน)
          // ถ้ามี 2026 และ key เป็น cert. → map เป็น prev_cert_no
          if (!hasNew2026 && key === 'cert.') fieldMap[i] = 'cert_no';
          else if (!hasNew2026 && key === 'วันสอบเทียบ') fieldMap[i] = 'cal_date';
          else if (hasNew2026 && key === 'cert.') fieldMap[i] = 'prev_cert_no';
          else if (hasNew2026 && key === 'วันสอบเทียบ') fieldMap[i] = 'prev_cal_date';
          else fieldMap[i] = IMPORT_COL_MAP[key];
        }
      });

      const errors = [];
      importRows = raw.slice(1).filter(r => r.some(c => c !== '')).map((r, rowIdx) => {
        const obj = {};
        Object.entries(fieldMap).forEach(([ci, field]) => {
          let val = r[ci];
          if (val instanceof Date) {
            const y = val.getFullYear(), m = String(val.getMonth()+1).padStart(2,'0'), d = String(val.getDate()).padStart(2,'0');
            val = y+'-'+m+'-'+d;
          } else if (typeof val === 'number' && val > 40000 && val < 60000) {
            // Excel serial number → YYYY-MM-DD (epoch: 1899-12-30)
            const dt = new Date(Math.round((val - 25569) * 86400 * 1000));
            const y = dt.getUTCFullYear(), mo = String(dt.getUTCMonth()+1).padStart(2,'0'), dd = String(dt.getUTCDate()).padStart(2,'0');
            val = y+'-'+mo+'-'+dd;
          } else { val = String(val || '').trim(); }
          if (val) obj[field] = val;
        });
        if (obj.instrument_type) obj.category = obj.instrument_type;
        if (!obj.id_code) errors.push('แถว '+(rowIdx+2)+': ไม่มี ID Code');
        return obj;
      }).filter(o => Object.keys(o).length > 0);

      const previewCols = excelHeaders.filter((_, i) => fieldMap[i]);
      const previewFields = previewCols.map(h => fieldMap[excelHeaders.indexOf(h)]);
      document.getElementById('importPreviewHead').innerHTML =
        '<tr>'+previewCols.map(h => '<th style="padding:8px 12px;white-space:nowrap;text-align:left;font-size:12px">'+h+'</th>').join('')+'</tr>';
      document.getElementById('importPreviewBody').innerHTML =
        importRows.slice(0,5).map(r =>
          '<tr>'+previewFields.map(f => '<td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:12px">'+(r[f]||'–')+'</td>').join('')+'</tr>'
        ).join('');

      const validRows = importRows.filter(r => r.id_code);
      document.getElementById('importSummary').innerHTML =
        '📋 พบ <strong>'+importRows.length+'</strong> แถว &nbsp;|&nbsp; ✅ Valid: <strong>'+validRows.length+'</strong> &nbsp;|&nbsp; ❌ ข้าม: <strong>'+(importRows.length-validRows.length)+'</strong> (ไม่มี ID Code)';
      const errEl = document.getElementById('importErrors');
      if (errors.length) {
        errEl.style.display = 'block';
        errEl.innerHTML = '⚠️ '+errors.slice(0,5).join('<br>')+(errors.length>5?'<br>...และอีก '+(errors.length-5)+' แถว':'');
      } else { errEl.style.display = 'none'; }
      document.getElementById('confirmImportBtn').disabled = validRows.length === 0;
      document.getElementById('importStep1').style.display = 'none';
      document.getElementById('importStep2').style.display = 'block';
    } catch(e) { showToast('อ่านไฟล์ไม่สำเร็จ: '+e.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmImport() {
  const validRows = importRows.filter(r => r.id_code);
  if (!validRows.length) return;
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importProgress').style.display = 'block';
  document.getElementById('confirmImportBtn').disabled = true;
  const CHUNK = 50;
  let done = 0, success = 0, failed = 0, failedCodes = [];
  try {
    // ดึงข้อมูลเดิมของทุก id_code ที่จะ import มาเปรียบเทียบ
    const idCodes = validRows.map(r => r.id_code);
    const { data: existingData } = await sb.from('instruments')
      .select('id,id_code,cert_no,cal_date,due_date')
      .in('id_code', idCodes);
    const existingMap = {};
    (existingData || []).forEach(e => { existingMap[e.id_code] = e; });

    for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK);
      // clean null-string values + auto-calc due_date ก่อน upsert
      const cleanChunk = chunk.map(row => {
        const clean = {};
        Object.entries(row).forEach(([k, v]) => {
          const s = String(v||'').trim();
          clean[k] = (s === '' || s === '–' || s === '-') ? null : s;
        });
        // ถ้าไม่มี due_date แต่มี cal_date + cal_frequency → คำนวณอัตโนมัติ
        if (!clean.due_date && clean.cal_date && clean.cal_frequency) {
          clean.due_date = calcDueDateStr(clean.cal_date, clean.cal_frequency);
        }
        return clean;
      });

      // บันทึกประวัติ calibration_history เฉพาะรายการที่ cert_no หรือ cal_date เปลี่ยน
      const historyRows = [];
      cleanChunk.forEach(row => {
        const orig = existingMap[row.id_code];
        if (!orig) return; // รายการใหม่ ยังไม่มีประวัติ
        const certChanged = orig.cert_no && orig.cert_no !== row.cert_no;
        const dateChanged = orig.cal_date && orig.cal_date !== row.cal_date;
        if (certChanged || dateChanged) {
          historyRows.push({
            instrument_id: orig.id,
            cert_no: orig.cert_no || null,
            cal_date: orig.cal_date || null,
            due_date: orig.due_date || null,
          });
          // set prev fields
          row.prev_cert_no = orig.cert_no || null;
          row.prev_cal_date = orig.cal_date || null;
        }
      });
      console.log('[Import] existingMap keys:', Object.keys(existingMap).length);
      console.log('[Import] historyRows to insert:', historyRows.length, historyRows);
      if (historyRows.length) {
        const { error: histErr } = await sb.from('calibration_history').insert(historyRows);
        if (histErr) {
          console.error('[Import] calibration_history insert error:', histErr.message, histErr.details, histErr.hint);
          showToast('⚠️ บันทึกประวัติไม่สำเร็จ: ' + histErr.message, 'error');
        } else {
          console.log('[Import] history inserted OK:', historyRows.length, 'rows');
        }
      }

      const { error } = await sb.from('instruments')
        .upsert(cleanChunk, { onConflict: 'id_code', ignoreDuplicates: false });
      if (error) {
        failed += chunk.length;
        failedCodes.push(...chunk.map(r => r.id_code));
        console.error('upsert error:', error.message, error.details, error.hint);
        document.getElementById('importProgressText').textContent = '❌ ' + error.message;
        document.getElementById('importStep2').style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        showToast('❌ Import ผิดพลาด: ' + error.message, 'error');
        return;
      } else {
        success += chunk.length;
      }
      done += chunk.length;
      const pct = Math.round(done/validRows.length*100);
      document.getElementById('importProgressBar').style.width = pct+'%';
      document.getElementById('importProgressText').textContent = 'กำลัง import... '+done+'/'+validRows.length+' แถว';
      await new Promise(r => setTimeout(r, 30));
    }
    await logAudit('แก้ไข', { id_code: 'IMPORT_BATCH', instrument_name: 'Import/Update batch '+success+' รายการ' }, null);
    const msg = '✅ Import สำเร็จ '+success+' รายการ' + (failed ? ' | ❌ ล้มเหลว '+failed+' รายการ' : '');
    showToast(msg, 'success');
    if (failed) console.warn('Failed id_codes:', failedCodes);
    closeImportModal();
    await loadData(true);
  } catch(e) {
    showToast('Import ไม่สำเร็จ: '+e.message, 'error');
    document.getElementById('importStep2').style.display = 'block';
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('confirmImportBtn').disabled = false;
  }
}

