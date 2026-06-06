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
    range_val: 'Range',
    tolerance: 'Tolerance',
    serial_no: 'S/N',
    department: 'หน่วยงาน',
    id_code: 'ID Code',
    cert_no: 'CERT.',
    cal_date: 'วันสอบเทียบ',
    due_date: 'ครบกำหนด',
    machine_name: 'ชื่อเครื่องจักร',
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
  if (!auditFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">ไม่พบข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = auditFiltered.map(d => {
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
      : `<span class="badge" style="background:#f0f0f0;color:#333">${d.action}</span>`;
    
    const dt = d.created_at ? new Date(d.created_at).toLocaleString('th-TH', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }) : '–';

    let details = '–';
    if (d.changes && typeof d.changes === 'object') {
      details = Object.entries(d.changes).map(([field, val]) => {
        if (val && typeof val === 'object' && ('from' in val || 'to' in val)) {
          return `<div><strong>${field}:</strong> <span style="color:var(--red)">${val.from ?? '–'}</span> → <span style="color:var(--green)">${val.to ?? '–'}</span></div>`;
        }
        return `<div><strong>${field}:</strong> <span style="color:var(--green)">${val}</span></div>`;
      }).join('');
    }

    return `<tr>
      <td style="white-space:nowrap">${dt}</td>
      <td><strong>${d.username||'–'}</strong></td>
      <td>${actionBadge}</td>
      <td style="font-family:var(--mono)">${d.id_code||'–'}</td>
      <td>${d.instrument_name||'–'}</td>
      <td>${details}</td>
    </tr>`;
  }).join('');
}


// คืนค่า string 'YYYY-MM-DD' (ใช้ใน Import ไม่ต้องแตะ DOM)
// ====================================================
// CERT TYPE MAP — instrument_type → type_code
// ====================================================
const CERT_TYPE_MAP = {
  'มวล/น้ำหนัก (Mass/Weight)':               'B',
  'ความยาว/มิติ (Length/Dimension)':          'L',
  'อุณหภูมิ/ความชื้น (Temperature/Humidity)': 'C',
  'ความดัน/สุญญากาศ (Pressure/Vacuum)':       'P',
  'ความเร็วรอบ (Speed/Rotation)':             'G',
  'เวลา (Time)':                              'Q',
  'เคมี/ความเข้มข้น (Chemical/Concentration)':'D',
  'ความหนืด/ความหนาแน่น (Viscosity/Density)': 'M',
  'ไฟฟ้า (Electrical)':                       'E',
  'การไหล/ปริมาตร (Flow/Volume)':             'H',
  'แสง/เสียง (Light/Sound)':                  'F',
  'ความปลอดภัย (Safety)':                     'T',
  'แรงบิด/แรงกด (Torque/Force)':              'T',
  'อื่นๆ (Others)':                           'Q',
};

function getCertTypeCode(instrumentType) {
  return CERT_TYPE_MAP[instrumentType] || 'B';
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
