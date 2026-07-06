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
  tbody.innerHTML = '<tr><td colspan="6" class="no-data">กำลังโหลด...</td></tr>';
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
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">โหลดไม่สำเร็จ</td></tr>';
  }
}

function filterAuditLogs() {
  const search = document.getElementById('auditSearch').value.toLowerCase();
  const action = document.getElementById('auditActionFilter').value;
  auditFiltered = auditData.filter(d => {
    if (action && d.action !== action) return false;
    if (search && !['username','id_code','instrument_name','action'].some(k => String(d[k]||'').toLowerCase().includes(search))) return false;
    return true;
  });
  renderAuditTable();
}

function renderAuditTable() {
  const tbody = document.getElementById('auditTable');
  const limitSel = document.getElementById('auditPageSize');
  const countEl = document.getElementById('auditResultCount');
  const displayLimit = limitSel ? Number(limitSel.value || 50) : 50;
  const visibleRows = auditFiltered.slice(0, displayLimit);
  if (countEl) {
    countEl.textContent = auditFiltered.length
      ? `แสดง ${visibleRows.length} จาก ${auditFiltered.length} รายการ`
      : '';
  }
  if (!auditFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">ไม่พบข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = visibleRows.map(d => {
    const actionBadge = d.action === 'เพิ่ม'
      ? '<span class="badge badge-green">➕ เพิ่ม</span>'
      : d.action === 'แก้ไข'
      ? '<span class="badge badge-amber">✏️ แก้ไข</span>'
      : d.action === 'ลบ'
      ? '<span class="badge badge-red">🗑️ ลบ</span>'
      : d.action === 'อัพโหลดไฟล์'
      ? '<span class="badge" style="background:#e0f0ff;color:#0066cc">📎 อัพโหลดไฟล์</span>'
      : d.action === 'ลบไฟล์'
      ? '<span class="badge" style="background:#fce8e8;color:#cc2200">🗂️ ลบไฟล์</span>'
      : d.action === 'วางแผนสอบเทียบ'
      ? '<span class="badge" style="background:#e8f5e9;color:#1b5e20">📅 วางแผน</span>'
      : d.action === 'ยกเลิกแผน'
      ? '<span class="badge" style="background:#f5f5f5;color:#555">❌ ยกเลิกแผน</span>'
      : `<span class="badge" style="background:#f0f0f0;color:#333">${escapeHtmlText(d.action || '–')}</span>`;
    
    const dt = d.created_at ? new Date(d.created_at).toLocaleString('th-TH', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }) : '–';

    let details = '–';
    if (d.changes && typeof d.changes === 'object') {
      details = Object.entries(d.changes).map(([field, val]) => {
        const label = escapeHtmlText(field);
        if (val && typeof val === 'object' && ('from' in val || 'to' in val)) {
          return `<div class="audit-detail-line"><strong>${label}:</strong> <span class="audit-old">${escapeHtmlText(val.from ?? '–')}</span> → <span class="audit-new">${escapeHtmlText(val.to ?? '–')}</span></div>`;
        }
        return `<div class="audit-detail-line"><strong>${label}:</strong> <span class="audit-new">${escapeHtmlText(val ?? '–')}</span></div>`;
      }).join('');
    }

    return `<tr>
      <td class="audit-time">${escapeHtmlText(dt)}</td>
      <td class="audit-user"><strong>${escapeHtmlText(d.username || '–')}</strong></td>
      <td class="audit-action">${actionBadge}</td>
      <td class="audit-id">${escapeHtmlText(d.id_code || '–')}</td>
      <td class="audit-instrument">${escapeHtmlText(d.instrument_name || '–')}</td>
      <td class="audit-details">${details}</td>
    </tr>`;
  }).join('');
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
    ['M', /\bmass\b|\bweight\s*set\b|\bweights\b|standard\s*weight|reference\s*weight|ตุ้มน้ำหนัก|มวลมาตรฐาน/],
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
  if (!calDate || !frequency) return;
  const d = new Date(calDate);
  if (isNaN(d)) return;
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
  } else {
    return;
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  document.getElementById('iDueDate').value = `${yyyy}-${mm}-${dd}`;
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
