/* ===== 16-repairs.js ===== งานซ่อมเครื่องมือ (repair_orders) */

let repairOrders = [];
let repairFilter = { q: '', status: '', dept: '', from: '', to: '' };
window.repairOrders = repairOrders;
window.repairsByInstrument = {};

function repairStatusMeta(status) {
  const m = {
    reported:     ['แจ้งซ่อม', '#b45309', '#fdf3dd'],
    in_progress:  ['กำลังซ่อม', '#b91c1c', '#fde8e8'],
    completed:    ['ซ่อมเสร็จ', '#0b7a44', '#e5f6ec'],
    unrepairable: ['ซ่อมไม่ได้ — ยกเลิกใช้งาน', '#7f1d1d', '#fce8e8'],
    cancelled:    ['ยกเลิกใบแจ้ง', '#555', '#f5f5f5'],
  };
  return m[status] || [status || '–', '#555', '#f5f5f5'];
}
function repairStatusBadge(status) {
  const [lbl, fg, bg] = repairStatusMeta(status);
  return `<span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${fg};white-space:nowrap">${lbl}</span>`;
}
function fmtRepairDate(s) {
  return s ? new Date(s).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' }) : '–';
}
function fmtBaht(n) {
  const v = Number(n);
  return isFinite(v) && v !== 0 ? v.toLocaleString('th-TH') : '–';
}

function rebuildRepairIndex(orders) {
  const map = {};
  (orders || []).forEach(o => {
    if (o.status === 'reported' || o.status === 'in_progress') map[o.instrument_id] = o;
  });
  window.repairsByInstrument = map;
  return map;
}
function getOpenRepair(instrumentId) {
  return window.repairsByInstrument[instrumentId] || null;
}
// badge เล็กใช้แปะในตาราง/การ์ด/detail — '' ถ้าเครื่องไม่มีงานซ่อมเปิดค้าง
function repairBadgeHtml(instrumentId) {
  const o = getOpenRepair(instrumentId);
  if (!o) return '';
  return o.status === 'reported'
    ? '<span class="badge badge-amber">🔧 แจ้งซ่อม</span>'
    : '<span class="badge badge-red">🔧 กำลังซ่อม</span>';
}

async function fetchRepairOrders() {
  try {
    const { data, error } = await sb.from('repair_orders').select('*').order('reported_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) { console.warn('โหลดงานซ่อมไม่สำเร็จ:', e.message); return null; }
}

async function loadRepairData() {
  const rows = await fetchRepairOrders();
  if (!rows) return;
  repairOrders = rows;
  window.repairOrders = rows;
  rebuildRepairIndex(rows);
  updateRepairNavBadge();
  const page = document.getElementById('pageRepairs');
  if (page && page.style.display !== 'none') { renderRepairSummary(); renderRepairsTable(); }
  if (typeof renderRepairDashboard === 'function') renderRepairDashboard();
  // ตาราง/การ์ดรายการเครื่องแสดง badge ซ่อม — re-render หลังได้ข้อมูล
  if (typeof renderTable === 'function' && allData && allData.length) renderTable();
}

function updateRepairNavBadge() {
  const n = repairOrders.filter(o => o.status === 'reported' || o.status === 'in_progress').length;
  ['navRepairBadge', 'bnavRepairBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = n; el.style.display = n > 0 ? 'inline-flex' : 'none'; }
  });
}

// ===== หน้า งานซ่อม =====
function repairInstrument(instrumentId) {
  return (typeof allData !== 'undefined' && allData.find(x => x.id == instrumentId)) || null;
}

async function loadRepairsPage() {
  populateRepairDeptFilter();
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const btn = document.getElementById('repairNewBtn');
  if (btn) btn.style.display = canEdit ? '' : 'none';
  await loadRepairData();
  renderRepairSummary();
  renderRepairsTable();
}

function populateRepairDeptFilter() {
  const sel = document.getElementById('repairDeptFilter');
  if (!sel || sel.options.length > 1) return;
  const depts = [...new Set((allData || []).map(d => d.department).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">ทุกหน่วยงาน</option>' +
    depts.map(c => `<option value="${escapeHtmlAttr(c)}">${escapeHtmlText(c)}</option>`).join('');
}

function filterRepairs() {
  repairFilter = {
    q: (document.getElementById('repairSearch')?.value || '').trim().toLowerCase(),
    status: document.getElementById('repairStatusFilter')?.value || '',
    dept: document.getElementById('repairDeptFilter')?.value || '',
    from: document.getElementById('repairFromFilter')?.value || '',
    to: document.getElementById('repairToFilter')?.value || '',
  };
  renderRepairsTable();
}

function repairFilteredRows() {
  return repairOrders.filter(o => {
    const d = repairInstrument(o.instrument_id);
    if (repairFilter.status === 'open') { if (!(o.status === 'reported' || o.status === 'in_progress')) return false; }
    else if (repairFilter.status && o.status !== repairFilter.status) return false;
    if (repairFilter.dept && (d?.department || '') !== repairFilter.dept) return false;
    if (repairFilter.from && (o.reported_date || '') < repairFilter.from) return false;
    if (repairFilter.to && (o.reported_date || '') > repairFilter.to) return false;
    if (repairFilter.q) {
      const hay = [d?.id_code, d?.instrument_name, o.vendor_name, o.symptom].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(repairFilter.q)) return false;
    }
    return true;
  });
}

function renderRepairSummary() {
  const host = document.getElementById('repairSummary');
  if (!host) return;
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const cnt = { reported: 0, in_progress: 0, doneMonth: 0 };
  repairOrders.forEach(o => {
    if (o.status === 'reported') cnt.reported++;
    else if (o.status === 'in_progress') cnt.in_progress++;
    else if (o.status === 'completed' && (o.completed_date || '').startsWith(ym)) cnt.doneMonth++;
  });
  const card = (label, val, fg, bg, filterVal) => `
    <div onclick="document.getElementById('repairStatusFilter').value='${filterVal}';filterRepairs()"
      style="background:${bg};border-radius:12px;padding:12px 16px;cursor:pointer">
      <div style="font-size:22px;font-weight:700;color:${fg}">${val}</div>
      <div style="font-size:12px;color:${fg}">${label}</div>
    </div>`;
  host.innerHTML =
    card('แจ้งซ่อม รอดำเนินการ', cnt.reported, '#b45309', '#fdf3dd', 'reported') +
    card('กำลังซ่อม', cnt.in_progress, '#b91c1c', '#fde8e8', 'in_progress') +
    card('ซ่อมเสร็จเดือนนี้', cnt.doneMonth, '#0b7a44', '#e5f6ec', 'completed');
}

function renderRepairsTable() {
  const tbody = document.getElementById('repairTableBody');
  if (!tbody) return;
  const rows = repairFilteredRows();
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="no-data">ไม่พบงานซ่อม</td></tr>'; return; }
  tbody.innerHTML = rows.map((o, i) => {
    const d = repairInstrument(o.instrument_id);
    return `<tr onclick="openRepairModal('${o.id}')" style="cursor:pointer">
      <td>${i + 1}</td>
      <td><strong>${escapeHtmlText(d?.id_code || '?')}</strong><br><span class="reg-sub">${escapeHtmlText(d?.instrument_name || 'ไม่พบเครื่องในทะเบียน')}</span></td>
      <td>${escapeHtmlText(d?.department || '–')}</td>
      <td>${fmtRepairDate(o.reported_date)}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtmlAttr(o.symptom || '')}">${escapeHtmlText(o.symptom || '–')}</td>
      <td>${repairStatusBadge(o.status)}</td>
      <td>${escapeHtmlText(o.repair_type === 'external' ? (o.vendor_name || 'ภายนอก') : o.repair_type === 'internal' ? 'ภายใน' : '–')}</td>
      <td style="text-align:right">${fmtBaht(o.cost)}</td>
    </tr>`;
  }).join('');
}

function openRepairsForInstrument(instrumentId) {
  showPage('repairs');
  const d = repairInstrument(instrumentId);
  const q = document.getElementById('repairSearch');
  if (q) q.value = d?.id_code || '';
  const st = document.getElementById('repairStatusFilter');
  if (st) st.value = '';
  filterRepairs();
}

// Task 3 เติม body — วางไว้ก่อนกัน onclick พัง
function openRepairModal(orderId, instrumentId) {
  const body = document.getElementById('repairModalBody');
  const title = document.getElementById('repairModalTitle');
  const sub = document.getElementById('repairModalSub');
  if (!body) return;
  if (orderId) { renderRepairOrderView(orderId); }
  else {
    title.textContent = '🔧 แจ้งซ่อมเครื่องมือ';
    sub.textContent = '';
    const preset = instrumentId ? repairInstrument(instrumentId) : null;
    const options = (allData || [])
      .filter(d => d.id_code)
      .map(d => `<option value="${escapeHtmlAttr(d.id_code)}">${escapeHtmlText(d.instrument_name || '')} · ${escapeHtmlText(d.department || '')}</option>`)
      .join('');
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><label style="font-size:12px;font-weight:600">เครื่องมือ (พิมพ์รหัส ID)</label>
          <input id="repNewInst" list="repInstList" value="${escapeHtmlAttr(preset?.id_code || '')}" ${preset ? 'readonly' : ''}
            placeholder="เช่น PMT1-001" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono)">
          <datalist id="repInstList">${options}</datalist>
          <div id="repNewInstName" style="font-size:12px;color:var(--text2);margin-top:4px">${preset ? escapeHtmlText(preset.instrument_name || '') : ''}</div></div>
        <div><label style="font-size:12px;font-weight:600">วันที่แจ้ง</label>
          <input id="repNewDate" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px"></div>
        <div><label style="font-size:12px;font-weight:600">อาการเสีย</label>
          <textarea id="repNewSymptom" rows="3" placeholder="อธิบายอาการ เช่น จอไม่ติด ค่าลอย ฯลฯ" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font)"></textarea></div>
        <button onclick="saveRepairReport()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-family:var(--font)">บันทึกใบแจ้งซ่อม</button>
      </div>`;
    const inp = document.getElementById('repNewInst');
    inp.addEventListener('input', () => {
      const d = (allData || []).find(x => x.id_code === inp.value);
      document.getElementById('repNewInstName').textContent = d ? (d.instrument_name || '') + ' · ' + (d.department || '') : '';
    });
  }
  document.getElementById('repairModal').classList.add('open');
}

async function saveRepairReport() {
  const idCode = document.getElementById('repNewInst')?.value.trim();
  const d = (allData || []).find(x => x.id_code === idCode);
  const symptom = document.getElementById('repNewSymptom')?.value.trim();
  const date = document.getElementById('repNewDate')?.value;
  if (!d) { showToast('ไม่พบเครื่องมือรหัสนี้ในทะเบียน', 'error'); return; }
  if (!symptom) { showToast('กรุณากรอกอาการเสีย', 'error'); return; }
  if (getOpenRepair(d.id)) { showToast('เครื่องนี้มีงานซ่อมค้างอยู่แล้ว', 'error'); return; }
  const { data, error } = await sb.from('repair_orders').insert({
    instrument_id: d.id, status: 'reported', reported_date: date,
    reported_by: currentUser?.name || 'Unknown', symptom,
  }).select().single();
  if (error) { showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
  logAudit('แจ้งซ่อมเครื่องมือ', d, { symptom });
  showToast('บันทึกใบแจ้งซ่อมแล้ว', 'success');
  await loadRepairData();
  renderRepairSummary(); renderRepairsTable();
  openRepairModal(data.id);   // เปิดต่อเป็นโหมดดูงาน
}

async function updateRepairOrder(orderId, patch, auditAction, auditChanges) {
  const o = repairOrders.find(x => x.id === orderId);
  const { error } = await sb.from('repair_orders').update({
    ...patch, updated_at: new Date().toISOString(), updated_by: currentUser?.name || 'Unknown',
  }).eq('id', orderId);
  if (error) { showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return false; }
  if (auditAction) logAudit(auditAction, repairInstrument(o?.instrument_id), auditChanges || patch);
  await loadRepairData();
  renderRepairSummary(); renderRepairsTable();
  return true;
}

function repairField(label, inputHtml) {
  return `<div><label style="font-size:12px;font-weight:600">${label}</label>${inputHtml}</div>`;
}
const REP_INPUT_STYLE = 'width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font)';

function renderRepairOrderView(orderId) {
  const o = repairOrders.find(x => x.id === orderId);
  if (!o) return;
  const d = repairInstrument(o.instrument_id);
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  document.getElementById('repairModalTitle').innerHTML = `🔧 งานซ่อม ${repairStatusBadge(o.status)}`;
  document.getElementById('repairModalSub').textContent =
    `${d?.id_code || '?'} · ${d?.instrument_name || ''} · แจ้ง ${fmtRepairDate(o.reported_date)} โดย ${o.reported_by || '–'}`;

  const info = `
    <div style="background:var(--surface2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:13px">
      <div><strong>อาการเสีย:</strong> ${escapeHtmlText(o.symptom || '–')}</div>
      ${o.repair_type ? `<div><strong>ผู้ซ่อม:</strong> ${o.repair_type === 'external' ? 'ภายนอก — ' + escapeHtmlText(o.vendor_name || '–') : 'ภายใน'}</div>` : ''}
      ${o.cause ? `<div><strong>สาเหตุ:</strong> ${escapeHtmlText(o.cause)}</div>` : ''}
      ${o.action_taken ? `<div><strong>การแก้ไข:</strong> ${escapeHtmlText(o.action_taken)}</div>` : ''}
      ${o.cost != null ? `<div><strong>ค่าใช้จ่าย:</strong> ${fmtBaht(o.cost)} บาท</div>` : ''}
      ${o.completed_date ? `<div><strong>วันที่ปิดงาน:</strong> ${fmtRepairDate(o.completed_date)}${o.status === 'completed' ? (o.need_recal ? ' · ต้องสอบเทียบใหม่' : ' · ไม่ต้องสอบเทียบใหม่') : ''}</div>` : ''}
    </div>`;

  let actions = '';
  if (canEdit && o.status === 'reported') actions = `
    <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:10px">
      <div style="font-weight:600;font-size:13px">▶ เริ่มซ่อม</div>
      ${repairField('ซ่อมโดย', `<select id="repType" style="${REP_INPUT_STYLE}" onchange="document.getElementById('repVendorWrap').style.display=this.value==='external'?'':'none'">
        <option value="internal">ภายใน (ซ่อมเอง)</option><option value="external">ภายนอก (ส่งซ่อม)</option></select>`)}
      <div id="repVendorWrap" style="display:none">${repairField('ชื่อผู้ซ่อม / บริษัท', `<input id="repVendor" style="${REP_INPUT_STYLE}">`)}</div>
      <button onclick="repairStart('${o.id}')" style="background:#b91c1c;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-family:var(--font)">เริ่มซ่อม / ส่งซ่อม</button>
    </div>`;
  if (canEdit && o.status === 'in_progress') actions = `
    <div style="border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:10px">
      <div style="font-weight:600;font-size:13px">✅ ปิดงานซ่อม</div>
      ${repairField('สาเหตุ', `<textarea id="repCause" rows="2" style="${REP_INPUT_STYLE}"></textarea>`)}
      ${repairField('การแก้ไข', `<textarea id="repAction" rows="2" style="${REP_INPUT_STYLE}"></textarea>`)}
      ${repairField('ค่าใช้จ่าย (บาท)', `<input id="repCost" type="number" min="0" step="0.01" style="${REP_INPUT_STYLE}">`)}
      ${repairField('วันที่ซ่อมเสร็จ', `<input id="repDone" type="date" value="${new Date().toISOString().slice(0,10)}" style="${REP_INPUT_STYLE}">`)}
      <label style="font-size:13px;display:flex;gap:8px;align-items:center"><input type="checkbox" id="repRecal" checked> ต้องสอบเทียบใหม่หลังซ่อม</label>
      <button onclick="repairComplete('${o.id}')" style="background:#0b7a44;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-family:var(--font)">ปิดงาน — ซ่อมเสร็จ</button>
      <button onclick="repairUnrepairable('${o.id}')" style="background:#7f1d1d;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-family:var(--font)">ปิดงาน — ซ่อมไม่ได้ (ยกเลิกใช้งานเครื่อง)</button>
    </div>`;
  const cancelBtn = canEdit && (o.status === 'reported' || o.status === 'in_progress')
    ? `<button onclick="repairCancelOrder('${o.id}')" style="background:none;border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text3);cursor:pointer;font-family:var(--font);font-size:12px">ยกเลิกใบแจ้งนี้ (แจ้งผิด/ซ้ำ)</button>` : '';

  document.getElementById('repairModalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${info}
      <div><div style="font-weight:600;font-size:13px;margin-bottom:6px">📎 ไฟล์แนบ</div><div id="repairFilesList" class="reg-empty">…</div>
        <input type="file" id="repairFileInput" multiple accept="application/pdf,image/*" style="display:none" onchange="uploadRepairFiles('${o.id}', this)">
        ${canEdit ? `<button onclick="document.getElementById('repairFileInput').click()" style="margin-top:6px;background:none;border:1px dashed var(--border);border-radius:8px;padding:8px 14px;cursor:pointer;font-family:var(--font);font-size:12px">+ แนบไฟล์ (รูป/PDF)</button>` : ''}</div>
      ${actions}
      ${canEdit && o.status === 'unrepairable' && d && !(typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d))
        ? `<button onclick="cancelInstrumentUse(${o.instrument_id}, '${escapeJsSingle(fmtRepairDate(o.completed_date))}').then(ok=>{showToast(ok?'ยกเลิกใช้งานเครื่องแล้ว':'ยังไม่สำเร็จ', ok?'success':'error');renderRepairOrderView('${o.id}')})"
            style="background:#7f1d1d;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-family:var(--font)">⚠️ เครื่องยังไม่ถูกยกเลิกใช้งาน — กดเพื่อลองใหม่</button>` : ''}
      ${cancelBtn}
    </div>`;
  if (typeof loadRepairFiles === 'function') loadRepairFiles(o.id);
}

async function repairStart(orderId) {
  const type = document.getElementById('repType')?.value || 'internal';
  const vendor = document.getElementById('repVendor')?.value.trim() || null;
  if (type === 'external' && !vendor) { showToast('กรุณากรอกชื่อผู้ซ่อม/บริษัท', 'error'); return; }
  if (await updateRepairOrder(orderId, { status: 'in_progress', repair_type: type, vendor_name: vendor }, 'เริ่มซ่อมเครื่องมือ'))
    renderRepairOrderView(orderId);
}

async function repairComplete(orderId) {
  const patch = {
    status: 'completed',
    cause: document.getElementById('repCause')?.value.trim() || null,
    action_taken: document.getElementById('repAction')?.value.trim() || null,
    cost: document.getElementById('repCost')?.value ? Number(document.getElementById('repCost').value) : null,
    completed_date: document.getElementById('repDone')?.value || new Date().toISOString().slice(0, 10),
    need_recal: !!document.getElementById('repRecal')?.checked,
  };
  if (!patch.action_taken) { showToast('กรุณากรอกการแก้ไข', 'error'); return; }
  const o = repairOrders.find(x => x.id === orderId);
  if (!(await updateRepairOrder(orderId, patch, 'ปิดงานซ่อม (ซ่อมเสร็จ)'))) return;
  renderRepairOrderView(orderId);
  if (patch.need_recal && confirm('ซ่อมเสร็จแล้ว — ส่งเครื่องนี้เข้าแผนสอบเทียบเลยหรือไม่?')) {
    closeRepairModal();
    goToPlanWithItem(o.instrument_id);
  }
}

async function repairCancelOrder(orderId) {
  const reason = prompt('เหตุผลที่ยกเลิกใบแจ้งนี้ (จำเป็น):');
  if (!reason || !reason.trim()) return;
  if (await updateRepairOrder(orderId, { status: 'cancelled', action_taken: 'ยกเลิกใบแจ้ง: ' + reason.trim() }, 'ยกเลิกใบแจ้งซ่อม', { reason }))
    renderRepairOrderView(orderId);
}

// Task 5 — ตั้งสถานะเครื่อง "ยกเลิกสอบเทียบ" ผ่าน remark marker
async function cancelInstrumentUse(instrumentId, refDateText) {
  const d = repairInstrument(instrumentId);
  if (!d) return false;
  const clean = typeof window.stripCalibrationCancelMarker === 'function'
    ? window.stripCalibrationCancelMarker(d.remark) : (d.remark || '');
  const note = `ยกเลิกใช้งาน — ซ่อมไม่ได้ (อ้างอิงงานซ่อมวันที่ ${refDateText})`;
  const remark = ['ยกเลิกสอบเทียบ', note, clean].filter(Boolean).join('\n');
  const { error } = await sb.from('instruments').update({ remark }).eq('id', instrumentId);
  if (error) return false;
  logAudit('ยกเลิกใช้งานเครื่อง (ซ่อมไม่ได้)', d, { note });
  try { localStorage.removeItem(getInstrumentCachePrefix() + '_time'); } catch (e) {}
  loadData(true);   // refresh ทะเบียน → badge ยกเลิกสอบเทียบขึ้นทันที
  return true;
}

async function repairUnrepairable(orderId) {
  const o = repairOrders.find(x => x.id === orderId);
  if (!o) return;
  if (!confirm('ยืนยันปิดงานเป็น "ซ่อมไม่ได้" — เครื่องนี้จะถูกยกเลิกใช้งาน (ยกเลิกสอบเทียบ) ทันที?')) return;
  const patch = {
    status: 'unrepairable',
    cause: document.getElementById('repCause')?.value.trim() || null,
    action_taken: document.getElementById('repAction')?.value.trim() || null,
    cost: document.getElementById('repCost')?.value ? Number(document.getElementById('repCost').value) : null,
    completed_date: document.getElementById('repDone')?.value || new Date().toISOString().slice(0, 10),
    need_recal: false,
  };
  if (!(await updateRepairOrder(orderId, patch, 'ปิดงานซ่อม (ซ่อมไม่ได้)'))) return;
  const ok = await cancelInstrumentUse(o.instrument_id, fmtRepairDate(patch.completed_date));
  if (!ok) {
    showToast('ปิดงานแล้ว แต่ตั้งสถานะยกเลิกใช้งานเครื่องไม่สำเร็จ — กดปุ่มลองใหม่ในใบงาน', 'error');
    // ปุ่มลองใหม่: render view จะเห็นสถานะ unrepairable — เพิ่มปุ่ม retry ด้านล่าง
  } else {
    showToast('ปิดงานและยกเลิกใช้งานเครื่องแล้ว', 'success');
  }
  renderRepairOrderView(orderId);
}
// Task 6 — ไฟล์แนบ upload/list/open/delete ผ่าน bucket repair-docs
async function uploadRepairFiles(orderId, input) {
  const files = [...(input?.files || [])];
  if (!files.length) return;
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) { showToast(`${f.name}: ใหญ่เกิน 10MB`, 'error'); continue; }
    const { error } = await sb.storage.from('repair-docs').upload(orderId + '/' + f.name, f, { upsert: true });
    if (error) showToast(`${f.name}: อัปโหลดไม่สำเร็จ — ${error.message}`, 'error');
  }
  input.value = '';
  loadRepairFiles(orderId);
}

async function loadRepairFiles(orderId) {
  const host = document.getElementById('repairFilesList');
  if (!host) return;
  const { data, error } = await sb.storage.from('repair-docs').list(orderId);
  if (error) { host.innerHTML = '<span style="font-size:12px;color:var(--text3)">โหลดไฟล์ไม่สำเร็จ</span>'; return; }
  const files = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  host.innerHTML = files.length ? files.map(f => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px">
      <a href="javascript:void(0)" onclick="openRepairFile('${escapeJsSingle(orderId + '/' + f.name)}')" style="color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis">📄 ${escapeHtmlText(f.name)}</a>
      ${canEdit ? `<a href="javascript:void(0)" onclick="deleteRepairFile('${escapeJsSingle(orderId)}','${escapeJsSingle(f.name)}')" style="color:var(--red);font-size:11px">ลบ</a>` : ''}
    </div>`).join('')
    : '<span style="font-size:12px;color:var(--text3)">ยังไม่มีไฟล์แนบ</span>';
}

async function openRepairFile(path) {
  try {
    const { data, error } = await sb.storage.from('repair-docs').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) throw (error || new Error('no url'));
    window.open(data.signedUrl, '_blank');
  } catch (e) { showToast('เปิดไฟล์ไม่สำเร็จ', 'error'); }
}

async function deleteRepairFile(orderId, name) {
  if (!confirm('ลบไฟล์ ' + name + ' ?')) return;
  const { error } = await sb.storage.from('repair-docs').remove([orderId + '/' + name]);
  if (error) { showToast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  loadRepairFiles(orderId);
}

function closeRepairModal() {
  document.getElementById('repairModal')?.classList.remove('open');
}

// ===== สถิติสำหรับ Dashboard (pure functions — มี browser test ใน tests/repairs.test.html) =====
function aggregateRepairMonthly(orders, now = new Date()) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }
  const TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const labels = months.map(x => TH[x.m] + ' ' + String((x.y + 543) % 100).padStart(2, '0'));
  const counts = months.map(() => 0), costs = months.map(() => 0);
  (orders || []).forEach(o => {
    if (o.status === 'cancelled' || !o.reported_date) return;
    const d = new Date(o.reported_date);
    const idx = months.findIndex(x => x.y === d.getFullYear() && x.m === d.getMonth());
    if (idx < 0) return;
    counts[idx]++;
    costs[idx] += Number(o.cost) || 0;
  });
  return { labels, counts, costs };
}

function computeTopRepairs(orders, rows, n = 5) {
  const byId = {};
  (rows || []).forEach(r => { byId[r.id] = r; });
  const agg = {};
  (orders || []).forEach(o => {
    if (o.status === 'cancelled') return;
    const a = agg[o.instrument_id] || (agg[o.instrument_id] = { instrument_id: o.instrument_id, count: 0, totalCost: 0 });
    a.count++; a.totalCost += Number(o.cost) || 0;
  });
  return Object.values(agg)
    .sort((a, b) => b.count - a.count || b.totalCost - a.totalCost)
    .slice(0, n)
    .map(a => ({ ...a, id_code: byId[a.instrument_id]?.id_code || '?', name: byId[a.instrument_id]?.instrument_name || '–' }));
}

// งานปิดแล้วติ๊ก need_recal แต่เครื่องยังไม่ถูกสอบ/ลงแผนหลังวันปิดงาน
function computeRecalWaiting(orders, rows, planMap) {
  const byId = {};
  (rows || []).forEach(r => { byId[r.id] = r; });
  return (orders || []).filter(o => {
    if (o.status !== 'completed' || !o.need_recal || !o.completed_date) return false;
    const d = byId[o.instrument_id];
    if (!d) return false;
    if (d.cal_date && d.cal_date >= o.completed_date) return false;
    const ps = planMap && planMap[o.instrument_id];
    if (ps && ps.planned_date && ps.planned_date >= o.completed_date) return false;
    return true;
  });
}
