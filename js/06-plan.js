/* ===== 06-plan.js ===== (generated from index.html inline app script) */
// CALIBRATION PLAN — WORKFLOW
// ====================================================
let planSelectedItems = []; // เครื่องมือที่เลือก
let planFilteredItems = []; // เครื่องมือที่กรองแล้ว
let planFileObj = null;     // ไฟล์ที่แนบ
const PLAN_RENDER_BATCH = 80;
let planRenderLimit = PLAN_RENDER_BATCH;
let planItemsCache = {};

function getPlanInstrumentType(row) {
  return typeof getDisplayInstrumentType === 'function'
    ? getDisplayInstrumentType(row)
    : (row?.instrument_type || '');
}

// --- Switch tabs ---
function switchPlanTab(tab) {
  ['new','list','confirm','history'].forEach(t => {
    const el = document.getElementById('planTab-' + t);
    if (!el) return;
    el.classList.toggle('active', t === tab);
  });
  document.getElementById('planTabNew').style.display = tab === 'new' ? 'block' : 'none';
  document.getElementById('planTabList').style.display = tab === 'list' ? 'block' : 'none';
  document.getElementById('planTabConfirm').style.display = tab === 'confirm' ? 'block' : 'none';
  document.getElementById('planTabHistory').style.display = tab === 'history' ? 'block' : 'none';
  if (tab === 'list') loadPlanList();
  if (tab === 'confirm') loadPlanConfirm();
  if (tab === 'history') loadPlanHistory();
}

function setPlanStep(step) {
  const marks = [1, 2, 3].map(n => document.getElementById('planStepMark' + n));
  marks.forEach((el, idx) => {
    if (!el) return;
    const n = idx + 1;
    el.classList.toggle('active', n === step);
    el.classList.toggle('done', n < step);
  });
}

// --- Init plan page ---
function initPlanPage() {
  if (!allData.length) { setTimeout(initPlanPage, 500); return; }

  // populate filters (ทำแค่ครั้งแรก)
  const types = [...new Set(allData.map(getPlanInstrumentType).filter(Boolean))].sort();
  const depts = [...new Set(allData.map(d => d.department).filter(Boolean))].sort();
  const tSel = document.getElementById('planFilterType');
  const dSel = document.getElementById('planFilterDept');
  if (tSel && tSel.options.length <= 1) {
    tSel.innerHTML = '<option value="">ทุกประเภท</option>' + types.map(t => `<option value="${escapeHtmlAttr(t)}">${escapeHtmlText(t.split(' (')[0])}</option>`).join('');
  }
  if (dSel && dSel.options.length <= 1) {
    dSel.innerHTML = '<option value="">ทุกหน่วยงาน</option>' + depts.map(d => `<option value="${escapeHtmlAttr(d)}">${escapeHtmlText(d)}</option>`).join('');
  }

  // ถ้ามี planSelectedItems รอ pre-select ให้ filter ตาม type ของ item นั้น
  if (planSelectedItems.length > 0) {
    const firstItem = planSelectedItems[0];
    const tSel2 = document.getElementById('planFilterType');
    const firstType = getPlanInstrumentType(firstItem);
    if (tSel2 && firstType) tSel2.value = firstType;
  }

  // โหลดข้อมูลทันที ไม่ reset planSelectedItems
  filterPlanInstruments();
  setPlanStep(document.getElementById('planStep2')?.style.display === 'block' ? 2 : 1);

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
  const q      = document.getElementById('planFilterSearch')?.value?.trim().toLowerCase() || '';
  const type   = document.getElementById('planFilterType')?.value?.trim() || '';
  const dept   = document.getElementById('planFilterDept')?.value?.trim() || '';
  const status = document.getElementById('planFilterStatus')?.value?.trim() || '';

  planFilteredItems = allData.filter(d => {
    if (q) {
      const hay = [d.id_code, d.cert_no, d.serial_no, d.instrument_name, d.instrument_type, getPlanInstrumentType(d), d.department, d.location, d.machine_name]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (type && getPlanInstrumentType(d) !== type) return false;
    if (dept && d.department !== dept) return false;
    if (status) {
      const days = d.days_left;
      if (status === 'overdue' && !(days !== null && days < 0)) return false;
      if (status === 'warning' && !(days !== null && days >= 0 && days <= 30)) return false;
      if (status === 'ok'      && !(days !== null && days > 30)) return false;
    }
    return true;
  });
  planRenderLimit = PLAN_RENDER_BATCH;
  renderPlanInstrumentTable();
}

function renderPlanInstrumentTable() {
  const tbody = document.getElementById('planInstrumentBody');
  if (!tbody) return;
  updatePlanMetrics();
  if (!planFilteredItems.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">ไม่พบข้อมูล</td></tr>';
    const moreWrap = document.getElementById('planLoadMoreWrap');
    if (moreWrap) moreWrap.style.display = 'none';
    return;
  }
  let firstSelectedIdx = -1;
  const visibleItems = planFilteredItems.slice(0, planRenderLimit);
  tbody.innerHTML = visibleItems.map((d, i) => {
    const days = d.days_left;
    const isSelected = planSelectedItems.some(s => s.id == d.id);
    if (isSelected && firstSelectedIdx === -1) firstSelectedIdx = i;
    const checked = isSelected ? 'checked' : '';
    let badge = '';
    if (days !== null && days < 0) badge = '<span class="badge badge-red">เกินกำหนด</span>';
    else if (days !== null && days <= 30) badge = `<span class="badge badge-amber">ใกล้ครบ ${days} วัน</span>`;
    else badge = '<span class="badge badge-green">ปกติ</span>';
    const due = d.due_date ? d.due_date.slice(0,10).split('-').reverse().join('/') : '–';
    const typShort = (getPlanInstrumentType(d) || d.instrument_type || '–').split(' (')[0];
    return `<tr class="${isSelected ? 'is-selected' : ''}" id="planRow_${i}">
      <td class="plan-check"><input type="checkbox" ${checked} onchange="togglePlanItem(${i}, this)"></td>
      <td class="plan-id">${escapeHtmlText(d.id_code || '–')}</td>
      <td class="plan-name">${escapeHtmlText(d.instrument_name || '–')}</td>
      <td class="plan-muted">${escapeHtmlText(typShort)}</td>
      <td class="plan-muted">${escapeHtmlText(d.department || '–')}</td>
      <td class="plan-muted">${escapeHtmlText(due)}</td>
      <td style="text-align:center">${badge}</td>
    </tr>`;
  }).join('');

  const filterCount = document.getElementById('planFilterCount');
  if (filterCount) filterCount.textContent = `แสดง ${visibleItems.length.toLocaleString()} จาก ${planFilteredItems.length.toLocaleString()} รายการ`;
  const moreWrap = document.getElementById('planLoadMoreWrap');
  const moreText = document.getElementById('planLoadMoreText');
  if (moreWrap) moreWrap.style.display = planRenderLimit < planFilteredItems.length ? 'flex' : 'none';
  if (moreText) moreText.textContent = `แสดงเพิ่มอีก ${Math.min(PLAN_RENDER_BATCH, planFilteredItems.length - planRenderLimit).toLocaleString()} รายการ`;
  const checkAll = document.getElementById('planCheckAll');
  if (checkAll) {
    checkAll.checked = planFilteredItems.length > 0 && planFilteredItems.every(d => planSelectedItems.some(s => s.id == d.id));
    checkAll.indeterminate = !checkAll.checked && planFilteredItems.some(d => planSelectedItems.some(s => s.id == d.id));
  }
  updatePlanSelectCount();

  // scroll ไปหารายการที่ pre-select
  if (firstSelectedIdx >= 0) {
    setTimeout(() => {
      const row = document.getElementById(`planRow_${firstSelectedIdx}`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

function loadMorePlanRows() {
  planRenderLimit += PLAN_RENDER_BATCH;
  renderPlanInstrumentTable();
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
  updatePlanMetrics();
}

function updatePlanMetrics() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = Number(val || 0).toLocaleString();
  };
  const overdue = planFilteredItems.filter(d => d.days_left !== null && d.days_left < 0).length;
  const warning = planFilteredItems.filter(d => d.days_left !== null && d.days_left >= 0 && d.days_left <= 30).length;
  set('planMetricFiltered', planFilteredItems.length);
  set('planMetricSelected', planSelectedItems.length);
  set('planMetricOverdue', overdue);
  set('planMetricWarning', warning);
}

// --- Step 2 ---
function goToPlanStep2() {
  if (!planSelectedItems.length) { showToast('กรุณาเลือกเครื่องมืออย่างน้อย 1 รายการ', 'error'); return; }
  document.getElementById('planStep1').style.display = 'none';
  document.getElementById('planStep2').style.display = 'block';
  setPlanStep(2);
  // แสดงรายการเครื่องมือที่เลือก
  document.getElementById('planStep2Count').textContent = planSelectedItems.length;
  document.getElementById('planSelectedList').innerHTML = planSelectedItems.map(d =>
    `<span class="plan-pill" title="${escapeHtmlAttr(d.instrument_name || '')}">${escapeHtmlText(d.id_code || d.instrument_name || '–')}</span>`
  ).join('');
}

function backToPlanStep1() {
  document.getElementById('planStep2').style.display = 'none';
  document.getElementById('planStep1').style.display = 'block';
  setPlanStep(1);
}

// --- File handling ---
function handlePlanFileSelect(input) {
  if (input.files[0]) setPlanFile(input.files[0]);
}

function handlePlanDrop(e) {
  e.preventDefault();
  document.getElementById('planDropZone')?.classList.remove('dragover');
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
      instrument_type: getPlanInstrumentType(d),
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
    setPlanStep(1);
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
  el.innerHTML = '<div class="no-data">กำลังโหลด...</div>';

  const { data, error } = await sb.from('calibration_plans')
    .select('*, calibration_plan_items(id, id_code, instrument_name, instrument_type, department, instrument_id)')
    .order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<div class="no-data" style="color:var(--red)">โหลดไม่สำเร็จ</div>'; return; }
  if (!data?.length) { el.innerHTML = '<div class="no-data">ยังไม่มีแผนการสอบเทียบ</div>'; return; }

  const isAdmin = currentUser?.role === 'admin';
  planItemsCache = {};

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
    const cacheId = 'items_' + p.id;
    planItemsCache[cacheId] = { items, confirm: false };
    const cnt = items.length;
    const date = p.planned_date ? new Date(p.planned_date).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '–';
    const created = p.created_at ? new Date(p.created_at).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';
    const canAttachCert = p.status === 'planned' && (currentUser?.role === 'editor' || currentUser?.role === 'admin');

    return `<div class="plan-card">
      <div class="plan-card-main">
        <div style="flex:1;min-width:0">
          <div class="plan-card-title">
            <span>${escapeHtmlText(p.title || '–')}</span>
            <span class="badge" style="background:${s.bg};color:${s.color}">${s.lbl}</span>
          </div>
          <div class="plan-card-meta">วันนัดสอบ: ${escapeHtmlText(date)} · ${cnt.toLocaleString()} เครื่องมือ · สร้างโดย: ${escapeHtmlText(p.created_by || '–')} · ${escapeHtmlText(created)}</div>
          ${p.status === 'rejected' && p.reject_reason ? `<div class="badge badge-red" style="margin-top:6px">สาเหตุ: ${escapeHtmlText(p.reject_reason)}</div>` : ''}
        </div>
        <div class="plan-card-actions">
          ${p.plan_file_url ? `<button onclick="viewPlanFile('${escapeJsSingle(p.plan_file_url)}')" class="plan-btn" type="button"><i class="ti ti-file-text"></i>ไฟล์แผน</button>` : ''}
          ${cnt > 0 ? `<button onclick="togglePlanItems('${cacheId}')" class="plan-btn" type="button"><i class="ti ti-list"></i>รายการ (${cnt.toLocaleString()})</button>` : ''}
          ${p.cert_file_url ? `<button onclick="viewPlanFile('${escapeJsSingle(p.cert_file_url)}')" class="plan-btn" type="button"><i class="ti ti-certificate"></i>ไฟล์ Cert</button>` : ''}
          ${canAttachCert ? `<button onclick="openAttachCertModal('${p.id}')" class="plan-btn accent" type="button"><i class="ti ti-paperclip"></i>แนบไฟล์หลังสอบ</button>` : ''}
          <button data-plan-id="${p.id}" data-plan-title="${encodeURIComponent(p.title||'')}" onclick="openAuditPlanModal(this.dataset.planId, decodeURIComponent(this.dataset.planTitle))" class="plan-btn" type="button"><i class="ti ti-history"></i>ประวัติ</button>
          ${ (isAdmin || currentUser?.role === 'editor') && p.status !== 'completed' ? `<button data-plan-id="${p.id}" data-plan-title="${encodeURIComponent(p.title||'')}" data-plan-date="${p.planned_date||''}" onclick="openEditPlanModal(this.dataset.planId, decodeURIComponent(this.dataset.planTitle), this.dataset.planDate)" class="plan-btn accent" type="button"><i class="ti ti-edit"></i>แก้ไข</button>` : '' }
          ${isAdmin ? `<button onclick="deletePlan('${p.id}')" class="plan-btn danger" type="button"><i class="ti ti-trash"></i>ลบ</button>` : ''}
        </div>
      </div>
      ${cnt > 0 ? `<div id="${cacheId}" class="plan-items-panel"></div>` : ''}
    </div>`;
  }).join('');
}

function togglePlanItems(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const opening = el.style.display !== 'block';
  if (opening && !el.dataset.rendered) {
    const cached = planItemsCache[id] || { items: [], confirm: false };
    el.innerHTML = `<div class="plan-panel-sub" style="margin-bottom:6px">รายการเครื่องมือ</div>${renderPlanItemRows(cached.items, cached.confirm)}`;
    el.dataset.rendered = '1';
  }
  el.style.display = opening ? 'block' : 'none';
}

function renderPlanItemRows(items, confirmMode) {
  if (!items.length) return '<div class="no-data" style="padding:14px">ไม่มีรายการเครื่องมือ</div>';
  return items.map((it, idx) => {
    const inst = allData.find(d => d.id == it.instrument_id);
    const days = inst?.days_left;
    let badge = '';
    if (days !== null && days !== undefined) {
      if (days < 0) badge = '<span class="badge badge-red">เกินกำหนด</span>';
      else if (days <= 30) badge = `<span class="badge badge-amber">ใกล้ครบ ${days} วัน</span>`;
      else badge = '<span class="badge badge-green">ปกติ</span>';
    }
    const due = inst?.due_date ? inst.due_date.slice(0,10).split('-').reverse().join('/') : '–';
    if (confirmMode) {
      return `<div class="plan-item-row confirm">
        <span class="plan-muted">${idx + 1}</span>
        <span class="plan-id">${escapeHtmlText(it.id_code || '–')}</span>
        <span>${escapeHtmlText(it.instrument_name || '–')} <span class="plan-muted">· ${escapeHtmlText(it.department || '–')}</span></span>
        <span class="plan-muted">Due: ${escapeHtmlText(due)}</span>
        <span>${badge}</span>
      </div>`;
    }
    return `<div class="plan-item-row">
      <span class="plan-id">${escapeHtmlText(it.id_code || '–')}</span>
      <span>${escapeHtmlText(it.instrument_name || '–')} <span class="plan-muted">· ${escapeHtmlText(it.department || '–')}</span></span>
      <span class="plan-muted">Due: ${escapeHtmlText(due)}</span>
      <span>${badge}</span>
    </div>`;
  }).join('');
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
  el.innerHTML = '<div class="no-data">กำลังโหลด...</div>';

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
    el.innerHTML = `<div class="no-data" style="color:var(--red)">โหลดไม่สำเร็จ: ${escapeHtmlText(error.message)}</div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="no-data">ยังไม่มีประวัติการดำเนินการ</div>';
    return;
  }

  const actionColor = {
    'สร้างแผน':   { bg:'#E8F5E9', color:'#2E7D32', icon:'ti-plus' },
    'แก้ไขแผน':  { bg:'#FFF8E1', color:'#F57F17', icon:'ti-edit' },
    'อนุมัติแผน': { bg:'#E3F2FD', color:'#1565C0', icon:'ti-check' },
    'ปฏิเสธแผน': { bg:'#FCEBEB', color:'#A32D2D', icon:'ti-x' },
    'แนบไฟล์สอบ':{ bg:'#F3E5F5', color:'#6A1B9A', icon:'ti-paperclip' },
    'ยืนยันสอบ':  { bg:'#E0F7FA', color:'#00695C', icon:'ti-certificate' },
    'ลบแผน':     { bg:'#FFEBEE', color:'#B71C1C', icon:'ti-trash' },
  };

  el.innerHTML = data.map(log => {
    const ac = actionColor[log.action] || { bg:'#F5F5F5', color:'#666', icon:'ti-notes' };
    const dt = new Date(log.action_at);
    const dateStr = dt.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
    const timeStr = dt.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
    const planTitle = planMap[log.plan_id] || '(ถูกลบแล้ว)';
    return `<div class="plan-card" style="border-left:4px solid ${ac.color}">
      <div class="plan-card-main" style="padding:10px 14px">
        <div class="plan-history-icon" style="background:${ac.bg};color:${ac.color}"><i class="ti ${ac.icon}"></i></div>
        <div class="plan-history-main">
          <div class="plan-history-line">
            <span class="badge" style="background:${ac.bg};color:${ac.color}">${escapeHtmlText(log.action || '–')}</span>
            <span style="font-size:12px;color:var(--text);font-weight:700">${escapeHtmlText(planTitle)}</span>
          </div>
          ${log.note ? `<div style="font-size:11px;color:var(--text2);margin-top:3px">${escapeHtmlText(log.note)}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:3px">โดย <span style="color:var(--accent);font-weight:700">${escapeHtmlText(log.action_by || '–')}</span> · ${escapeHtmlText(dateStr)} ${escapeHtmlText(timeStr)}</div>
        </div>
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
  el.innerHTML = '<div class="no-data">กำลังโหลด...</div>';
  const { data, error } = await sb.from('calibration_plans')
    .select('*, calibration_plan_items(id, id_code, instrument_name, instrument_type, department, instrument_id)')
    .in('status', ['pending_plan', 'pending_cert'])
    .order('created_at', { ascending: false });
  if (error) { el.innerHTML = '<div class="no-data" style="color:var(--red)">โหลดไม่สำเร็จ</div>'; return; }
  if (!data?.length) { el.innerHTML = '<div class="no-data">ไม่มีรายการรอยืนยัน</div>'; return; }

  el.innerHTML = data.map(p => {
    const items = p.calibration_plan_items || [];
    const cacheId = 'confirm_items_' + p.id;
    planItemsCache[cacheId] = { items, confirm: true };
    const cnt = items.length;
    const date = p.planned_date ? new Date(p.planned_date).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '–';
    const isPendingPlan = p.status === 'pending_plan';
    const isPendingCert = p.status === 'pending_cert';
    const badgeLbl = isPendingPlan ? '🟡 รอยืนยันแผน' : '🔵 รอยืนยันสอบ';
    const badgeBg = isPendingPlan ? '#fff8e1' : '#e3f2fd';
    const badgeColor = isPendingPlan ? '#F57F17' : '#1565C0';

    return `<div class="plan-card" style="border-color:${isPendingPlan ? '#ffe082' : '#90caf9'}">
      <div class="plan-card-main">
        <div style="flex:1;min-width:0">
          <div class="plan-card-title">
            <span>${escapeHtmlText(p.title || '–')}</span>
            <span class="badge" style="background:${badgeBg};color:${badgeColor}">${badgeLbl}</span>
          </div>
          <div class="plan-card-meta">วันนัดสอบ: ${escapeHtmlText(date)} · ${cnt.toLocaleString()} เครื่องมือ · ส่งโดย: ${escapeHtmlText(p.created_by || '–')}</div>
        </div>
        <div class="plan-card-actions">
          ${cnt > 0 ? `<button onclick="togglePlanItems('${cacheId}')" class="plan-btn" type="button"><i class="ti ti-list"></i>รายการ (${cnt.toLocaleString()})</button>` : ''}
          ${p.plan_file_url ? `<button onclick="window.open('${escapeJsSingle(p.plan_file_url)}','_blank')" class="plan-btn" type="button"><i class="ti ti-file-text"></i>ไฟล์แผน</button>` : ''}
          ${p.cert_file_url ? `<button onclick="window.open('${escapeJsSingle(p.cert_file_url)}','_blank')" class="plan-btn" type="button"><i class="ti ti-certificate"></i>ไฟล์ Cert</button>` : ''}
          ${isPendingPlan ? `<button onclick="confirmPlan('${p.id}','planned')" class="plan-btn primary" type="button"><i class="ti ti-check"></i>ยืนยันแผน</button>` : ''}
          ${isPendingCert ? `<button onclick="confirmPlan('${p.id}','completed')" class="plan-btn primary" type="button"><i class="ti ti-check"></i>ยืนยันสอบเทียบแล้ว</button>` : ''}
          <button data-plan-id="${p.id}" onclick="openRejectModal(this.dataset.planId)" class="plan-btn danger" type="button"><i class="ti ti-x"></i>ปฏิเสธ</button>
          <button data-plan-id="${p.id}" data-plan-title="${encodeURIComponent(p.title||'')}" onclick="openAuditPlanModal(this.dataset.planId, decodeURIComponent(this.dataset.planTitle))" class="plan-btn" type="button"><i class="ti ti-history"></i>ประวัติ</button>
        </div>
      </div>
      ${cnt > 0 ? `<div id="${cacheId}" class="plan-items-panel"></div>` : ''}
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
    'ยี่ห้อ/รุ่น','Range','Tolerance (±)','S/N','Asset No.','หน่วยงาน','ID Code','CERT.',
    'วันสอบเทียบ','วันครบกำหนด','เหลือ (วัน)','ความถี่สอบเทียบ','ภายใน/ภายนอก','สถานะ','Remark'];

  const rows = filteredData.map((d, i) => {
    const days = d.days_left;
    const status = days === null ? '–' : days < 0 ? 'เลยกำหนด' : days <= 30 ? 'ใกล้ครบ' : 'ปกติ';
    return [i+1, d.instrument_type||'', d.machine_name||'', d.location||'', d.instrument_name||'',
      d.brand||'', d.range_val||'', d.tolerance ? '±'+d.tolerance : '', d.serial_no||'', d.asset_no||'',
      d.department||'', d.id_code||'', d.cert_no||'', d.cal_date||'', d.due_date||'',
      days !== null ? days : '', d.cal_frequency||'', d.cal_type||'', status, d.remark||''];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{wch:4},{wch:32},{wch:20},{wch:16},{wch:24},{wch:20},{wch:12},{wch:14},
    {wch:16},{wch:14},{wch:12},{wch:20},{wch:16},{wch:14},{wch:14},{wch:10},{wch:20},{wch:14},{wch:12},{wch:24}];
  XLSX.utils.book_append_sheet(wb, ws, 'เครื่องมือ');
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  XLSX.writeFile(wb, 'calibration_' + today + '.xlsx');
  showToast('✅ Export ' + filteredData.length + ' รายการสำเร็จ', 'success');
}

// ====================================================
// IMPORT EXCEL
// ====================================================
let importRows = [];
let importAnalysis = {
  existingMap: {},
  actionIds: [],
  unchangedIds: [],
  duplicateIds: [],
  invalidRows: [],
  newCount: 0,
  updateCount: 0,
  unchangedCount: 0,
};

const IMPORT_DB_SELECT = [
  'id','instrument_type','machine_name','location','instrument_name','brand','model','range_val','tolerance',
  'serial_no','asset_no','department','id_code','cert_no','cal_date','due_date','cal_frequency','cal_type','remark',
  'prev_cert_no','prev_cal_date',
  'resolution_text','usage_min','usage_max','usage_frequency','product_group','usp_type',
  'capacity','resolution','range_profile'
].join(',');

const IMPORT_COMPARE_FIELDS = [
  'instrument_type','machine_name','location','instrument_name','brand','model','range_val','tolerance',
  'serial_no','asset_no','department','cert_no','cal_date','due_date','cal_frequency','cal_type','remark',
  'prev_cert_no','prev_cal_date',
  'resolution_text','usage_min','usage_max','usage_frequency','product_group','usp_type'
];

const IMPORT_COL_MAP = {
  'ประเภทเครื่องมือ':'instrument_type','instrument_type':'instrument_type',
  'ชื่อเครื่องจักร':'machine_name','machine_name':'machine_name',
  'สถานที่ใช้งาน':'location','สถานที่':'location','location':'location',
  'ชื่อเครื่องมือ':'instrument_name','เครื่องมือ':'instrument_name','instrument_name':'instrument_name',
  'ยี่ห้อ/รุ่น':'brand','ยี่ห้อ':'brand','brand':'brand','manufacturer':'brand',
  'รุ่น':'model','รุ่น (model)':'model','รุ่น(model)':'model','model':'model',
  'range':'range_val','range_val':'range_val',
  'tolerance (±)':'tolerance','tolerance':'tolerance',
  's/n':'serial_no','serial_no':'serial_no','serial no.':'serial_no',
  'asset no.':'asset_no','asset no':'asset_no','asset':'asset_no','asset_no':'asset_no','assetno':'asset_no',
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
  // ฟิลด์จากบัญชีรายการ (master register)
  'ความละเอียด':'resolution_text','resolution':'resolution_text','resolution_text':'resolution_text',
  'ใช้งานต่ำสุด':'usage_min','minimum usage':'usage_min','usage_min':'usage_min',
  'ใช้งานสูงสุด':'usage_max','maximum usage':'usage_max','usage_max':'usage_max',
  'ความถี่ใช้งาน':'usage_frequency','usage frequency':'usage_frequency','usage_frequency':'usage_frequency',
  'กลุ่มสินค้า':'product_group','product group':'product_group','product_group':'product_group',
  'usp type':'usp_type','type :a,b,c':'usp_type','type a,b,c':'usp_type','usp_type':'usp_type',
};

// ===== บัญชีรายการ (ข้อความ) → ตัวเลขสำหรับ cal engine (เฉพาะเครื่องชั่ง) =====
// แปลงหน่วยเป็นกรัมเสมอ: "0.002 kg" → 2 · "0.01 g" → 0.01 · ">800kg" → 800000
function regToGrams(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (!Number.isFinite(n)) return null;
  if (/kg|kilogram/i.test(s)) n *= 1000;
  else if (/\bmg\b/i.test(s)) n /= 1000;
  return n;
}
// แตก band ที่ต่อด้วย " / " (multi-interval) → ["0.002 kg","0.005 kg",...]
function regSplitBands(str) {
  return String(str || '').split('/').map(x => x.trim()).filter(Boolean);
}
// ขอบบนของย่าน: "0-3100 g" → 3100 · "0 - 1500 kg" → 1500000 (เครื่องหมาย - = คั่น ไม่ใช่ลบ)
function regRangeUpperG(rangeStr) {
  const s = String(rangeStr || '').trim();
  if (!s) return null;
  const isKg = /kg|kilogram/i.test(s);
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  let up = Math.max(...nums);
  if (isKg) up *= 1000;
  return up;
}
// แปลงข้อมูลบัญชีของแถวเครื่องชั่ง → { capacity, resolution, range_profile } (กรัม) · ไม่ใช่เครื่องชั่ง → null
function parseBalanceRegister(row, extraTypeText) {
  // ตรวจว่าเป็นเครื่องชั่งจากชื่อในแถว หรือจากทะเบียนเดิม (เผื่อไฟล์ import ไม่มีคอลัมน์ประเภท)
  const hay = [row.instrument_type, row.instrument_name, extraTypeText].filter(Boolean).join(' ');
  if (!/balance/i.test(hay)) return null;
  const resBands = regSplitBands(row.resolution_text).map(regToGrams).filter(n => n != null && n > 0);
  const maxBands = regSplitBands(row.usage_max).map(regToGrams).filter(n => n != null && n > 0);
  const tolBands = regSplitBands(row.tolerance).map(regToGrams).filter(n => n != null && n > 0);
  const rangeUpper = regRangeUpperG(row.range_val);

  const capCands = [rangeUpper, maxBands.length ? Math.max(...maxBands) : null].filter(n => n != null && n > 0);
  const capacity = capCands.length ? Math.max(...capCands) : null;
  const resolution = resBands.length ? Math.min(...resBands) : null;
  if (capacity == null && resolution == null) return null;

  const out = {};
  if (capacity != null) out.capacity = capacity;
  if (resolution != null) out.resolution = resolution;

  const segCount = Math.max(resBands.length, maxBands.length, tolBands.length);
  const isMulti = segCount > 1;
  const lastUnitKg = /kg|kilogram/i.test(row.tolerance || '');

  if (isMulti) {
    const prof = [];
    for (let i = 0; i < segCount; i++) {
      let to = (maxBands[i] != null) ? maxBands[i] : null;
      if (i === segCount - 1 && capacity != null) to = capacity; // ย่านสุดท้ายให้ถึง Max
      if (to == null || !(to > 0)) continue;
      const d = (resBands[i] != null) ? resBands[i] : (resBands.length ? resBands[resBands.length - 1] : null);
      const tol = (tolBands[i] != null) ? tolBands[i] : (tolBands.length ? tolBands[tolBands.length - 1] : null);
      prof.push({ to, d: d != null ? d : null, tol: tol != null ? tol : null, unit: 'g' });
    }
    prof.sort((a, b) => a.to - b.to);
    if (prof.length) out.range_profile = prof;
  } else if (lastUnitKg && capacity != null && resolution != null && tolBands.length) {
    // ย่านเดียวแต่ tolerance เป็น kg → ทำ range_profile 1 segment เพื่อให้หน่วยถูก (เลี่ยง text regex อ่านเป็นกรัม)
    out.range_profile = [{ to: capacity, d: resolution, tol: tolBands[0], unit: 'g' }];
  }
  return out;
}

function downloadTemplate() {
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }
  const headers = ['ประเภทเครื่องมือ','ชื่อเครื่องจักร','สถานที่ใช้งาน','ชื่อเครื่องมือ',
    'ยี่ห้อ','รุ่น','Range','Tolerance (±)','S/N','Asset No.','หน่วยงาน','ID Code','CERT.',
    'วันสอบเทียบ','วันครบกำหนด','ความถี่สอบเทียบ','ภายใน/ภายนอก','Remark',
    'ความละเอียด','ใช้งานต่ำสุด','ใช้งานสูงสุด','ความถี่ใช้งาน','กลุ่มสินค้า','USP Type'];
  const example = ['เครื่องชั่ง (Balance)','MIX 1000L','ตึก 5/1','Electronic Balance',
    'AND','GF-3000','30 kg','0.01 g','A1234567','701267','PMP1','PMP1BB01-WI01','25B001-0',
    '2025-01-15','2026-01-15','1 ครั้ง/ปี','ภายนอก','',
    '0.01 g','1 g','3000 g','Every day','Drug product','B'];
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
  importAnalysis = {
    existingMap: {},
    actionIds: [],
    unchangedIds: [],
    duplicateIds: [],
    invalidRows: [],
    newCount: 0,
    updateCount: 0,
    unchangedCount: 0,
  };
  document.getElementById('importStep1').style.display = 'block';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importProgress').style.display = 'none';
  const fi = document.getElementById('importFileInput');
  if (fi) fi.value = '';
}

function normalizeImportBlank(value) {
  const s = String(value ?? '').trim();
  return (s === '' || s === '–' || s === '-') ? null : s;
}

function normalizeImportInstrumentType(row) {
  const raw = String(row.instrument_type || '').trim();
  if (!raw) return raw;
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  if (key === 'เครื่องชั่ง' || key === 'balance' || key === 'เครื่องชั่ง (balance)' || key === 'electronic balance' || key === 'analytical balance' || key === 'precision balance' || key === 'electronic scale' || key === 'weighing scale' || key === 'weighing machine') return 'เครื่องชั่ง (Balance)';
  if (key === 'ตุ้มน้ำหนักมาตรฐาน' || key === 'mass' || key === 'weight' || key === 'ตุ้มน้ำหนักมาตรฐาน (mass)') return 'ตุ้มน้ำหนักมาตรฐาน (Mass)';
  if (key === 'มวล/น้ำหนัก' || key === 'มวล/น้ำหนัก (mass/weight)' || key === 'mass/weight') {
    const code = typeof getCertTypeCode === 'function' ? getCertTypeCode(raw, row.instrument_name || '') : '';
    return code === 'M' ? 'ตุ้มน้ำหนักมาตรฐาน (Mass)' : 'เครื่องชั่ง (Balance)';
  }
  return raw;
}

function importComparableValue(value, field) {
  const normalized = normalizeImportBlank(value);
  if (normalized === null) return '';
  if (['cal_date','due_date','prev_cal_date'].includes(field)) return String(normalized).slice(0, 10);
  return String(normalized).trim();
}

function parseImportDateCell(value, rowNo, header) {
  if (value === '' || value === null || value === undefined) return { value: '' };
  if (value instanceof Date) {
    const y = value.getFullYear(), m = String(value.getMonth()+1).padStart(2,'0'), d = String(value.getDate()).padStart(2,'0');
    return { value: y+'-'+m+'-'+d };
  }
  if (typeof value === 'number' && value > 40000 && value < 60000) {
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y = dt.getUTCFullYear(), mo = String(dt.getUTCMonth()+1).padStart(2,'0'), dd = String(dt.getUTCDate()).padStart(2,'0');
    return { value: y+'-'+mo+'-'+dd };
  }

  const raw = String(value || '').trim();
  if (!raw || raw === '–' || raw === '-') return { value: '' };

  let y, m, d;
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else {
    match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (match) {
      d = Number(match[1]); m = Number(match[2]); y = Number(match[3]);
      if (y < 100) y += 2000;
    }
  }

  if (!match) return { value: raw, error: `แถว ${rowNo}: ${header} ต้องเป็นวันที่ แต่พบ "${raw}"` };
  if (y > 2400) y -= 543;

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { value: raw, error: `แถว ${rowNo}: ${header} วันที่ไม่ถูกต้อง "${raw}"` };
  }

  return { value: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` };
}

function prepareImportRowForDb(row) {
  const clean = {};
  Object.entries(row).forEach(([k, v]) => {
    if (k.startsWith('__')) return;
    clean[k] = normalizeImportBlank(v);
  });
  if (!clean.due_date && clean.cal_date && clean.cal_frequency) {
    clean.due_date = calcDueDateStr(clean.cal_date, clean.cal_frequency);
  }
  if (clean.instrument_type) {
    clean.instrument_type = normalizeImportInstrumentType(clean);
    clean.category = clean.instrument_type;
  }
  return clean;
}

function getImportDiff(existing, cleanRow) {
  if (!existing) return [];
  return IMPORT_COMPARE_FIELDS.filter(field => {
    if (!Object.prototype.hasOwnProperty.call(cleanRow, field)) return false;
    return importComparableValue(existing[field], field) !== importComparableValue(cleanRow[field], field);
  });
}

async function fetchExistingImportRows(idCodes) {
  const uniqueCodes = [...new Set(idCodes.map(v => String(v || '').trim()).filter(Boolean))];
  const existingMap = {};
  for (let i = 0; i < uniqueCodes.length; i += 100) {
    const chunk = uniqueCodes.slice(i, i + 100);
    const { data, error } = await sb.from('instruments').select(IMPORT_DB_SELECT).in('id_code', chunk);
    if (error) throw error;
    (data || []).forEach(row => { existingMap[row.id_code] = row; });
  }
  return existingMap;
}

function analyzeImportRows(validRows, existingMap) {
  const countsById = {};
  validRows.forEach(row => { countsById[row.id_code] = (countsById[row.id_code] || 0) + 1; });
  const duplicateIds = Object.keys(countsById).filter(id => countsById[id] > 1);
  let newCount = 0, updateCount = 0, unchangedCount = 0;
  const actionIds = [], unchangedIds = [];

  validRows.forEach(row => {
    const existing = existingMap[row.id_code];
    const clean = prepareImportRowForDb(row);
    if (!existing) {
      newCount += 1;
      actionIds.push(row.id_code);
      return;
    }
    const diff = getImportDiff(existing, clean);
    if (diff.length) {
      updateCount += 1;
      actionIds.push(row.id_code);
    } else {
      unchangedCount += 1;
      unchangedIds.push(row.id_code);
    }
  });

  return { existingMap, actionIds, unchangedIds, duplicateIds, newCount, updateCount, unchangedCount };
}

function importStatusBadge(row) {
  if (!row.id_code) return '<span style="color:var(--red);font-weight:700">ไม่มี ID Code</span>';
  if (importAnalysis.duplicateIds.includes(row.id_code)) return '<span style="color:var(--red);font-weight:700">ID ซ้ำในไฟล์</span>';
  if (importAnalysis.unchangedIds.includes(row.id_code)) return '<span style="color:var(--text3);font-weight:700">ซ้ำเดิม</span>';
  if (importAnalysis.existingMap[row.id_code]) return '<span style="color:var(--amber);font-weight:700">อัปเดต</span>';
  return '<span style="color:var(--green);font-weight:700">ใหม่</span>';
}

function handleImportFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
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
          if (['cal_date','due_date','prev_cal_date'].includes(field)) {
            const parsed = parseImportDateCell(val, rowIdx + 2, excelHeaders[ci] || field);
            val = parsed.value;
            if (parsed.error) errors.push(parsed.error);
          } else if (val instanceof Date) {
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
        if (obj.instrument_type) {
          obj.instrument_type = normalizeImportInstrumentType(obj);
          obj.category = obj.instrument_type;
        }
        if (!obj.id_code) errors.push('แถว '+(rowIdx+2)+': ไม่มี ID Code');
        return obj;
      }).filter(o => Object.keys(o).length > 0);

      const validRows = importRows.filter(r => r.id_code);
      let analysisError = '';
      try {
        const existingMap = await fetchExistingImportRows(validRows.map(r => r.id_code));
        importAnalysis = {
          ...analyzeImportRows(validRows, existingMap),
          invalidRows: errors,
        };
      } catch (checkError) {
        analysisError = 'ตรวจข้อมูลซ้ำไม่สำเร็จ: ' + checkError.message;
        importAnalysis = {
          existingMap: {},
          actionIds: validRows.map(r => r.id_code),
          unchangedIds: [],
          duplicateIds: [],
          invalidRows: errors,
          newCount: validRows.length,
          updateCount: 0,
          unchangedCount: 0,
        };
      }

      if (importAnalysis.duplicateIds.length) {
        errors.push('พบ ID Code ซ้ำในไฟล์: ' + importAnalysis.duplicateIds.slice(0,8).join(', ') + (importAnalysis.duplicateIds.length > 8 ? ' ...' : ''));
      }
      if (analysisError) errors.push(analysisError);

      const previewColumns = excelHeaders
        .map((h, i) => fieldMap[i] ? { header: h, field: fieldMap[i] } : null)
        .filter(Boolean);
      document.getElementById('importPreviewHead').innerHTML =
        '<tr>'+previewColumns.map(c => '<th style="padding:8px 12px;white-space:nowrap;text-align:left;font-size:12px">'+escapeHtmlText(c.header)+'</th>').join('')+
        '<th style="padding:8px 12px;white-space:nowrap;text-align:left;font-size:12px">ผลตรวจ</th></tr>';
      document.getElementById('importPreviewBody').innerHTML =
        importRows.slice(0,5).map(r =>
          '<tr>'+previewColumns.map(c => '<td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:12px">'+escapeHtmlText(r[c.field]||'–')+'</td>').join('')+
          '<td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:12px">'+importStatusBadge(r)+'</td></tr>'
        ).join('');

      document.getElementById('importSummary').innerHTML =
        '📋 พบ <strong>'+importRows.length+'</strong> แถว &nbsp;|&nbsp; ✅ Valid: <strong>'+validRows.length+'</strong>' +
        ' &nbsp;|&nbsp; 🆕 ใหม่: <strong>'+importAnalysis.newCount+'</strong>' +
        ' &nbsp;|&nbsp; ✏️ อัปเดต: <strong>'+importAnalysis.updateCount+'</strong>' +
        ' &nbsp;|&nbsp; 🔁 ซ้ำเดิม: <strong>'+importAnalysis.unchangedCount+'</strong>' +
        ' &nbsp;|&nbsp; ❌ ข้าม: <strong>'+(importRows.length-validRows.length)+'</strong> (ไม่มี ID Code)';
      const errEl = document.getElementById('importErrors');
      if (errors.length) {
        errEl.style.display = 'block';
        errEl.innerHTML = '⚠️ '+errors.slice(0,5).map(escapeHtmlText).join('<br>')+(errors.length>5?'<br>...และอีก '+(errors.length-5)+' แถว':'');
      } else if (importAnalysis.unchangedCount && !importAnalysis.actionIds.length) {
        errEl.style.display = 'block';
        errEl.innerHTML = 'ℹ️ ข้อมูลทั้งหมดมีอยู่แล้วและไม่มีการเปลี่ยนแปลง จึงไม่มีรายการให้ Import';
      } else { errEl.style.display = 'none'; }
      document.getElementById('confirmImportBtn').disabled =
        validRows.length === 0 || errors.length > 0 || importAnalysis.actionIds.length === 0;
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
  document.getElementById('importProgressBar').style.width = '0%';
  document.getElementById('importProgressText').textContent = 'กำลังตรวจข้อมูล...';
  const CHUNK = 50;
  let done = 0, success = 0, failed = 0, failedCodes = [];
  try {
    const countsById = {};
    validRows.forEach(row => { countsById[row.id_code] = (countsById[row.id_code] || 0) + 1; });
    const duplicateIds = Object.keys(countsById).filter(id => countsById[id] > 1);
    if (duplicateIds.length) {
      document.getElementById('importStep2').style.display = 'block';
      document.getElementById('importProgress').style.display = 'none';
      document.getElementById('confirmImportBtn').disabled = false;
      showToast('พบ ID Code ซ้ำในไฟล์: ' + duplicateIds.slice(0,5).join(', '), 'error');
      return;
    }

    // ดึงข้อมูลเดิมของทุก id_code ที่จะ import มาเปรียบเทียบ
    const existingMap = await fetchExistingImportRows(validRows.map(r => r.id_code));
    const analysis = analyzeImportRows(validRows, existingMap);
    importAnalysis = { ...analysis, invalidRows: importAnalysis.invalidRows || [] };
    const cleanRows = validRows
      .map(row => prepareImportRowForDb(row))
      .filter(row => {
        const existing = existingMap[row.id_code];
        return !existing || getImportDiff(existing, row).length > 0;
      });
    const skipped = validRows.length - cleanRows.length;
    const created = cleanRows.filter(row => !existingMap[row.id_code]).length;
    const updated = cleanRows.length - created;

    if (!cleanRows.length) {
      document.getElementById('importStep2').style.display = 'block';
      document.getElementById('importProgress').style.display = 'none';
      document.getElementById('confirmImportBtn').disabled = true;
      showToast('ไม่มีข้อมูลใหม่หรือข้อมูลที่เปลี่ยนแปลงให้ Import', 'success');
      return;
    }

    for (let i = 0; i < cleanRows.length; i += CHUNK) {
      const cleanChunk = cleanRows.slice(i, i + CHUNK);

      // บันทึกประวัติ calibration_history เฉพาะรายการที่ cert_no หรือ cal_date เปลี่ยน
      const historyRows = [];
      cleanChunk.forEach(row => {
        const orig = existingMap[row.id_code];
        if (!orig) return; // รายการใหม่ ยังไม่มีประวัติ
        const certChanged = Object.prototype.hasOwnProperty.call(row, 'cert_no') &&
          orig.cert_no && importComparableValue(orig.cert_no, 'cert_no') !== importComparableValue(row.cert_no, 'cert_no');
        const dateChanged = Object.prototype.hasOwnProperty.call(row, 'cal_date') &&
          orig.cal_date && importComparableValue(orig.cal_date, 'cal_date') !== importComparableValue(row.cal_date, 'cal_date');
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
      if (historyRows.length) {
        const { error: histErr } = await sb.from('calibration_history').insert(historyRows);
        if (histErr) {
          console.error('[Import] calibration_history insert error:', histErr.message, histErr.details, histErr.hint);
          showToast('⚠️ บันทึกประวัติไม่สำเร็จ: ' + histErr.message, 'error');
        }
      }

      const { error } = await sb.from('instruments')
        .upsert(cleanChunk, { onConflict: 'id_code', ignoreDuplicates: false });
      if (error) {
        failed += cleanChunk.length;
        failedCodes.push(...cleanChunk.map(r => r.id_code));
        console.error('upsert error:', error.message, error.details, error.hint);
        document.getElementById('importProgressText').textContent = '❌ ' + error.message;
        document.getElementById('importStep2').style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        showToast('❌ Import ผิดพลาด: ' + error.message, 'error');
        return;
      } else {
        success += cleanChunk.length;
      }
      done += cleanChunk.length;
      const pct = Math.round(done/cleanRows.length*100);
      document.getElementById('importProgressBar').style.width = pct+'%';
      document.getElementById('importProgressText').textContent =
        'กำลัง import... '+done+'/'+cleanRows.length+' รายการ' + (skipped ? ' (ข้ามซ้ำเดิม '+skipped+' รายการ)' : '');
      await new Promise(r => setTimeout(r, 30));
    }

    // เติมค่าตัวเลขสำหรับเครื่องชั่ง (capacity/resolution/range_profile) → ใช้สอบเทียบได้เลย
    // เติมเฉพาะช่องที่ว่าง — ไม่ทับค่าที่ปรับจากการสอบเทียบ · คีย์สม่ำเสมอกัน PostgREST NULL-clobber
    try {
      const balNumRows = [];
      validRows.forEach(row => {
        const ex = existingMap[row.id_code];
        const exType = ex ? ((ex.instrument_type || '') + ' ' + (ex.instrument_name || '')) : '';
        const parsed = parseBalanceRegister(row, exType);
        if (!parsed) return;
        const exHasCap  = ex && ex.capacity != null;
        const exHasRes  = ex && ex.resolution != null;
        const exHasProf = ex && Array.isArray(ex.range_profile) && ex.range_profile.length > 0;
        if (exHasCap && exHasRes && exHasProf) return; // มีครบแล้ว ไม่ต้องแตะ
        balNumRows.push({
          id_code: row.id_code,
          capacity:      exHasCap  ? ex.capacity     : (parsed.capacity ?? null),
          resolution:    exHasRes  ? ex.resolution   : (parsed.resolution ?? null),
          range_profile: exHasProf ? ex.range_profile : (parsed.range_profile ?? null),
        });
      });
      if (balNumRows.length) {
        const { error: numErr } = await sb.from('instruments')
          .upsert(balNumRows, { onConflict: 'id_code', ignoreDuplicates: false });
        if (numErr) console.warn('[Import] balance numeric fill error:', numErr.message);
      }
    } catch (numEx) { console.warn('[Import] balance numeric fill exception:', numEx && numEx.message); }

    await logAudit('แก้ไข', {
      id_code: 'IMPORT_BATCH',
      instrument_name: 'Import: เพิ่ม '+created+' / อัปเดต '+updated+' / ซ้ำเดิม '+skipped+' รายการ'
    }, null);
    const msg = '✅ Import สำเร็จ '+success+' รายการ' +
      ' (เพิ่ม '+created+', อัปเดต '+updated+(skipped ? ', ข้ามซ้ำเดิม '+skipped : '')+')' +
      (failed ? ' | ❌ ล้มเหลว '+failed+' รายการ' : '');
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

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('notifWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const ia = document.getElementById('importUploadArea');
  if (!ia) return;
  ia.addEventListener('dragover', e => { e.preventDefault(); ia.classList.add('dragover'); });
  ia.addEventListener('dragleave', () => ia.classList.remove('dragover'));
  ia.addEventListener('drop', e => { e.preventDefault(); ia.classList.remove('dragover'); handleImportFile(e.dataTransfer.files[0]); });
});


// ====================================================

// ====================================================
// PLAN PAGE — schedule matrix and export helpers
// ====================================================
// PLAN PAGE
// ====================================================
const MONTH_NAMES_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                         'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
let planSchedule = {};
let planStatusMap = {}; // instrument_id → {status, title, planned_date}

// โหลดสถานะแผนจาก Supabase เพื่อแสดงในตาราง
async function loadPlanStatusMap() {
  try {
    const { data } = await sb.from('calibration_plan_items')
      .select('instrument_id, calibration_plans!inner(status, title, planned_date)')
      .in('calibration_plans.status', ['pending_plan','planned','pending_cert','completed']);
    planStatusMap = {};
    if (data) {
      data.forEach(item => {
        const p = item.calibration_plans;
        planStatusMap[item.instrument_id] = { status: p.status, title: p.title, planned_date: p.planned_date };
      });
    }
    renderTable(); // re-render ตารางหลัง load
  } catch(e) { /* ignore */ }
}

function initOldPlanPage() {
  const planMonth = document.getElementById('planMonth');
  const planYear  = document.getElementById('planYear');
  if (planMonth && !planMonth.dataset.init) {
    const now = new Date();
    planMonth.value = now.getMonth() + 1;
    const buddhistYear = now.getFullYear() + 543;
    planYear.value = buddhistYear;
    planMonth.dataset.init = '1';
  }
  // Populate dept/type filters
  const depts = [...new Set(allData.map(d => d.department).filter(Boolean))].sort();
  const types = [...new Set(allData.map(getPlanInstrumentType).filter(Boolean))].sort();
  const planDept = document.getElementById('planDept');
  const planType = document.getElementById('planType');
  if (planDept && planDept.options.length <= 1) {
    depts.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; planDept.appendChild(o); });
  }
  if (planType && planType.options.length <= 1) {
    types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t.split(' (')[0]; planType.appendChild(o); });
  }
}

function getPlanData() {
  const month  = parseInt(document.getElementById('planMonth').value);
  const yearBE = parseInt(document.getElementById('planYear').value);
  const yearCE = yearBE - 543;
  const dept   = document.getElementById('planDept').value;
  const type   = document.getElementById('planType').value;
  const calType= document.getElementById('planCalType').value;

  return allData.filter(d => {
    if (!d.due_date) return false;
    const dd = new Date(d.due_date);
    if (dd.getFullYear() !== yearCE || dd.getMonth() + 1 !== month) return false;
    if (dept && d.department !== dept) return false;
    if (type && getPlanInstrumentType(d) !== type) return false;
    if (calType && d.cal_type !== calType) return false;
    return true;
  });
}

function renderPlanTable() {
  const data = getPlanData();
  const tbody = document.getElementById('planTableBody');
  const summary = document.getElementById('planSummary');
  const empty   = document.getElementById('planEmpty');

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="no-data">ไม่มีเครื่องมือที่ครบกำหนดในช่วงนี้</td></tr>';
    summary.style.display = 'none';
    empty.style.display   = 'block';
    return;
  }
  empty.style.display   = 'none';
  summary.style.display = 'grid';

  tbody.innerHTML = data.map((d, i) => {
    const days = d.days_left;
    let badge, daysColor;
    if (days === null)   { badge = '<span class="badge badge-gray">–</span>'; daysColor = 'var(--text3)'; }
    else if (days < 0)   { badge = '<span class="badge badge-red">🔴 เลยกำหนด</span>'; daysColor = 'var(--red)'; }
    else if (days <= 30) { badge = '<span class="badge badge-amber">🟡 ใกล้ครบ</span>'; daysColor = 'var(--amber)'; }
    else                 { badge = '<span class="badge badge-green">🟢 ปกติ</span>'; daysColor = 'var(--green)'; }

    const scheduled = planSchedule[d.id] || '';
    return `<tr id="planRow_${d.id}">
      <td style="color:var(--text3);font-size:13px">${i+1}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:600">${d.id_code||'–'}</td>
      <td>${d.instrument_name||'–'}</td>
      <td style="font-size:13px;color:var(--text2)">${d.brand||'–'}</td>
      <td><strong>${d.department||'–'}</strong></td>
      <td style="font-size:13px;color:var(--text2)">${d.location||'–'}</td>
      <td style="font-family:var(--mono);font-size:13px">${formatDate(d.due_date)}</td>
      <td><span style="font-family:var(--mono);font-size:13px;font-weight:600;color:${daysColor}">${days !== null ? days : '–'}</span></td>
      <td>${d.cal_type ? '<span class="badge '+(d.cal_type==='ภายใน'?'badge-blue':'badge-purple')+'">'+(d.cal_type==='ภายใน'?'🏭 ภายใน':'🌐 ภายนอก')+'</span>' : '–'}</td>
      <td>${badge}</td>
      <td>
        <input type="date" class="plan-day-input" value="${scheduled}"
               onchange="setPlanSchedule(${d.id}, this.value)"
               title="เลือกวันนัดสอบเทียบ">
      </td>
    </tr>`;
  }).join('');

  updatePlanSummary(data);
}

function setPlanSchedule(id, dateVal) {
  if (dateVal) planSchedule[id] = dateVal;
  else delete planSchedule[id];
  updatePlanSummaryFromCurrent();
  // Audit log
  const inst = allData.find(d => d.id == id);
  if (dateVal) {
    logAudit('วางแผนสอบเทียบ', inst || { id, id_code: String(id) }, { วันที่นัด: { from: planSchedule[id] || '–', to: dateVal } });
  } else {
    logAudit('ยกเลิกแผน', inst || { id, id_code: String(id) }, null);
  }
}

function updatePlanSummaryFromCurrent() {
  const data = getPlanData();
  updatePlanSummary(data);
}

function updatePlanSummary(data) {
  const total   = data.length;
  const sched   = data.filter(d => planSchedule[d.id]).length;
  const pending = total - sched;
  const overdue = data.filter(d => d.days_left !== null && d.days_left < 0).length;
  document.getElementById('planSumTotal').textContent   = total;
  document.getElementById('planSumSched').textContent   = sched;
  document.getElementById('planSumPending').textContent = pending;
  document.getElementById('planSumOverdue').textContent = overdue;
}

// ====================================================
// EXPORT FRM-EIB04 (AOA-based, reliable)
// ====================================================
function exportFRMEIB04() {
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }

  const data = getPlanData();
  if (!data.length) { showToast('ไม่มีข้อมูลในแผน กรุณาค้นหาก่อน', 'error'); return; }

  try {
    const monthNum   = parseInt(document.getElementById('planMonth').value);
    const yearBE     = parseInt(document.getElementById('planYear').value);
    const yearCE     = yearBE - 543;
    const monthNamesTH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const monthNamesEN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthNameTH  = monthNamesTH[monthNum - 1];
    const monthNameEN  = monthNamesEN[monthNum - 1];
    const dept      = document.getElementById('planDept').value || '–';
    const iType     = document.getElementById('planType').value || '';
    const calTypeVal= document.getElementById('planCalType').value;
    const typeName  = iType ? (iType.split(' (')[1] || '').replace(')','') || iType : 'ALL';
    const isInternal= calTypeVal === 'ภายใน';
    const isExternal= calTypeVal === 'ภายนอก';

    // Template constants
    const DATA_SLOTS = 17;  // rows 10-26
    const TMPL_ROWS  = 30;  // template height in rows
    const totalPages = Math.ceil(data.length / DATA_SLOTS);

    // Column widths matching Book1.xlsx exactly
    const COL_WIDTHS = [
      4.3, 18.1, 12.6, 5.0, 7.4,
      ...Array(31).fill(2.4),
      10.6, 10.4, 6.7, 7.7, 5.3, 5.1, 7.7, 10.1, 9.1
    ];

    // Build merged-cell list for one template block at rowOffset
    function getMerges(ro) {
      return [
        // Row 3: Title A3:AR3
        {s:{r:ro+2,c:0}, e:{r:ro+2,c:43}},
        // Row 4
        {s:{r:ro+3,c:18}, e:{r:ro+3,c:22}},  // S4:W4 month name
        {s:{r:ro+3,c:26}, e:{r:ro+3,c:30}},  // AA4:AE4 year
        // Row 5
        {s:{r:ro+4,c:0},  e:{r:ro+4,c:19}},  // A5 group name
        {s:{r:ro+4,c:20}, e:{r:ro+4,c:28}},  // U5:AC5 type
        {s:{r:ro+4,c:30}, e:{r:ro+4,c:35}},  // AE5 unit label
        {s:{r:ro+4,c:36}, e:{r:ro+4,c:38}},  // AK5:AM5 unit value
        {s:{r:ro+4,c:40}, e:{r:ro+4,c:40}},  // AO5 section label
        {s:{r:ro+4,c:41}, e:{r:ro+4,c:43}},  // AP5:AR5 section value
        // Row 6
        {s:{r:ro+5,c:1},  e:{r:ro+5,c:4}},   // B6:E6 internal
        {s:{r:ro+5,c:5},  e:{r:ro+5,c:19}},  // F6:T6 external
        {s:{r:ro+5,c:25}, e:{r:ro+5,c:27}},  // Z6:AB6 Drug
        {s:{r:ro+5,c:34}, e:{r:ro+5,c:36}},  // AI6 Cosmetic
        {s:{r:ro+5,c:39}, e:{r:ro+5,c:43}},  // AN6 Other
        // Rows 7-9: header merges (span 3 rows each)
        {s:{r:ro+6,c:0},  e:{r:ro+8,c:0}},   // A7:A9 Item
        {s:{r:ro+6,c:1},  e:{r:ro+8,c:1}},   // B7:B9 Name
        {s:{r:ro+6,c:2},  e:{r:ro+8,c:2}},   // C7:C9 ID CODE
        {s:{r:ro+6,c:3},  e:{r:ro+8,c:3}},   // D7:D9 Location
        {s:{r:ro+6,c:4},  e:{r:ro+8,c:4}},   // E7:E9 Due Date
        {s:{r:ro+6,c:5},  e:{r:ro+6,c:35}},  // F7:AJ7 Month
        {s:{r:ro+6,c:36}, e:{r:ro+6,c:43}},  // AK7:AR7 Action
        // Row 8 day cells (merge each day row 8-9)
        ...[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(c => ({s:{r:ro+7,c}, e:{r:ro+8,c}})),
        // Action sub-headers
        {s:{r:ro+7,c:36}, e:{r:ro+8,c:36}},  // AK8:AK9
        {s:{r:ro+7,c:37}, e:{r:ro+8,c:37}},  // AL8:AL9
        {s:{r:ro+7,c:38}, e:{r:ro+8,c:38}},  // AM8:AM9
        {s:{r:ro+7,c:39}, e:{r:ro+7,c:41}},  // AN8:AP8 Recorded by
        {s:{r:ro+7,c:42}, e:{r:ro+7,c:43}},  // AQ8:AR8 Reviewed by
        // Row 9 signed/date
        {s:{r:ro+8,c:39}, e:{r:ro+8,c:39}},
        {s:{r:ro+8,c:40}, e:{r:ro+8,c:40}},
        {s:{r:ro+8,c:42}, e:{r:ro+8,c:42}},
        {s:{r:ro+8,c:43}, e:{r:ro+8,c:43}},
        // Footer row 27
        {s:{r:ro+26,c:0},  e:{r:ro+26,c:35}},
        {s:{r:ro+26,c:36}, e:{r:ro+26,c:43}},
        {s:{r:ro+27,c:36}, e:{r:ro+27,c:43}},
      ];
    }

    // Build one page AOA (30 rows)
    function buildPage(pageItems, pageNum, startNum) {
      const rows = [];
      // Row 1: empty
      rows.push(Array(44).fill(null));
      // Row 2: empty
      rows.push(Array(44).fill(null));
      // Row 3: Title
      const r3 = Array(44).fill(null); r3[0] = 'Equipment Calibration Plan'; rows.push(r3);
      // Row 4: Month/Year
      const r4 = Array(44).fill(null);
      r4[15]='Month'; r4[18]=monthNameEN; r4[24]='Year'; r4[26]=yearCE;
      rows.push(r4);
      // Row 5: Group / Type / Unit / Section
      const r5 = Array(44).fill(null);
      r5[0]  = 'กลุ่มเครื่องตรวจ เครื่องวัดและเครื่องทดสอบ (Inspection, measuring and testing instruments group) ';
      r5[20] = typeName.toUpperCase();
      r5[30] = 'หน่วยงาน (Unit)';
      r5[36] = dept;
      r5[40] = 'แผนก (Section) ';
      r5[41] = dept;
      rows.push(r5);
      // Row 6: Cal type / Product type
      const r6 = Array(44).fill(null);
      r6[1]  = 'สอบเทียบภายใน (Internal calibration)' + (isInternal?' ✓':'');
      r6[5]  = 'สอบเทียบภายนอก (External calibration)' + (isExternal?' ✓':'');
      r6[25] = 'Drug product';
      r6[34] = 'Cosmetic product';
      r6[39] = 'Other ____________________________';
      rows.push(r6);
      // Row 7: Column headers
      const r7 = Array(44).fill(null);
      r7[0]='Item'; r7[1]='Name of Inspection, measuring and testing instruments';
      r7[2]='ID CODE'; r7[3]='Location'; r7[4]='Due Date'; r7[5]='Month';
      r7[36]='Action by Calibration Laboratory (EIB)';
      rows.push(r7);
      // Row 8: Day numbers 1-31
      const r8 = Array(44).fill(null);
      for (let d=1; d<=31; d++) r8[4+d]=d;
      r8[36]='Certification No.'; r8[37]='Calibration Date'; r8[38]='Agency';
      r8[39]='Recorded  by'; r8[42]='Reviewed by (Supervisor level and above) ';
      rows.push(r8);
      // Row 9: Signed/Date
      const r9 = Array(44).fill(null);
      r9[39]='Signed'; r9[40]='Date'; r9[42]='Signed'; r9[43]='Date';
      rows.push(r9);
      // Rows 10-26: Data (17 slots)
      for (let i=0; i<DATA_SLOTS; i++) {
        const row = Array(44).fill(null);
        const d = pageItems[i];
        if (d) {
          row[0] = startNum + i;
          row[1] = d.instrument_name || '';
          row[2] = d.id_code || '';
          row[3] = d.location || '';
          row[4] = d.due_date ? new Date(d.due_date) : null;
          const sched = planSchedule[d.id];
          if (sched) {
            const sd = new Date(sched);
            if (sd.getMonth()+1===monthNum && sd.getFullYear()===yearCE) {
              const day = sd.getDate();
              if (day>=1 && day<=31) row[4+day] = 'v';
            }
          }
        }
        rows.push(row);
      }
      // Row 27: Prepared/Approved footer
      const rFoot = Array(44).fill(null);
      rFoot[0]  = 'Prepared by :___________(EIB)  Date _____________   Approved by :____________(EIB)  Date ________________ Acknowledge by _____________(Owner) Date _____________';
      rFoot[36] = 'The owner accepts the work by ___________ Date _____________';
      rows.push(rFoot);
      // Row 28: Level notes
      const rLv = Array(44).fill(null);
      rLv[4]  = '  ระดับแผนกขึ้นไป ( Section manager level and above)';
      rLv[20] = 'ระดับหน่วยขึ้นไป ( Supervisor level and above)';
      rLv[36] = 'ระดับหน่วยขึ้นไป ( Supervisor level and above)';
      rows.push(rLv);
      // Row 29: empty
      rows.push(Array(44).fill(null));
      // Row 30: Form ID / Effective Date / Page
      const rForm = Array(44).fill(null);
      rForm[0]  = 'FRM-EIB04 (TP) Rev.03';
      rForm[19] = 'Effective Date: 31/03/2025 (5Y)';
      rForm[43] = 'Page ' + pageNum + ' of ' + totalPages;
      rows.push(rForm);
      return rows;
    }

    // Build all pages into one big AOA
    let allRows = [];
    let allMerges = [];
    for (let pg=1; pg<=totalPages; pg++) {
      const startIdx = (pg-1)*DATA_SLOTS;
      const pageItems = data.slice(startIdx, startIdx+DATA_SLOTS);
      const rowOffset = (pg-1)*TMPL_ROWS;
      allRows = allRows.concat(buildPage(pageItems, pg, startIdx+1));
      allMerges = allMerges.concat(getMerges(rowOffset));
    }

    // Build workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(allRows, {dateNF:'DD/MMM/YYYY'});
    ws['!cols'] = COL_WIDTHS.map(w => ({wch: w}));
    ws['!merges'] = allMerges;

    // Row heights (0-based index matching template)
    const ROW_HEIGHTS = {0:23.25,2:29.25,3:30,4:30,5:25.15,6:21,7:45,8:30,
      9:24,10:24,11:24,12:24,13:24,14:24,15:24,16:24,17:24,18:24,
      19:24,20:24,21:24,22:24,23:24,24:24,25:24,26:33,27:19.5,28:25.5,29:18};
    const rowsArr = [];
    for (let pg=0; pg<totalPages; pg++) {
      const offset = pg*TMPL_ROWS;
      Object.entries(ROW_HEIGHTS).forEach(([ri, ht]) => {
        rowsArr[offset + parseInt(ri)] = {hpt: ht, hpx: Math.round(ht*1.33)};
      });
    }
    ws['!rows'] = rowsArr;

    // ---- Apply cell borders + fonts to all cells ----
    const thin  = {style:'thin',  color:{rgb:'FF000000'}};
    const med   = {style:'medium',color:{rgb:'FF000000'}};
    const thick = {style:'thick', color:{rgb:'FF000000'}};
    const none  = {};

    // Helper: encode column index to letter(s)
    function colLetter(c) { return XLSX.utils.encode_col(c); }

    const wsRange = XLSX.utils.decode_range(ws['!ref']);
    for (let R = wsRange.s.r; R <= wsRange.e.r; R++) {
      for (let C = wsRange.s.c; C <= wsRange.e.c; C++) {
        const addr = XLSX.utils.encode_cell({r:R, c:C});
        if (!ws[addr]) ws[addr] = {t:'z', v:''};
        const cell = ws[addr];

        // Row within template block (0-based)
        const rowInBlock = R % TMPL_ROWS;
        // Is this a header row?
        const isTitle    = rowInBlock === 2;                // Row 3
        const isInfo     = rowInBlock >= 3 && rowInBlock <= 5; // Rows 4-6
        const isColHdr   = rowInBlock >= 6 && rowInBlock <= 8; // Rows 7-9
        const isDataRow  = rowInBlock >= 9 && rowInBlock <= 25;// Rows 10-26
        const isFooter   = rowInBlock >= 26;               // Rows 27+

        // Is this the Agency column (0-based col 38 = AM)?
        const isAgencyCol = C === 38;
        // Day-grid area cols 5-35
        const isDayCol = C >= 5 && C <= 35;
        // Action area cols 36-43
        const isActionCol = C >= 36;

        // Determine borders for this cell
        let top=thin, bottom=thin, left=thin, right=thin;

        // Thick right border on col E (Due Date, C=4) — separates due date from day grid
        if (C === 4) right = med;
        // Thick left border on AK (C=36) — separates day grid from action area
        if (C === 36) left = med;
        // Thick left border on Agency col (C=38) — col 9 separator
        if (C === 38) left = thick;
        // Thick bottom on header rows 6,8,9 (rowInBlock 5,7,8)
        if (rowInBlock === 5) bottom = med;
        if (rowInBlock === 8) bottom = med;
        // Thick outer border on last data row (row 26, rowInBlock=25)
        if (rowInBlock === 25) bottom = med;
        // No side borders in day-grid for cleaner look (keep thin)
        // Title row — thicker bottom
        if (isTitle) bottom = med;

        // Font
        let font = {name:'AngsanaUPC', sz:11};
        if (isTitle)  font = {name:'AngsanaUPC', sz:22, bold:true};
        if (isColHdr) font = {name:'AngsanaUPC', sz:14, bold:true};
        if (isDataRow && C <= 4) font = {name:'AngsanaUPC', sz:14};
        if (isDataRow && isDayCol) font = {name:'AngsanaUPC', sz:14, bold:true};
        if (isInfo)   font = {name:'AngsanaUPC', sz:14, bold:true};
        if (isFooter) font = {name:'AngsanaUPC', sz:13};

        // Alignment
        let alignment = {vertical:'center', wrapText: true};
        if (isTitle) alignment = {horizontal:'center', vertical:'center'};
        if (isColHdr) alignment = {horizontal:'center', vertical:'center', wrapText:true};
        if (isDataRow && C === 1) alignment = {horizontal:'left', vertical:'center'};
        if (isDataRow && (C === 0 || C === 2 || C === 3 || C === 4 || isDayCol))
          alignment = {horizontal:'center', vertical:'center'};

        cell.s = {
          border: {top, bottom, left, right},
          font,
          alignment
        };
      }
    }

    const sheetName = monthNameEN.substring(0,3) + '_' + yearBE;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const fname = 'FRM-EIB04_' + dept.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_') + '_' + monthNameTH + yearBE + '_' + today + '.xlsx';
    XLSX.writeFile(wb, fname);
    showToast('✅ Export สำเร็จ — ' + data.length + ' รายการ (' + totalPages + ' หน้า)', 'success');

  } catch(err) {
    showToast('Export ผิดพลาด: ' + err.message, 'error');
    console.error('exportFRMEIB04 error:', err);
  }
}




// ====================================================
// EXPORT SCHEDULE JSON (for use with generate_frm.py)
// ====================================================
function exportScheduleJSON() {
  const data = getPlanData();
  if (!data.length) {
    showToast('ไม่มีข้อมูลในแผน กรุณาค้นหาก่อน', 'error');
    return;
  }
  const month  = parseInt(document.getElementById('planMonth').value);
  const yearBE = parseInt(document.getElementById('planYear').value);
  const yearCE = yearBE - 543;

  // Build schedule object: { "instrumentId": "YYYY-MM-DD" }
  const schedule = {};
  data.forEach(d => {
    if (planSchedule[d.id]) schedule[String(d.id)] = planSchedule[d.id];
  });

  // Wrap with metadata so user knows which month/year to pass
  const payload = {
    _meta: {
      month: month,
      year_ce: yearCE,
      year_be: yearBE,
      dept: document.getElementById('planDept').value || null,
      cal_type: document.getElementById('planCalType').value || null,
      exported_at: new Date().toISOString()
    },
    schedule: schedule
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  a.href     = url;
  a.download = `schedule_${MONTH_NAMES_EN[month-1]}${yearBE}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const schedCount = Object.keys(schedule).length;
  showToast(`✅ บันทึก JSON — ${data.length} รายการ (นัดแล้ว ${schedCount})`, 'success');
}


// ====================================================
