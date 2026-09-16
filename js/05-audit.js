/* ===== 05-audit.js ===== (generated from index.html inline app script) */
// AUDIT LOG
// ====================================================
let auditData = [];
let auditFiltered = [];

async function logAudit(action, instrument, changes) {
  try {
    await sb.from('audit_logs').insert({
      user_id: currentUser?.id || null,
      username: currentUser?.name || 'Unknown',
      action,
      instrument_id: instrument?.id || null,
      id_code: instrument?.id_code || null,
      instrument_name: instrument?.instrument_name || instrument?.instrument_type || null,
      changes: changes || null,
    });
  } catch(e) { console.warn('Audit log failed:', e); }
}

function getDiff(original, updated) {
  const changes = {};
  const fields = {
    instrument_type: 'ประเภท',
    instrument_name: 'เครื่องมือ',
    brand: 'ยี่ห้อ',
    model: 'รุ่น',
    range_val: 'Range',
    capacity: 'พิกัด Max (g)',
    tolerance: 'Tolerance',
    resolution_text: 'ความละเอียด',
    usage_min: 'ใช้งานต่ำสุด',
    usage_max: 'ใช้งานสูงสุด',
    usage_frequency: 'ความถี่ใช้งาน',
    product_group: 'กลุ่มสินค้า',
    usp_type: 'USP Type',
    balance_type: 'ประเภทเครื่องชั่ง',
    serial_no: 'S/N',
    asset_no: 'Asset No.',
    department: 'หน่วยงาน',
    division: 'แผนก',
    id_code: 'ID Code',
    cert_no: 'CERT.',
    cal_date: 'วันสอบเทียบ',
    due_date: 'ครบกำหนด',
    machine_name: 'รหัสเครื่องจักร',
    location: 'สถานที่',
    cal_frequency: 'ความถี่',
    cal_type: 'ภายใน/ภายนอก',
    remark: 'Remark',
    category: 'กลุ่ม',
  };
  for (const [key, label] of Object.entries(fields)) {
    const oldVal = String(original[key] || '');
    const newVal = String(updated[key] || '');
    if (oldVal !== newVal) {
      changes[label] = { from: oldVal || '–', to: newVal || '–' };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

async function loadAuditLogs() {
  const tbody = document.getElementById('auditTable');
  const countEl = document.getElementById('auditResultCount');
  if (countEl) countEl.textContent = '';
  tbody.innerHTML = '<tr><td colspan="5" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    auditData = data || [];
    auditFiltered = [...auditData];
    renderAuditTable();
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" class="no-data">โหลดไม่สำเร็จ</td></tr>';
  }
}

/* ===== Audit Log (ดีไซน์ Calibration App) =====
   audit_logs ไม่มีคอลัมน์ module/role/ip — "เมนู" จึงอนุมานจาก action
   ส่วน IP Address ที่ดีไซน์มี ระบบไม่ได้เก็บ จึงไม่ทำคอลัมน์หลอกไว้        */

const AUDIT_ACTION_META = {
  'เพิ่ม':             ['➕', '#e8f5e9', '#1b5e20', 'รายการเครื่องมือ'],
  'แก้ไข':            ['✏️', '#fdf3dd', '#b45309', 'รายการเครื่องมือ'],
  'ลบ':               ['🗑️', '#fde8e8', '#b91c1c', 'รายการเครื่องมือ'],
  'อัพโหลดไฟล์':      ['📎', '#e0f0ff', '#0066cc', 'ไฟล์ใบรับรอง'],
  'ลบไฟล์':           ['🗂️', '#fde8e8', '#cc2200', 'ไฟล์ใบรับรอง'],
  'วางแผนสอบเทียบ':   ['📅', '#e8f5e9', '#1b5e20', 'วางแผนสอบเทียบ'],
  'ยกเลิกแผน':        ['❌', '#f1f3f5', '#555555', 'วางแผนสอบเทียบ'],
};
function auditMeta(action) {
  return AUDIT_ACTION_META[action] || ['📌', '#f1f3f5', '#3d5a72', 'อื่น ๆ'];
}
function auditModuleOf(d) { return auditMeta(d.action)[3]; }

let auditPage = 1;
function auditFilterChange() { auditPage = 1; renderAuditTable(); }
function auditGoPage(delta) { auditPage += delta; renderAuditTable(); }

function clearAuditFilters() {
  ['auditSearch', 'auditActionFilter', 'auditModuleFilter', 'auditUserFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filterAuditLogs();
}

function renderAuditFilterOptions() {
  const fill = (id, values, allLabel) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${allLabel}</option>` +
      values.map(v => `<option value="${escapeHtmlAttr(v)}">${escapeHtmlText(v)}</option>`).join('');
    sel.value = values.includes(cur) ? cur : '';
  };
  fill('auditModuleFilter', [...new Set(auditData.map(auditModuleOf))].sort(), 'ทุกเมนู');
  fill('auditUserFilter', [...new Set(auditData.map(d => d.username).filter(Boolean))].sort(), 'ทุกผู้ใช้');
}

function renderAuditStats() {
  const host = document.getElementById('auditStats');
  if (!host) return;
  const n = a => auditData.filter(d => d.action === a).length;
  const tiles = [
    ['📚', 'รายการทั้งหมด', auditData.length, '#eef4f9', '#0c4a5e'],
    ['➕', 'เพิ่มเครื่องมือ', n('เพิ่ม'),  '#e8f5e9', '#1b5e20'],
    ['✏️', 'แก้ไขข้อมูล',    n('แก้ไข'),  '#fdf3dd', '#b45309'],
    ['🗑️', 'ลบข้อมูล',       n('ลบ'),     '#fde8e8', '#b91c1c'],
  ];
  host.innerHTML = tiles.map(([emoji, label, value, bg, fg]) => `
    <div class="ax-crc-tile" style="cursor:default">
      <span class="ax-crc-ic" style="background:${bg};border-color:${fg}22">${emoji}</span>
      <span class="ax-crc-tx"><b style="color:${fg}">${value.toLocaleString()}</b><span>${label}</span></span>
    </div>`).join('');
}

function filterAuditLogs() {
  const search = (document.getElementById('auditSearch')?.value || '').toLowerCase();
  const action = document.getElementById('auditActionFilter')?.value || '';
  const moduleF = document.getElementById('auditModuleFilter')?.value || '';
  const userF = document.getElementById('auditUserFilter')?.value || '';
  auditFiltered = auditData.filter(d => {
    if (action && d.action !== action) return false;
    if (moduleF && auditModuleOf(d) !== moduleF) return false;
    if (userF && d.username !== userF) return false;
    if (!search) return true;
    const inChanges = d.changes && typeof d.changes === 'object'
      ? JSON.stringify(d.changes).toLowerCase().includes(search) : false;
    return ['username', 'id_code', 'instrument_name', 'action']
      .some(k => String(d[k] || '').toLowerCase().includes(search)) || inChanges;
  });
  auditPage = 1;
  renderAuditTable();
}

function auditChangeText(changes) {
  if (!changes || typeof changes !== 'object') return '';
  return Object.entries(changes).map(([field, val]) => {
    if (val && typeof val === 'object' && ('from' in val || 'to' in val)) {
      return `${field}: ${val.from ?? '–'} → ${val.to ?? '–'}`;
    }
    return `${field}: ${val ?? '–'}`;
  }).join(' · ');
}

function renderAuditTable() {
  const tbody = document.getElementById('auditTable');
  if (!tbody) return;
  renderAuditStats();
  renderAuditFilterOptions();

  const limitSel = document.getElementById('auditPageSize');
  const size = limitSel ? Number(limitSel.value || 50) : 50;
  const total = auditFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  if (auditPage > totalPages) auditPage = totalPages;
  if (auditPage < 1) auditPage = 1;
  const start = (auditPage - 1) * size;
  const visibleRows = auditFiltered.slice(start, start + size);

  const countEl = document.getElementById('auditResultCount');
  if (countEl) {
    countEl.textContent = total
      ? `พบ ${total.toLocaleString()} รายการ จาก ${auditData.length.toLocaleString()} รายการล่าสุด`
      : 'ไม่พบรายการที่ตรงกับตัวกรอง';
  }
  const pageLabel = document.getElementById('auditPageLabel');
  if (pageLabel) {
    pageLabel.textContent = total
      ? `แสดง ${(start + 1).toLocaleString()}–${(start + visibleRows.length).toLocaleString()} จาก ${total.toLocaleString()} รายการ`
      : 'ไม่มีรายการ';
  }
  const pageNum = document.getElementById('auditPageNum');
  if (pageNum) pageNum.textContent = `หน้า ${auditPage} / ${totalPages}`;
  const prev = document.getElementById('auditPrev');
  const next = document.getElementById('auditNext');
  if (prev) prev.disabled = auditPage <= 1;
  if (next) next.disabled = auditPage >= totalPages;

  const empty = document.getElementById('auditEmpty');
  if (empty) empty.style.display = total ? 'none' : 'flex';
  const wrap = document.getElementById('auditLogTableWrap');
  if (wrap) wrap.style.display = total ? '' : 'none';
  if (!total) { tbody.innerHTML = ''; return; }

  tbody.innerHTML = visibleRows.map(d => {
    const [emoji, tint, color, moduleName] = auditMeta(d.action);
    const dt = d.created_at ? new Date(d.created_at) : null;
    const date = dt ? dt.toLocaleDateString('th-TH-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }) : '–';
    const time = dt ? dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
    const user = d.username || '–';
    const initial = escapeHtmlText(String(user).charAt(0).toUpperCase() || '?');
    const change = auditChangeText(d.changes);
    return `<tr>
      <td class="c-time">
        <span class="ax-audit-when">
          <b>${escapeHtmlText(date)}</b>
          <span>${escapeHtmlText(time)}${time ? ' น.' : ''}</span>
        </span>
      </td>
      <td class="c-user">
        <span class="ax-audit-user">
          <span class="ax-audit-av">${initial}</span>
          <span><b>${escapeHtmlText(user)}</b></span>
        </span>
      </td>
      <td class="c-action">
        <span class="ax-audit-act" style="background:${tint};color:${color}">${emoji} ${escapeHtmlText(d.action || '–')}</span>
      </td>
      <td class="c-module">${escapeHtmlText(moduleName)}</td>
      <td class="c-target">
        <span class="ax-audit-target">
          <span><b>${escapeHtmlText(d.id_code || '–')}</b> ${escapeHtmlText(d.instrument_name || '')}</span>
          ${change ? `<span class="ax-audit-change">${escapeHtmlText(change)}</span>` : ''}
        </span>
      </td>
    </tr>`;
  }).join('');
}

/* Export — audit_logs ไม่มีคอลัมน์ ip/role จึงส่งออกเท่าที่มีจริง */
function auditExportRows() {
  return auditFiltered.map(d => ({
    'วันที่/เวลา': d.created_at ? new Date(d.created_at).toLocaleString('th-TH') : '',
    'ผู้ใช้งาน': d.username || '',
    'การดำเนินการ': d.action || '',
    'เมนู': auditModuleOf(d),
    'ID Code': d.id_code || '',
    'เครื่องมือ': d.instrument_name || '',
    'รายละเอียด': auditChangeText(d.changes),
  }));
}

function exportAuditExcel() {
  if (typeof XLSX === 'undefined') { showToast('ไม่พบไลบรารี XLSX', 'error'); return; }
  const rows = auditExportRows();
  if (!rows.length) { showToast('ไม่มีรายการให้ส่งออก', 'error'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'AuditLog');
  XLSX.writeFile(wb, `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function printAuditLog() {
  const rows = auditExportRows();
  if (!rows.length) { showToast('ไม่มีรายการให้พิมพ์', 'error'); return; }
  const headers = Object.keys(rows[0]);
  const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>Audit Log</title>
    <style>
      body{font-family:"IBM Plex Sans Thai",sans-serif;padding:18px;color:#1b2a37}
      h1{font-size:19px;margin:0 0 4px;color:#16394f}
      p{font-size:12px;color:#5b7186;margin:0 0 14px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#eef4f8;color:#0c4a5e;border:1px solid #9db2c3;padding:6px;text-align:left}
      td{border:1px solid #c6d4de;padding:6px;vertical-align:top}
      @page{size:A4 landscape;margin:10mm}
    </style></head><body>
    <h1>Audit Log — ประวัติการดำเนินการทั้งหมดในระบบ</h1>
    <p>พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')} · ${rows.length.toLocaleString()} รายการ</p>
    <table><thead><tr>${headers.map(h => `<th>${escapeHtmlText(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${escapeHtmlText(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { showToast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์', 'error'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}


// คืนค่า string 'YYYY-MM-DD' (ใช้ใน Import ไม่ต้องแตะ DOM)
// ====================================================
// CERT TYPE MAP — instrument_type / instrument_name → type_code
// ====================================================
const CERT_TYPE_MAP = {
  'เครื่องชั่ง (Balance)':                   'B',
  'เครื่องชั่ง':                              'B',
  'Balance':                                  'B',
  'Electronic Balance':                       'B',
  'Analytical Balance':                       'B',
  'Precision Balance':                        'B',
  'ตุ้มน้ำหนักมาตรฐาน (Mass)':                'M',
  'มวล/น้ำหนัก (Mass/Weight)':               'B',
  'ความยาว/มิติ (Length/Dimension)':          'L',
  'อุณหภูมิ/ความชื้น (Temperature/Humidity)': 'T',
  'ความดัน/สุญญากาศ (Pressure/Vacuum)':       'P',
  'ความเร็วรอบ (Speed/Rotation)':             'H',
  'เวลา (Time)':                              'W',
  'เคมี/ความเข้มข้น (Chemical/Concentration)':'C',
  'ความหนืด/ความหนาแน่น (Viscosity/Density)': 'C',
  'ไฟฟ้า (Electrical)':                       '',
  'การไหล/ปริมาตร (Flow/Volume)':             'Q',
  'แสง/เสียง (Light/Sound)':                  '',
  'ความปลอดภัย (Safety)':                     '',
  'แรงบิด/แรงกด (Torque/Force)':              'F',
  'อื่นๆ (Others)':                           '',
};

function getCertTypeCode(instrumentType, instrumentName = '') {
  const type = String(instrumentType || '').trim();
  const name = String(instrumentName || '').toLowerCase();
  const typeText = type.toLowerCase();
  const nameRules = [
    ['C', /\bph\b|p\.h\.|viscometer|visco|\bdo\s*meter\b|dissolved\s*oxygen|ความหนืด/],
    ['D', /digital\s*caliper|digitol\s*caliper|vernier\s*caliper|\bcaliper\b|ดิจิตอล|เวอร์เนียร์/],
    ['R', /steel\s*ruler|\bruler\b|tape\s*measure|ตลับเมตร|ไม้บรรทัด/],
    ['L', /thickness\s*gauge|micrometer|\bmicro\b|depth\s*gauge|height\s*gauge|penetrometer|profile\s*(projector|protector)|linear\s*scale/],
    ['Q', /flow\s*meter|\bflow\b|การไหล/],
    ['G', /moisture\s*tester|\bmoisture\b/],
    ['T', /temperature|thermometer|\btemp\b|อุณหภูมิ/],
    ['H', /tachometer|\brpm\b|speed|rotation|ความเร็วรอบ/],
    ['W', /timer|stopwatch|\btime\b|เวลา/],
    ['P', /pressure|ความดัน/],
    ['F', /force|torque|แรงบิด|แรงกด/],
    ['M', /\bmass\b|\bweights?\b|standard\s*weight|reference\s*weight|ตุ้มน้ำหนัก|มวลมาตรฐาน/],
    ['B', /\bbalance\b|electronic\s*scale|weighing\s*scale|weighing\s*machine|เครื่องชั่ง/],
  ];
  for (const [code, pattern] of nameRules) {
    if (pattern.test(name)) return code;
  }
  const mappedType = CERT_TYPE_MAP[type] || '';
  if (mappedType) return mappedType;
  for (const [code, pattern] of nameRules) {
    if (pattern.test(typeText)) return code;
  }
  return '';
}


function calcDueDateStr(calDate, frequency) {
  if (!calDate || !frequency) return null;
  const d = new Date(calDate);
  if (isNaN(d)) return null;
  const f = frequency.toLowerCase();
  if (f.includes('2ครั้ง') || (f.includes('2') && f.includes('ครั้ง/ปี'))) {
    d.setMonth(d.getMonth() + 6);
  } else if (f.includes('4ครั้ง') || (f.includes('4') && f.includes('ครั้ง/ปี'))) {
    d.setMonth(d.getMonth() + 3);
  } else if (f.includes('3ปี') || (f.includes('3') && (f.includes('ปี') || f.includes('year')))) {
    d.setFullYear(d.getFullYear() + 3);
  } else if (f.includes('2ปี') || (f.includes('2') && (f.includes('ปี') || f.includes('year')))) {
    d.setFullYear(d.getFullYear() + 2);
  } else if (f.includes('6') && (f.includes('เดือน') || f.includes('month'))) {
    d.setMonth(d.getMonth() + 6);
  } else if (f.includes('3') && (f.includes('เดือน') || f.includes('month'))) {
    d.setMonth(d.getMonth() + 3);
  } else if (f.includes('ปี') || f.includes('year') || f.includes('/ปี') || f.includes('ครั้ง/ปี')) {
    d.setFullYear(d.getFullYear() + 1);
  } else if (f.includes('เดือน') || f.includes('month')) {
    d.setMonth(d.getMonth() + 6);
  } else { return null; }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function calcDueDate(calDate, frequency) {
  const isoDate = parseInstrumentDate(calDate);
  document.getElementById('iDueDate').value = formatInstrumentDate(calcDueDateStr(isoDate, frequency));
}


// ====================================================
// UI HELPERS
// ====================================================
function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'กำลังโหลด...';
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}
function setDriveStatus(ok, text) {
  document.getElementById('statusDot').className = 'status-dot ' + (ok ? 'ok' : 'error');
  document.getElementById('statusText').textContent = text;
}
let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}


// ====================================================
