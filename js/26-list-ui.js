/* ============================================================
   26-list-ui.js — หน้า "รายการเครื่องมือ" ตามดีไซน์ Calibration App
   3 มุมมอง: สเปก / บัญชีรายการ / การ์ด + ชิปสถานะ + pager แบบใหม่
   แทน renderTable() เดิม (02-dashboard.js) แต่ยังใช้ตัวกรอง/pagination เดิมทั้งหมด
   ต้องโหลดหลัง 02-dashboard.js / 04-reports.js / 10-router.js
   ============================================================ */

const LIST_VIEWS = [
  { k: 'spec', label: 'มุมมองสเปก',      sub: 'ย่าน · ความละเอียด · ค่ายอมรับ' },
  { k: 'full', label: 'บัญชีรายการ',      sub: 'ทุกคอลัมน์ตามฟอร์ม' },
  { k: 'card', label: 'มุมมองการ์ด',      sub: 'อ่านง่าย เหมาะกับจอเล็ก' }
];

let listView = (() => {
  try { return localStorage.getItem('axListView') || 'spec'; } catch (e) { return 'spec'; }
})();

const LIST_STATUS_CHIPS = [
  { v: '',          emoji: '📋', label: 'ทั้งหมด',    bg: '#eef4f9', fg: '#0c4a5e', bd: '#d5e1ea' },
  { v: 'overdue',   emoji: '🔴', label: 'เลยกำหนด',   bg: '#fde8e8', fg: '#d93a3a', bd: '#f6cfcf' },
  { v: 'warning',   emoji: '🟡', label: 'ใกล้ครบ',    bg: '#fdf3dd', fg: '#b45309', bd: '#f3e0b6' },
  { v: 'ok',        emoji: '🟢', label: 'ปกติ',       bg: '#e1f5ee', fg: '#0f6e56', bd: '#c4e8dc' },
  { v: 'cancelled', emoji: '⛔', label: 'ยกเลิกสอบเทียบ', bg: '#eef0f3', fg: '#5f6b7a', bd: '#dfe4ea' }
];

/* ---------- helper ---------- */

function listLines(value) {
  // แยกหลายย่านจาก newline หรือสแลชที่คั่นระหว่างค่าวัด (มี/ไม่มีช่องว่างก็ได้)
  // เงื่อนไข: หลังสแลชต้องขึ้นต้นด้วยตัวเลข หรือเครื่องหมาย ± + - < > ~ แล้วตามด้วยตัวเลข
  // → แยก "0.01mg/0.1mg", "0.01 mg / 0.1 mg", "± 0.05 mg/± 0.2 mg"
  // → ไม่แยกหน่วยที่มีสแลชในตัว: mg/L, kg/cm2, N/A, 0.5 mg/kg, 10 °C/min
  const parts = String(value == null ? '' : value)
    .split(/\r?\n|\s*\/\s*(?=[±+\-<>~]?\s*\d)/)
    .map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : ['–'];
}

function listMultiHtml(value) {
  return '<span class="ax-ml">' + listLines(value)
    .map(t => `<span>${escapeHtmlText(t)}</span>`).join('') + '</span>';
}

function listRangeText(d) {
  if (d.range_val) return d.range_val;
  if (d.capacity != null && d.capacity !== '') return `${d.capacity} ${d.capacity_unit || 'g'}`;
  return '';
}

function listStatusPill(d) {
  const cancelled = d.calibration_cancelled === true
    || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
  const days = d.days_left;
  if (cancelled) return { bg: '#eef0f3', fg: '#5f6b7a', emoji: '⛔', text: 'ยกเลิกสอบเทียบ', days: 'ยกเลิกสอบเทียบ', cancelled: true };
  if (days === null || days === undefined) return { bg: '#eef0f3', fg: '#5f6b7a', emoji: '⚪', text: 'ไม่ระบุ', days: '–', cancelled: false };
  if (days < 0)  return { bg: '#fde8e8', fg: '#d93a3a', emoji: '🔴', text: 'เลยกำหนด', days: 'เกิน ' + Math.abs(days) + ' วัน', cancelled: false };
  if (days <= 30) return { bg: '#fdf3dd', fg: '#b45309', emoji: '🟡', text: 'ใกล้ครบ', days: days === 0 ? 'วันนี้' : 'อีก ' + days + ' วัน', cancelled: false };
  return { bg: '#e1f5ee', fg: '#0f6e56', emoji: '🟢', text: 'ปกติ', days: 'อีก ' + days + ' วัน', cancelled: false };
}

function listProgressPct(d) {
  if (!d.cal_date || !d.due_date || d.days_left === null || d.days_left === undefined) return 0;
  const total = (new Date(d.due_date) - new Date(d.cal_date)) / 86400000;
  if (!(total > 0)) return 100;
  return Math.max(0, Math.min(100, Math.round((total - d.days_left) / total * 100)));
}

/* ปุ่มงานท้ายแถว (ไฟล์ / วางแผน / ลบ) — ดีไซน์ไม่มีคอลัมน์นี้
   แต่ระบบใช้งานจริงอยู่ จึงคงไว้เป็นคอลัมน์เดียวรวบท้ายตาราง */
function listActionCell(d) {
  const id = Number(d.id) || 0;
  const cancelled = d.calibration_cancelled === true
    || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
  const cnt = typeof fileCountCache !== 'undefined' ? fileCountCache[d.id] : undefined;
  const openCertCall = `openCertModal(${id},'${escapeJsSingle(d.id_code)}','${escapeJsSingle(d.cert_no)}','${escapeJsSingle(d.instrument_name)}')`;
  const fileBtn = `<button type="button" id="certbtn-${id}" class="btn-cert ${cnt > 0 ? 'btn-cert-has' : 'btn-cert-empty'}" onclick="${openCertCall}">📎 ${cnt > 0 ? cnt + ' ไฟล์' : 'ไฟล์'}</button>`;

  let planBtn;
  const ps = typeof planStatusMap !== 'undefined' ? planStatusMap[d.id] : null;
  if (cancelled) {
    planBtn = '<span class="ax-act-mute">ไม่ต้องวางแผน</span>';
  } else if (!ps) {
    planBtn = `<button type="button" class="ax-act-plan" onclick="goToPlanWithItem(${id})">📋 วางแผน</button>`;
  } else {
    const sMap = {
      pending_plan: ['🟡 รอยืนยันแผน', '#854F0B', '#FAEEDA'],
      planned:      ['✅ วางแผนแล้ว',  '#3B6D11', '#EAF3DE'],
      pending_cert: ['🔵 รอยืนยันสอบ', '#185FA5', '#E6F1FB'],
      completed:    ['🏆 สอบเทียบแล้ว', '#0F6E56', '#E1F5EE']
    };
    const [lbl, color, bg] = sMap[ps.status] || ['–', '#888', '#f5f5f5'];
    planBtn = `<button type="button" class="ax-act-plan" style="background:${bg};color:${color};border-color:${color}40" title="ดูแผน: ${escapeHtmlAttr(ps.title || '')}" onclick="goToPlanDetail(${id})">${lbl}</button>`;
  }

  const canEdit = typeof currentUser !== 'undefined'
    && (currentUser?.role === 'admin' || currentUser?.role === 'editor');
  const delBtn = canEdit
    ? `<button type="button" class="btn-del" onclick="deleteInstrument(${id},'${escapeJsSingle(d.instrument_name || '')}')">🗑️</button>`
    : '';

  return `<span class="ax-actcell">${fileBtn}${planBtn}${delBtn}</span>`;
}

/* ---------- ชิปสถานะ ---------- */

function renderListStatusChips() {
  const host = document.getElementById('listStatusChips');
  if (!host) return;
  const rows = typeof allData !== 'undefined' ? (allData || []) : [];
  const counts = { '': rows.length, overdue: 0, warning: 0, ok: 0, cancelled: 0 };
  rows.forEach(d => {
    const s = typeof window.getListRowStatus === 'function' ? window.getListRowStatus(d) : null;
    if (s && counts[s] !== undefined) counts[s]++;
  });
  const active = document.getElementById('statusFilter')?.value || '';
  host.innerHTML = LIST_STATUS_CHIPS.map(c => {
    const on = active === c.v;
    const style = on
      ? `background:${c.bg};border-color:${c.fg}66;color:${c.fg}`
      : 'background:#fff;border-color:#d7e3ec;color:#4a6377';
    return `<button type="button" class="ax-chip${on ? ' is-on' : ''}" style="${style}" onclick="listSetStatus('${c.v}')">
      <span class="ax-chip-e">${c.emoji}</span><span>${c.label}</span><b>${(counts[c.v] || 0).toLocaleString()}</b>
    </button>`;
  }).join('');
}

function listSetStatus(value) {
  const sel = document.getElementById('statusFilter');
  if (sel) sel.value = sel.value === value ? '' : value;
  if (typeof filterData === 'function') filterData();
}

/* ---------- พิลหมวดเครื่องมือ (ทับของเดิมเพื่อใส่ชิปตัวอักษรตามดีไซน์) ---------- */

renderListCategoryPills = window.renderListCategoryPills = function () {
  const strip = document.getElementById('listCategoryStrip');
  if (!strip) return;
  const rows = typeof allData !== 'undefined' ? (allData || []) : [];
  const totals = {};
  rows.forEach(d => {
    const type = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    if (type) totals[type] = (totals[type] || 0) + 1;
  });
  const current = document.getElementById('typeFilter')?.value || '';

  const pill = (active, onclick, letter, color, label, count) => `
    <button type="button" class="reg-pill${active ? ' active' : ''}" onclick="${onclick}">
      <span class="ax-pill-letter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
      <span>${escapeHtmlText(label)}</span>
      <strong>${count.toLocaleString()}</strong>
    </button>`;

  strip.innerHTML = pill(!current, "setListCategory('')", '★', '#0f8f7d', 'ทั้งหมด', rows.length)
    + Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
      const [letter, , color] = regTypeMeta(type);
      return pill(current === type, `setListCategory('${escapeJsSingle(type)}')`, letter, color, type.split(' (')[0], count);
    }).join('');
};

/* ---------- แท็บมุมมอง ---------- */

function renderListViewTabs() {
  const host = document.getElementById('listViewTabs');
  if (!host) return;
  host.innerHTML = LIST_VIEWS.map(v => `
    <button type="button" class="ax-vtab${listView === v.k ? ' is-on' : ''}" onclick="listSetView('${v.k}')">
      <b>${v.label}</b><span>${v.sub}</span>
    </button>`).join('');
}

function listSetView(view) {
  listView = view;
  try { localStorage.setItem('axListView', view); } catch (e) {}
  renderListViewTabs();
  if (typeof renderTable === 'function') renderTable();
}

/* ---------- มุมมองสเปก ---------- */

function renderListSpec(rows, start) {
  const tbody = document.getElementById('dataTable');
  if (!tbody) return;
  tbody.innerHTML = rows.map((d, i) => {
    const id = Number(d.id) || 0;
    const displayType = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    const [letter, , color] = regTypeMeta(displayType, d);
    const p = listStatusPill(d);
    const brandModel = [d.brand, d.model].filter(Boolean).map(escapeHtmlText).join(' ') || '–';
    return `<tr class="${p.cancelled ? 'reg-cancelled' : ''}" onclick="if(!event.target.closest('button'))openInstrumentDetail(${id})" title="คลิกเพื่อดูรายละเอียด">
      <td class="c-no">${start + i + 1}</td>
      <td class="c-name">
        <div class="ax-namecell">
          <span class="ax-tletter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
          <span class="ax-nametx">
            ${listMultiHtml(d.instrument_name)}
            <span class="ax-sub">${brandModel}</span>
          </span>
        </div>
      </td>
      <td class="c-cert"><span class="ax-mono">${escapeHtmlText(d.cert_no || '–')}</span></td>
      <td class="c-id">
        <span class="ax-idcell">
          ${listLines(d.id_code).map(t => `<span class="ax-idtag">${escapeHtmlText(t)}</span>`).join('')}
          <span class="ax-sub">${escapeHtmlText(d.machine_name || '–')}</span>
        </span>
      </td>
      <td class="c-range">${listMultiHtml(listRangeText(d))}</td>
      <td class="c-res">${listMultiHtml(d.resolution_text || d.resolution)}</td>
      <td class="c-tol">${listMultiHtml(d.tolerance)}</td>
      <td class="c-cal"><b>${formatDate(d.cal_date)}</b></td>
      <td class="c-due">
        <span class="ax-duecell">
          <b>${p.cancelled ? '–' : formatDate(d.due_date)}</b>
          <span style="color:${p.fg}">${escapeHtmlText(p.days)}</span>
        </span>
      </td>
      <td class="c-method">
        <span class="ax-tagrow">
          <span class="ax-tag">${escapeHtmlText(d.cal_type || '–')}</span>
          <span class="ax-tag">${escapeHtmlText(d.cal_frequency || '–')}</span>
        </span>
      </td>
      <td class="c-status">
        <span class="ax-pill" style="background:${p.bg};color:${p.fg}">${p.emoji} ${escapeHtmlText(p.text)}</span>
        ${typeof repairBadgeHtml === 'function' && repairBadgeHtml(d.id) ? '<br>' + repairBadgeHtml(d.id) : ''}
      </td>
      <td class="c-act">${listActionCell(d)}</td>
    </tr>`;
  }).join('');
}

/* ---------- มุมมองบัญชีรายการ ---------- */

function renderListFull(rows, start) {
  const tbody = document.getElementById('dataTableFull');
  if (!tbody) return;
  tbody.innerHTML = rows.map((d, i) => {
    const id = Number(d.id) || 0;
    const displayType = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    const [letter, , color] = regTypeMeta(displayType, d);
    const p = listStatusPill(d);
    const internal = d.cal_type === 'ภายใน' ? '✓' : '';
    const external = d.cal_type === 'ภายนอก' ? '✓' : '';
    return `<tr class="${p.cancelled ? 'reg-cancelled' : ''}" onclick="openInstrumentDetail(${id})" title="คลิกเพื่อดูรายละเอียด">
      <td class="c-no">${start + i + 1}</td>
      <td class="c-name">
        <div class="ax-namecell">
          <span class="ax-tletter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
          <span class="ax-nametx">${listMultiHtml(d.instrument_name)}</span>
        </div>
      </td>
      <td class="ax-mono">${escapeHtmlText(d.machine_name || '–')}</td>
      <td>${listMultiHtml(d.id_code)}</td>
      <td>${escapeHtmlText(d.brand || '–')}</td>
      <td class="ax-mono">${escapeHtmlText(d.model || '–')}</td>
      <td class="ax-mono">${escapeHtmlText(d.serial_no || '–')}</td>
      <td>${listMultiHtml(d.resolution_text || d.resolution)}</td>
      <td>${listMultiHtml(d.tolerance)}</td>
      <td>${listMultiHtml(listRangeText(d))}</td>
      <td>${escapeHtmlText(d.usage_min || '–')}</td>
      <td>${escapeHtmlText(d.usage_max || '–')}</td>
      <td>${escapeHtmlText(d.usage_frequency || '–')}</td>
      <td>${escapeHtmlText(d.cal_frequency || '–')}</td>
      <td class="c-loc">${escapeHtmlText([d.department, d.division, d.location].filter(Boolean).join(' · ') || '–')}</td>
      <td class="ax-mark">${internal}</td>
      <td class="ax-mark">${external}</td>
      <td class="ax-usp">${escapeHtmlText(d.usp_type || '–')}</td>
      <td class="c-status"><span class="ax-pill" style="background:${p.bg};color:${p.fg}">${p.emoji} ${escapeHtmlText(p.text)}</span></td>
    </tr>`;
  }).join('');
}

/* ---------- มุมมองการ์ด ---------- */

function renderListCards(rows) {
  const host = document.getElementById('listCardCard');
  if (!host) return;
  host.innerHTML = rows.map(d => {
    const id = Number(d.id) || 0;
    const displayType = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    const [letter, , color] = regTypeMeta(displayType, d);
    const p = listStatusPill(d);
    const pct = listProgressPct(d);
    const ids = listLines(d.id_code);
    const idTag = ids[0] + (ids.length > 1 ? ` +${ids.length - 1}` : '');
    return `<button type="button" class="ax-icard" onclick="openInstrumentDetail(${id})">
      <div class="ax-icard-top">
        <span class="ax-tletter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
        <span class="ax-icard-hd">
          <span class="ax-icard-name">${escapeHtmlText(listLines(d.instrument_name)[0])}</span>
          <span class="ax-icard-meta">
            <span class="ax-idtag">${escapeHtmlText(idTag)}</span>
            <span>${escapeHtmlText([d.department, d.location].filter(Boolean).join(' · ') || '–')}</span>
          </span>
        </span>
        <span class="ax-pill" style="background:${p.bg};color:${p.fg}">${p.emoji} ${escapeHtmlText(p.text)}</span>
      </div>
      <div class="ax-icard-specs">
        <span><i>RANGE</i><b>${escapeHtmlText(listRangeText(d) || '–')}</b></span>
        <span><i>RESOLUTION</i><b>${escapeHtmlText(d.resolution_text || d.resolution || '–')}</b></span>
        <span><i>TOLERANCE</i><b>${escapeHtmlText(d.tolerance || '–')}</b></span>
      </div>
      <div class="ax-icard-prog">
        <span class="ax-bar"><span style="width:${pct}%;background:${p.fg}"></span></span>
        <span class="ax-icard-dates">
          <span>${formatDate(d.cal_date)}</span>
          <span style="color:${p.fg};font-weight:700">${escapeHtmlText(p.days)}</span>
          <span style="font-weight:600">${p.cancelled ? '–' : formatDate(d.due_date)}</span>
        </span>
      </div>
      <div class="ax-tagrow">
        <span class="ax-tag ax-tag-usp">Type ${escapeHtmlText(d.usp_type || '–')}</span>
        <span class="ax-tag">${escapeHtmlText(d.cal_type || '–')}</span>
        <span class="ax-tag">${escapeHtmlText(d.cal_frequency || '–')}</span>
      </div>
    </button>`;
  }).join('');
}

/* ---------- ตัววาดหลัก (แทน renderTable เดิม) ---------- */

function renderListPage() {
  if (typeof window.normalizeListRows === 'function') {
    window.normalizeListRows(typeof allData !== 'undefined' ? allData : []);
    window.normalizeListRows(typeof filteredData !== 'undefined' ? filteredData : []);
  }

  const rowsAll = typeof filteredData !== 'undefined' ? (filteredData || []) : [];
  const size = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 100;
  const totalPages = Math.max(1, Math.ceil(rowsAll.length / size));
  if (typeof currentPage !== 'number' || currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * size;
  const pageRows = rowsAll.slice(start, start + size);

  const empty = rowsAll.length === 0;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('listSpecCard', !empty && listView === 'spec');
  show('listFullCard', !empty && listView === 'full');
  show('listCardCard', !empty && listView === 'card');
  show('listEmpty', empty);

  if (empty) {
    const tb = document.getElementById('dataTable');
    if (tb) tb.innerHTML = '<tr><td colspan="12" class="no-data">ไม่พบข้อมูล</td></tr>';
    const tf = document.getElementById('dataTableFull');
    if (tf) tf.innerHTML = '<tr><td colspan="19" class="no-data">ไม่พบข้อมูล</td></tr>';
    const hc = document.getElementById('listCardCard');
    if (hc) hc.innerHTML = '';
  } else if (listView === 'spec') {
    renderListSpec(pageRows, start);
  } else if (listView === 'full') {
    renderListFull(pageRows, start);
  } else {
    renderListCards(pageRows);
  }

  const label = document.getElementById('listResultLabel');
  if (label) {
    const total = typeof allData !== 'undefined' ? (allData || []).length : 0;
    label.textContent = rowsAll.length === total
      ? `ทั้งหมด ${total.toLocaleString()} รายการ`
      : `พบ ${rowsAll.length.toLocaleString()} รายการ จากทั้งหมด ${total.toLocaleString()} รายการ`;
  }

  renderListStatusChips();
  if (typeof updatePaginationUI === 'function') updatePaginationUI();
  if (typeof updateFileCounts === 'function' && listView === 'spec') updateFileCounts(pageRows);
  if (typeof renderMobileCards === 'function') renderMobileCards();
}

/* แทนที่ renderTable เดิม (10-router ห่อไว้เพื่อ normalize — เราทำเองแล้ว) */
renderTable = window.renderTable = renderListPage;

/* หมายเหตุ: toggleManageColumns ถูกทำให้ null-safe ที่ต้นทาง (03-instruments.js) แล้ว
   ห้าม override ที่นี่ เพราะ enterApp() เรียกมันตั้งแต่ตอนโหลด 10-router.js
   ซึ่งเร็วกว่าไฟล์นี้ — ตัวที่ทำงานจริงคือของ 03-instruments.js เสมอ */

document.addEventListener('DOMContentLoaded', () => {
  renderListViewTabs();
  renderListStatusChips();
});
