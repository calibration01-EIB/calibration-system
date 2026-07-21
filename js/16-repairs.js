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
function openRepairModal(orderId, instrumentId) {}
function closeRepairModal() {
  document.getElementById('repairModal')?.classList.remove('open');
}
