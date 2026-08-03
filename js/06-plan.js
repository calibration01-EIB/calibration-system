/* ===== 06-plan.js ===== (generated from index.html inline app script) */
// CALIBRATION PLAN — WORKFLOW
// ====================================================
let planSelectedItems = []; // เครื่องมือที่เลือก
let planFilteredItems = []; // เครื่องมือที่กรองแล้ว
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
  ['new','frm','list','confirm','history'].forEach(t => {
    const el = document.getElementById('planTab-' + t);
    if (!el) return;
    el.classList.toggle('active', t === tab);
  });
  document.getElementById('planTabNew').style.display = tab === 'new' ? 'block' : 'none';
  document.getElementById('planTabFrm').style.display = tab === 'frm' ? 'block' : 'none';
  document.getElementById('planTabList').style.display = tab === 'list' ? 'block' : 'none';
  document.getElementById('planTabConfirm').style.display = tab === 'confirm' ? 'block' : 'none';
  document.getElementById('planTabHistory').style.display = tab === 'history' ? 'block' : 'none';
  if (tab === 'frm') frmLoadPlanList();
  if (tab === 'list') loadLegacyPlans();
  if (tab === 'confirm') loadPlanPending();
  if (tab === 'history') loadPlanHistory();
}

// ป้ายหน่วยงาน: "รหัส — ชื่อหน่วยงาน" (ชื่อจาก list departments ถ้ามี) — แบบเดียวกับหน้ารายการเครื่องมือ
function planDeptLabel(code) {
  const name = (typeof deptUnitName === 'function' && deptUnitName(code)) || '';
  return name ? `${code} — ${name.length > 42 ? name.slice(0, 40) + '…' : name}` : code;
}

// --- Init plan page ---
function initPlanPage() {
  if (!allData.length) { setTimeout(initPlanPage, 500); return; }

  // populate filters
  const types = [...new Set(allData.map(getPlanInstrumentType).filter(Boolean))].sort();
  const depts = [...new Set(allData.map(d => d.department).filter(Boolean))].sort();
  const tSel = document.getElementById('planFilterType');
  const dSel = document.getElementById('planFilterDept');
  if (tSel && tSel.options.length <= 1) {
    tSel.innerHTML = '<option value="">ทุกประเภท</option>' + types.map(t => `<option value="${escapeHtmlAttr(t)}">${escapeHtmlText(t.split(' (')[0])}</option>`).join('');
  }
  if (dSel) {
    // rebuild ทุกครั้ง (คงค่าที่เลือกไว้) — ชื่อหน่วยงานจาก DEPT_INFO อาจโหลดเสร็จทีหลัง
    const cur = dSel.value;
    dSel.innerHTML = '<option value="">ทุกหน่วยงาน</option>' + depts.map(d => `<option value="${escapeHtmlAttr(d)}">${escapeHtmlText(planDeptLabel(d))}</option>`).join('');
    dSel.value = cur;
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

  // สิทธิ์แท็บตาม role: staff เห็นเลือกเครื่อง+แผน FRM+รอดำเนินการ, owner เห็นแผน FRM+รอดำเนินการ (เริ่มที่คิวตัวเอง), viewer เห็นแผน FRM อ่านอย่างเดียว
  const role = currentUser?.role;
  const isStaff = role === 'admin' || role === 'editor';
  const newTab = document.getElementById('planTab-new');
  if (newTab) newTab.style.display = isStaff ? 'inline-flex' : 'none';
  const frmTab = document.getElementById('planTab-frm');
  if (frmTab) frmTab.style.display = 'inline-flex';
  const confirmTab = document.getElementById('planTab-confirm');
  if (confirmTab) confirmTab.style.display = (isStaff || role === 'owner') ? 'inline-flex' : 'none';
  if (role !== 'viewer') loadPlanConfirmBadge();
  if (role === 'owner' && document.getElementById('planTab-new')?.classList.contains('active')) switchPlanTab('confirm');
  if (role === 'viewer' && document.getElementById('planTab-new')?.classList.contains('active')) switchPlanTab('frm');
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
      <td class="plan-name">${escapeHtmlText(d.instrument_name || '–')}${typeof getOpenRepair === 'function' && getOpenRepair(d.id) ? ' <span title="เครื่องอยู่ระหว่างซ่อม — อาจไม่พร้อมสอบเทียบ" style="cursor:help">🔧</span>' : ''}</td>
      <td class="plan-muted">${escapeHtmlText(typShort)}</td>
      <td class="plan-muted" title="${escapeHtmlAttr((typeof deptUnitName === 'function' && deptUnitName(d.department)) || '')}">${escapeHtmlText(d.department || '–')}</td>
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

// --- Load plan list (ระบบเก่า — อ่านย้อนหลัง + เดินแผนค้างต่อจนจบ) ---
async function loadLegacyPlans() {
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
          ${canAttachCert ? `<button onclick="openAttachCertModal('${p.id}')" class="plan-btn accent" type="button"><i class="ti ti-paperclip"></i>กรอกผลสอบ</button>` : ''}
          ${isAdmin && p.status === 'pending_plan' ? `<button onclick="confirmPlan('${p.id}','planned')" class="plan-btn primary" type="button"><i class="ti ti-check"></i>ยืนยันแผน</button>` : ''}
          ${isAdmin && p.status === 'pending_cert' ? `<button onclick="applyPlanResults('${p.id}')" class="plan-btn primary" type="button"><i class="ti ti-check"></i>ยืนยันสอบ</button>` : ''}
          ${isAdmin && (p.status === 'pending_plan' || p.status === 'pending_cert') ? `<button data-plan-id="${p.id}" onclick="openRejectModal(this.dataset.planId)" class="plan-btn danger" type="button"><i class="ti ti-x"></i>ปฏิเสธ</button>` : ''}
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
    const sub = cached.results ? 'ผลสอบเทียบรายเครื่อง' : 'รายการเครื่องมือ';
    const rows = cached.results ? renderCertResultReview(cached.items) : renderPlanItemRows(cached.items, cached.confirm);
    el.innerHTML = `<div class="plan-panel-sub" style="margin-bottom:6px">${sub}</div>${rows}`;
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
  const { data: frmPlansData } = await sb.from('frm_plans').select('id, unit_code, month_num, year');
  (frmPlansData || []).forEach(p => { planMap[p.id] = 'FRM ' + (p.unit_code || '?') + ' ' + p.month_num + '/' + p.year; });

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
    'ปฏิเสธผลสอบ': { bg:'#FFF3E0', color:'#E65100', icon:'ti-arrow-back-up' },
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
  frmRejectPlanId = null;
}

async function submitRejectPlan() {
  const planId = document.getElementById('rejectPlanId').value;
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { showToast('กรุณาระบุสาเหตุที่ปฏิเสธ', 'error'); return; }
  // ตีกลับแผน FRM → ผ่าน RPC (กลับเป็นร่าง + ล้างลายเซ็น)
  if (frmRejectPlanId) {
    showLoading('กำลังตีกลับแผน...');
    try {
      const { error } = await sb.rpc('frm_plan_reject', { p_token: currentUser?.token, p_plan_id: frmRejectPlanId, p_reason: reason });
      if (error) throw error;
      hideLoading();
      showToast('↩️ ตีกลับแผนแล้ว — กลับเป็นร่างให้แก้ไข', 'success');
      closeRejectModal();
      if (typeof frmLoadPlanList === 'function') frmLoadPlanList();
      loadPlanPending();
      loadPlanConfirmBadge();
    } catch (e) { hideLoading(); showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    return;
  }
  showLoading('กำลังบันทึก...');
  try {
    const { data: plan } = await sb.from('calibration_plans').select('status').eq('id', planId).single();
    // ปฏิเสธผลสอบ (pending_cert) → กลับ planned ให้แก้แล้วส่งใหม่; ปฏิเสธแผน → rejected เหมือนเดิม
    const backToPlanned = plan?.status === 'pending_cert';
    const { error } = await sb.from('calibration_plans').update({
      status: backToPlanned ? 'planned' : 'rejected',
      reject_reason: reason
    }).eq('id', planId);
    if (error) throw error;
    await logPlanAudit(planId, backToPlanned ? 'ปฏิเสธผลสอบ' : 'ปฏิเสธแผน', `สาเหตุ: ${reason}`);
    hideLoading();
    showToast(backToPlanned ? '↩️ ส่งกลับให้แก้ผลสอบแล้ว' : '❌ ปฏิเสธแผนเรียบร้อย', 'success');
    closeRejectModal();
    loadLegacyPlans();
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
    loadLegacyPlans();
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
    'ปฏิเสธผลสอบ': '↩️',
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
    loadLegacyPlans();
    loadPlanConfirmBadge();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// ═══ แผน FRM: สถานะ + การ์ด + อนุมัติออนไลน์ 3 ขั้น ═══════════════════════════
const FRM_STATUS_MAP = {
  draft:           { lbl: '📝 ร่าง',                    color: '#555',    bg: '#EFEFEF' },
  pending_approve: { lbl: '🟡 รออนุมัติ (EIB)',          color: '#854F0B', bg: '#FAEEDA' },
  approved:        { lbl: '🟠 รอหน่วยงานรับทราบ',        color: '#9A3412', bg: '#FFEDD5' },
  acknowledged:    { lbl: '✅ อนุมัติครบ — Export ได้',   color: '#3B6D11', bg: '#EAF3DE' },
  pending_cert:    { lbl: '🔵 รอยืนยันผลสอบ',            color: '#185FA5', bg: '#E6F1FB' },
  completed:       { lbl: '🏆 เสร็จสิ้น',                color: '#0F6E56', bg: '#E1F5EE' },
};

function frmPlanCardActions(p) {
  const role = currentUser?.role;
  const isStaff = role === 'admin' || role === 'editor';
  const isOwnerOfPlan = role === 'owner' && currentUser?.department === p.unit_code;
  const b = [];
  if (p.status === 'draft' && isStaff)
    b.push(`<button class="plan-btn primary" type="button" onclick="event.stopPropagation();frmPlanAction('${p.id}','submit')"><i class="ti ti-send"></i>ส่งขออนุมัติ</button>`);
  if (p.status === 'pending_approve' && role === 'admin')
    b.push(`<button class="plan-btn primary" type="button" onclick="event.stopPropagation();frmPlanAction('${p.id}','approve')"><i class="ti ti-check"></i>อนุมัติ</button>`);
  if (p.status === 'approved' && isOwnerOfPlan)
    b.push(`<button class="plan-btn primary" type="button" onclick="event.stopPropagation();frmPlanAction('${p.id}','acknowledge')"><i class="ti ti-eye-check"></i>รับทราบ</button>`);
  if (['pending_approve','approved','acknowledged','pending_cert'].includes(p.status) && (role === 'admin' || (p.status === 'approved' && isOwnerOfPlan)))
    b.push(`<button class="plan-btn danger" type="button" onclick="event.stopPropagation();openFrmRejectModal('${p.id}')"><i class="ti ti-x"></i>ตีกลับ</button>`);
  if (typeof frmCanExport === 'function' && frmCanExport(p))
    b.push(`<button class="plan-btn" type="button" onclick="event.stopPropagation();frmExportPlanById('${p.id}')"><i class="ti ti-download"></i>Export</button>`);
  if (p.status === 'acknowledged' && isStaff)
    b.push(`<button class="plan-btn accent" type="button" onclick="event.stopPropagation();openAttachCertModal('${p.id}','frm_plan_id')"><i class="ti ti-paperclip"></i>กรอกผลสอบ</button>`);
  if (p.status === 'pending_cert' && role === 'admin')
    b.push(`<button class="plan-btn primary" type="button" onclick="event.stopPropagation();applyPlanResults('${p.id}','frm_plan_id')"><i class="ti ti-check"></i>ยืนยันลงทะเบียน</button>`);
  b.push(`<button class="plan-btn" type="button" onclick="event.stopPropagation();openAuditPlanModal('${p.id}','แผน ${escapeJsSingle(p.unit_code || '')} ${p.month_num}/${p.year}')"><i class="ti ti-history"></i>ประวัติ</button>`);
  return b.join('');
}

async function frmPlanAction(planId, action) {
  const map = {
    submit:      { rpc: 'frm_plan_submit',      msg: 'ส่งแผนขออนุมัติ?\nหลังส่งจะแก้ไขแผนไม่ได้จนกว่าจะถูกตีกลับ' },
    approve:     { rpc: 'frm_plan_approve',     msg: 'อนุมัติแผนนี้?\nชื่อคุณจะถูกบันทึกลงช่อง Approved by' },
    acknowledge: { rpc: 'frm_plan_acknowledge', msg: 'รับทราบแผนนี้?\nชื่อคุณจะถูกบันทึกลงช่อง Acknowledge by' },
  }[action];
  if (!map || !confirm(map.msg)) return;
  showLoading('กำลังอัพเดทสถานะ...');
  try {
    const { error } = await sb.rpc(map.rpc, { p_token: currentUser?.token, p_plan_id: planId });
    if (error) throw error;
    hideLoading();
    showToast('✅ เรียบร้อย', 'success');
    if (typeof frmEditorPlan !== 'undefined' && frmEditorPlan && frmEditorPlan.id === planId) frmEditorClose();
    if (typeof frmLoadPlanList === 'function') frmLoadPlanList();
    loadPlanPending();
    loadPlanConfirmBadge();
  } catch (e) { hideLoading(); showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
}

let frmRejectPlanId = null;
function openFrmRejectModal(planId) {
  frmRejectPlanId = planId;
  document.getElementById('rejectPlanId').value = '';
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectPlanModal').style.display = 'flex';
}

function frmPlanCard(p) {
  const s = FRM_STATUS_MAP[p.status] || { lbl: p.status || '–', color: '#888', bg: '#f5f5f5' };
  const cnt = (p.items || []).length;
  const dept = (typeof frmDeptFullName === 'function' && frmDeptFullName(p.unit_code)) || '';
  const sigLine = [
    p.prepared_by ? `จัดทำ: ${escapeHtmlText(p.prepared_by)}` : '',
    p.approved_by ? `อนุมัติ: ${escapeHtmlText(p.approved_by)}` : '',
    p.acknowledged_by ? `รับทราบ: ${escapeHtmlText(p.acknowledged_by)}` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="plan-card" onclick="frmOpenPlanById('${p.id}')" style="cursor:pointer">
    <div class="plan-card-main">
      <div style="flex:1;min-width:0">
        <div class="plan-card-title">
          <span>${escapeHtmlText(p.unit_code || 'ไม่ระบุ')} — ${escapeHtmlText(frmMonthName(p.month_num))} ${p.year}</span>
          <span class="badge" style="background:${s.bg};color:${s.color}">${s.lbl}</span>
        </div>
        <div class="plan-card-meta">${dept ? escapeHtmlText(dept) + ' · ' : ''}${escapeHtmlText((p.type_name || '').split(' (')[0])} · ${cnt.toLocaleString()} เครื่อง${sigLine ? ' · ' + sigLine : ''}</div>
        ${p.status === 'draft' && p.reject_reason ? `<div class="badge badge-red" style="margin-top:6px">ถูกตีกลับ: ${escapeHtmlText(p.reject_reason)}</div>` : ''}
      </div>
      <div class="plan-card-actions">${frmPlanCardActions(p)}</div>
    </div>
  </div>`;
}

// --- คิวรอดำเนินการของคนที่ล็อกอิน (admin: รออนุมัติ+รอยืนยันผล, owner: รอรับทราบของหน่วยตัวเอง, editor: โดนตีกลับ) ---
async function loadPlanPending() {
  const el = document.getElementById('planConfirmContainer');
  if (!el) return;
  el.innerHTML = '<div class="no-data">กำลังโหลด...</div>';
  const role = currentUser?.role;
  let q = sb.from('frm_plans').select('*').order('updated_at', { ascending: false });
  if (role === 'admin') q = q.in('status', ['pending_approve', 'pending_cert']);
  else if (role === 'owner') q = q.eq('status', 'approved').eq('unit_code', currentUser?.department || '');
  else q = q.eq('status', 'draft').not('reject_reason', 'is', null);
  const { data, error } = await q;
  if (error) { el.innerHTML = '<div class="no-data" style="color:var(--red)">โหลดไม่สำเร็จ</div>'; return; }
  if (!data?.length) { el.innerHTML = '<div class="no-data">ไม่มีรายการรอดำเนินการ 🎉</div>'; return; }
  if (typeof frmPlanRows !== 'undefined') {
    // ให้คลิกการ์ดจากคิวเปิด editor ได้ (frmOpenPlanById หาใน frmPlanRows)
    data.forEach(p => { if (!frmPlanRows.some(x => x.id === p.id)) frmPlanRows.push(p); });
  }
  el.innerHTML = data.map(p => frmPlanCard(p)).join('');
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
    loadLegacyPlans();
    loadPlanConfirmBadge();
  } catch(e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// --- กรอกผลสอบเทียบรายเครื่อง (หลังสอบ) ---
const CERT_RESULT_FIELDS = [
  { key: 'serial_no',       label: 'Serial No.' },
  { key: 'brand',           label: 'ยี่ห้อ' },
  { key: 'model',           label: 'รุ่น' },
  { key: 'instrument_name', label: 'ชื่อเครื่องมือ' },
  { key: 'range_val',       label: 'Range' },
  { key: 'asset_no',        label: 'Asset No.' },
  { key: 'machine',         label: 'เครื่องจักร' },
  { key: 'location',        label: 'สถานที่ใช้งาน' },
];
let certResultPlanId = null;
let certResultPlanCol = 'plan_id'; // 'plan_id' = ระบบเก่า, 'frm_plan_id' = แผน FRM
let certResultItems = [];
let certResultEditing = null;   // item ที่กำลังกรอก
let certResultInst = null;      // แถว instruments ปัจจุบันของ item ที่กำลังกรอก

async function openAttachCertModal(planId, col) {
  certResultPlanId = planId;
  certResultPlanCol = col === 'frm_plan_id' ? 'frm_plan_id' : 'plan_id';
  showLoading('กำลังโหลดรายการ...');
  try {
    const { data, error } = await sb.from('calibration_plan_items')
      .select('*').eq(certResultPlanCol, planId).order('id_code');
    if (error) throw error;
    certResultItems = data || [];
    hideLoading();
    renderCertResultList();
    document.getElementById('certResultModal').classList.add('open');
  } catch (e) {
    hideLoading();
    showToast('โหลดรายการไม่สำเร็จ: ' + e.message, 'error');
  }
}

function closeCertResultModal() {
  document.getElementById('certResultModal').classList.remove('open');
  certResultPlanId = null; certResultItems = []; certResultEditing = null; certResultInst = null;
}

function certResultChip(st) {
  if (st === 'filled')  return '<span class="badge badge-green">กรอกแล้ว</span>';
  if (st === 'skipped') return '<span class="badge badge-amber">ข้าม</span>';
  if (st === 'applied') return '<span class="badge badge-green">ลงทะเบียนแล้ว</span>';
  return '<span class="badge badge-red">ยังไม่กรอก</span>';
}

function renderCertResultList() {
  document.getElementById('certResultTitle').textContent = 'กรอกผลสอบเทียบรายเครื่อง';
  const body = document.getElementById('certResultBody');
  body.innerHTML = `
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">กรอกผลทีละเครื่อง (ไฟล์สแกน + เลข Cert + วันสอบ + แก้ข้อมูลที่ผิด) ครบทุกเครื่องแล้วจึงส่งให้ Admin ยืนยัน — ข้อมูลจะยังไม่ลงทะเบียนจนกว่า Admin จะยืนยัน</p>
    ${certResultItems.map(it => `
      <div class="plan-item-row" style="align-items:center">
        <span class="plan-id">${escapeHtmlText(it.id_code || '–')}</span>
        <span style="flex:1">${escapeHtmlText(it.instrument_name || '–')}</span>
        ${certResultChip(it.result_status)}
        <button class="plan-btn accent" type="button" onclick="openCertResultForm('${escapeJsSingle(it.id)}')">${it.result_status ? 'แก้ไข' : 'กรอกผล'}</button>
      </div>`).join('')}`;
  const allDone = certResultItems.length > 0 &&
    certResultItems.every(it => ['filled', 'skipped', 'applied'].includes(it.result_status));
  document.getElementById('certResultFooter').innerHTML = `
    <button onclick="closeCertResultModal()" class="btn-secondary">ปิด</button>
    <button onclick="submitCertResults()" class="btn-primary" ${allDone ? '' : 'disabled'}>📤 ส่งให้ Admin ยืนยัน</button>`;
}

async function openCertResultForm(itemId) {
  const it = certResultItems.find(x => String(x.id) === String(itemId));
  if (!it) return;
  showLoading('กำลังโหลดข้อมูลเครื่อง...');
  try {
    const { data: inst, error } = await sb.from('instruments')
      .select('*').eq('id', it.instrument_id).single();
    if (error || !inst) throw new Error('ไม่พบเครื่องมือในทะเบียน');
    hideLoading();
    certResultEditing = it; certResultInst = inst;
    const pc = it.proposed_changes || {};
    const today = new Date().toISOString().slice(0, 10);
    const isSkipped = it.result_status === 'skipped';
    document.getElementById('certResultTitle').textContent = `ผลสอบ: ${it.id_code || '–'}`;
    document.getElementById('certResultBody').innerHTML = `
      <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-size:13px">
        <input type="checkbox" id="certResSkip" ${isSkipped ? 'checked' : ''} onchange="toggleCertResultSkip()">
        ข้ามเครื่องนี้ (ไม่ได้สอบรอบนี้)
      </label>
      <div class="form-group" id="certResSkipReasonWrap" style="display:${isSkipped ? 'block' : 'none'}">
        <label>เหตุผลที่ข้าม</label>
        <input type="text" id="certResSkipReason" value="${escapeHtmlText(it.skip_reason || '')}" style="width:100%">
      </div>
      <div id="certResFormFields" style="display:${isSkipped ? 'none' : 'block'}">
        <div class="form-group">
          <label>ไฟล์สแกนใบรับรอง (PDF/JPG/PNG) ${it.result_file_url ? '<span style="color:var(--text3)">— มีไฟล์แล้ว แนบใหม่ = แทนที่</span>' : '<span style="color:var(--red)">*</span>'}</label>
          <input type="file" id="certResFile" accept=".pdf,.jpg,.jpeg,.png" style="padding:8px;border:1.5px solid var(--border);border-radius:8px;width:100%;font-family:var(--font);font-size:13px">
        </div>
        <div style="display:flex;gap:10px">
          <div class="form-group" style="flex:1">
            <label>เลข Cert <span style="color:var(--red)">*</span></label>
            <input type="text" id="certResCertNo" value="${escapeHtmlText(it.result_cert_no || '')}" style="width:100%">
          </div>
          <div class="form-group" style="flex:1">
            <label>วันสอบจริง <span style="color:var(--red)">*</span></label>
            <input type="date" id="certResCalDate" value="${it.result_cal_date || today}" style="width:100%">
          </div>
        </div>
        <div style="font-size:12px;font-weight:700;color:var(--text2);margin:10px 0 6px">ข้อมูลเครื่องมือ — แก้เฉพาะช่องที่ผิด (ค่าเดิมใส่ไว้ให้แล้ว)</div>
        ${CERT_RESULT_FIELDS.map(f => `
          <div class="form-group" style="margin-bottom:8px">
            <label style="font-size:12px">${f.label}</label>
            <input type="text" id="certResField_${f.key}" value="${escapeHtmlText(pc[f.key]?.to ?? inst[f.key] ?? '')}" style="width:100%">
          </div>`).join('')}
      </div>`;
    document.getElementById('certResultFooter').innerHTML = `
      <button onclick="renderCertResultList()" class="btn-secondary">← กลับ</button>
      <button onclick="saveCertResultItem()" class="btn-primary">💾 บันทึกเครื่องนี้</button>`;
  } catch (e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

function toggleCertResultSkip() {
  const skip = document.getElementById('certResSkip').checked;
  document.getElementById('certResSkipReasonWrap').style.display = skip ? 'block' : 'none';
  document.getElementById('certResFormFields').style.display = skip ? 'none' : 'block';
}

async function saveCertResultItem() {
  const it = certResultEditing, inst = certResultInst;
  if (!it || !inst) return;
  const skip = document.getElementById('certResSkip').checked;
  showLoading('กำลังบันทึก...');
  try {
    let patch;
    if (skip) {
      patch = {
        result_status: 'skipped',
        skip_reason: document.getElementById('certResSkipReason').value.trim() || null,
        result_by: currentUser?.username || null,
        result_at: new Date().toISOString(),
      };
    } else {
      const certNo = document.getElementById('certResCertNo').value.trim();
      const calDate = document.getElementById('certResCalDate').value;
      const file = document.getElementById('certResFile').files[0];
      if (!certNo) throw new Error('กรุณากรอกเลข Cert');
      if (!calDate) throw new Error('กรุณาเลือกวันสอบจริง');
      if (!file && !it.result_file_url) throw new Error('กรุณาแนบไฟล์สแกนใบรับรอง');
      patch = {
        result_status: 'filled',
        result_cert_no: certNo,
        result_cal_date: calDate,
        skip_reason: null,
        result_by: currentUser?.username || null,
        result_at: new Date().toISOString(),
      };
      if (file) {
        const ext = file.name.split('.').pop();
        const fileName = `certresult_${certResultPlanId}_${it.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from('calibration-plans').upload(fileName, file);
        if (upErr) throw upErr;
        if (it.result_file_name) {
          try { await sb.storage.from('calibration-plans').remove([it.result_file_name]); } catch (_) {}
        }
        const { data: urlData } = sb.storage.from('calibration-plans').getPublicUrl(fileName);
        patch.result_file_url = urlData?.publicUrl || fileName;
        patch.result_file_name = fileName;
      }
      // diff เทียบค่าปัจจุบันในทะเบียน — เก็บเฉพาะช่องที่ต่าง
      const changes = {};
      CERT_RESULT_FIELDS.forEach(f => {
        const now = String(inst[f.key] ?? '').trim();
        const val = document.getElementById(`certResField_${f.key}`).value.trim();
        if (val !== now) changes[f.key] = { from: now, to: val };
      });
      patch.proposed_changes = Object.keys(changes).length ? changes : null;
    }
    const { error } = await sb.from('calibration_plan_items').update(patch).eq('id', it.id);
    if (error) throw error;
    Object.assign(it, patch);
    hideLoading();
    showToast('✅ บันทึกแล้ว', 'success');
    renderCertResultList();
  } catch (e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

async function submitCertResults() {
  const filled = certResultItems.filter(it => it.result_status === 'filled').length;
  const skipped = certResultItems.filter(it => it.result_status === 'skipped').length;
  if (!confirm(`ส่งผลสอบให้ Admin ยืนยัน?\nกรอกแล้ว ${filled} เครื่อง · ข้าม ${skipped} เครื่อง`)) return;
  showLoading('กำลังส่ง...');
  try {
    if (certResultPlanCol === 'frm_plan_id') {
      // แผน FRM → เปลี่ยนสถานะผ่าน RPC (log ฝั่งเซิร์ฟเวอร์)
      const { error } = await sb.rpc('frm_plan_submit_results', { p_token: currentUser?.token, p_plan_id: certResultPlanId });
      if (error) throw error;
      if (typeof frmLoadPlanList === 'function') frmLoadPlanList();
      loadPlanPending();
    } else {
      const { error } = await sb.from('calibration_plans')
        .update({ status: 'pending_cert' }).eq('id', certResultPlanId);
      if (error) throw error;
      await logPlanAudit(certResultPlanId, 'แนบไฟล์สอบ', `กรอกผลสอบ ${filled} เครื่อง ข้าม ${skipped} เครื่อง รอ Admin ยืนยัน`);
      loadLegacyPlans();
    }
    hideLoading();
    showToast('✅ ส่งให้ Admin ยืนยันแล้ว', 'success');
    closeCertResultModal();
    loadPlanConfirmBadge();
  } catch (e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

// --- Admin review: ผลสอบรายเครื่อง + diff ---
function renderCertResultReview(items) {
  if (!items?.length) return '<div class="no-data" style="padding:14px">ไม่มีรายการ</div>';
  const labels = {};
  CERT_RESULT_FIELDS.forEach(f => { labels[f.key] = f.label; });
  return items.map(it => {
    const st = it.result_status;
    const chip = st === 'skipped'
      ? `<span class="badge badge-amber">ข้าม${it.skip_reason ? ': ' + escapeHtmlText(it.skip_reason) : ''}</span>`
      : certResultChip(st);
    const calInfo = (st === 'filled' || st === 'applied')
      ? `<div style="font-size:12px;color:var(--text2);margin-top:2px">Cert: <b>${escapeHtmlText(it.result_cert_no || '–')}</b> · วันสอบ: ${escapeHtmlText(it.result_cal_date || '–')} · โดย ${escapeHtmlText(it.result_by || '–')}</div>` : '';
    const diffs = Object.entries(it.proposed_changes || {}).map(([k, v]) =>
      `<div style="font-size:12px;color:var(--text2)">✏️ ${escapeHtmlText(labels[k] || k)}: <s>${escapeHtmlText(v.from || '–')}</s> → <b style="color:var(--accent)">${escapeHtmlText(v.to || '–')}</b></div>`).join('');
    const fileBtn = it.result_file_url
      ? `<button onclick="viewPlanFile('${escapeJsSingle(it.result_file_url)}')" class="plan-btn" type="button"><i class="ti ti-file-text"></i>ไฟล์</button>` : '';
    return `<div class="plan-item-row confirm" style="flex-wrap:wrap;opacity:${st === 'skipped' ? '.6' : '1'}">
      <span class="plan-id">${escapeHtmlText(it.id_code || '–')}</span>
      <span style="flex:1">${escapeHtmlText(it.instrument_name || '–')} ${chip}</span>
      ${fileBtn}
      ${(calInfo || diffs) ? `<div style="flex-basis:100%;padding-left:4px">${calInfo}${diffs}</div>` : ''}
    </div>`;
  }).join('');
}

// --- Admin ยืนยัน: ลงทะเบียนผลสอบเข้า instruments/ไฟล์/ประวัติ ---
async function applyPlanResults(planId, col) {
  const useFrm = col === 'frm_plan_id';
  if (!confirm('ยืนยันผลสอบเทียบ?\nระบบจะอัพเดทข้อมูลเครื่องมือ + ก๊อปปี้ไฟล์เข้าเครื่อง ตามที่กรอกไว้')) return;
  showLoading('กำลังลงทะเบียนผลสอบ...');
  const errors = [];
  try {
    const { data: items, error } = await sb.from('calibration_plan_items')
      .select('*').eq(useFrm ? 'frm_plan_id' : 'plan_id', planId);
    if (error) throw error;
    const targets = (items || []).filter(it => it.result_status === 'filled');
    for (const it of targets) {
      try {
        await applyOneResult(it);
      } catch (e) {
        errors.push(`${it.id_code || it.id}: ${e.message}`);
      }
    }
    if (errors.length) {
      hideLoading();
      showToast(`⚠️ ลงทะเบียนไม่ครบ (${errors.length} เครื่อง): ${errors.join(' | ')} — เครื่องที่สำเร็จแล้วจะไม่ทำซ้ำ กดยืนยันอีกครั้งเพื่อลองเฉพาะที่ค้าง`, 'error');
      if (useFrm) { if (typeof frmLoadPlanList === 'function') frmLoadPlanList(); loadPlanPending(); } else loadLegacyPlans();
      return;
    }
    if (useFrm) {
      // แผน FRM → ยืนยันผ่าน RPC (log ฝั่งเซิร์ฟเวอร์)
      const { error: rpcErr } = await sb.rpc('frm_plan_confirm_results', { p_token: currentUser?.token, p_plan_id: planId });
      if (rpcErr) throw rpcErr;
      if (typeof frmLoadPlanList === 'function') frmLoadPlanList();
      loadPlanPending();
    } else {
      await sb.from('calibration_plans')
        .update({ status: 'completed', cert_confirmed_by: currentUser.username }).eq('id', planId);
      await logPlanAudit(planId, 'ยืนยันสอบ', `ลงทะเบียนผลสอบ ${targets.length} เครื่อง`);
      loadLegacyPlans();
    }
    hideLoading();
    showToast('🏆 ยืนยันสอบเทียบ + อัพเดททะเบียนเรียบร้อย', 'success');
    loadPlanConfirmBadge();
    if (typeof loadData === 'function') loadData(); // รีเฟรชทะเบียนเครื่องมือในหน้า
  } catch (e) {
    hideLoading();
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  }
}

async function applyOneResult(it) {
  const { data: inst, error: iErr } = await sb.from('instruments')
    .select('*').eq('id', it.instrument_id).single();
  if (iErr || !inst) throw new Error('ไม่พบเครื่องมือในทะเบียน');

  // 1) ก๊อปปี้ไฟล์เข้าโฟลเดอร์เครื่อง (bucket certificates)
  if (it.result_file_name) {
    const { data: blob, error: dErr } = await sb.storage.from('calibration-plans').download(it.result_file_name);
    if (dErr) throw new Error('ดาวน์โหลดไฟล์ไม่สำเร็จ: ' + dErr.message);
    const ext = it.result_file_name.split('.').pop();
    const safeCert = String(it.result_cert_no || 'cert').replace(/[^0-9A-Za-z._-]+/g, '_');
    const folder = `cert_${inst.id}_${inst.id_code}`;
    let name = `${safeCert}.${ext}`;
    const { data: existing } = await sb.storage.from('certificates').list(folder);
    if ((existing || []).some(f => f.name === name)) name = `${safeCert}_${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('certificates')
      .upload(`${folder}/${name}`, blob, { contentType: blob.type || undefined });
    if (upErr) throw new Error('อัพโหลดไฟล์เข้าเครื่องมือไม่สำเร็จ: ' + upErr.message);
  }

  // 2) payload อัพเดททะเบียน: ฟิลด์ที่แก้ + cert/วันสอบ/วันครบกำหนด
  const payload = {};
  Object.entries(it.proposed_changes || {}).forEach(([k, v]) => { payload[k] = v.to; });
  payload.cert_no = it.result_cert_no;
  payload.cal_date = it.result_cal_date;
  const due = calcDueDateStr(it.result_cal_date, inst.cal_frequency);
  if (due) payload.due_date = due;

  // 3) ค่าเดิมลง prev + calibration_history (เฉพาะเมื่อ cert/วันสอบเปลี่ยนจริง)
  const certChanged = inst.cert_no && inst.cert_no !== payload.cert_no;
  const dateChanged = inst.cal_date && String(inst.cal_date).slice(0, 10) !== String(payload.cal_date).slice(0, 10);
  if (certChanged || dateChanged) {
    payload.prev_cert_no = inst.cert_no || null;
    payload.prev_cal_date = inst.cal_date || null;
    await sb.from('calibration_history').insert({
      instrument_id: inst.id,
      cert_no: inst.cert_no || null,
      cal_date: inst.cal_date || null,
      due_date: inst.due_date || null,
    });
  }

  const { error: uErr } = await sb.from('instruments').update(payload).eq('id', inst.id);
  if (uErr) throw new Error('อัพเดททะเบียนไม่สำเร็จ: ' + uErr.message);

  // 4) audit log รายเครื่อง
  const changes = {};
  Object.entries(it.proposed_changes || {}).forEach(([k, v]) => { changes[k] = { from: v.from || '–', to: v.to || '–' }; });
  changes['CERT.'] = { from: inst.cert_no || '–', to: payload.cert_no };
  changes['วันสอบเทียบ'] = { from: inst.cal_date || '–', to: payload.cal_date };
  if (due) changes['วันครบกำหนด'] = { from: inst.due_date || '–', to: due };
  await logAudit('อัพเดทจากผลสอบเทียบ', inst, changes);

  // 5) กัน apply ซ้ำ
  const { error: mErr } = await sb.from('calibration_plan_items')
    .update({ result_status: 'applied', applied_at: new Date().toISOString() }).eq('id', it.id);
  if (mErr) throw new Error('บันทึกสถานะรายการไม่สำเร็จ: ' + mErr.message);
}

// --- Badge notification ---
async function loadPlanConfirmBadge() {
  const role = currentUser?.role;
  let count = 0;
  try {
    if (role === 'admin') {
      const { count: c1 } = await sb.from('frm_plans').select('id', { count: 'exact', head: true }).in('status', ['pending_approve', 'pending_cert']);
      const { count: c2 } = await sb.from('calibration_plans').select('id', { count: 'exact', head: true }).in('status', ['pending_plan', 'pending_cert']);
      count = (c1 || 0) + (c2 || 0);
    } else if (role === 'owner') {
      const { count: c } = await sb.from('frm_plans').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('unit_code', currentUser?.department || '');
      count = c || 0;
    } else if (role === 'editor') {
      const { count: c } = await sb.from('frm_plans').select('id', { count: 'exact', head: true }).eq('status', 'draft').not('reject_reason', 'is', null);
      count = c || 0;
    } else return;
  } catch (e) { return; }
  const badge = document.getElementById('planConfirmBadge');
  const navBadge = document.getElementById('navPlanBadge');
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none'; }
  if (navBadge) { navBadge.textContent = count; navBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
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
// สถานะแผนรายเครื่อง — ใช้ระบายสี/ป้ายในตารางรายการเครื่องมือและหน้างานซ่อม
// ====================================================
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
