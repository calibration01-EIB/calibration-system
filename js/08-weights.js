/* ===== 08-weights.js ===== (generated from index.html inline app script) */
// STANDARD WEIGHTS (ลูกตุ้มมาตรฐาน)
// ====================================================
let swData = [], swFiltered = [];
let editingSWId = null;

async function loadStandardWeights() {
  const tbody = document.getElementById('swTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('standard_weights').select('*').order('nominal_value');
    if (error) throw error;
    swData = data || [];
    filterSW();
  } catch(e) {
    console.error('loadStandardWeights:', e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="no-data" style="color:var(--red)">โหลดข้อมูลไม่ได้: ' + e.message + '</td></tr>';
  }
}

function getSWStatus(dueDateStr) {
  if (!dueDateStr) return { text: '–', badge: 'background:#eee;color:#888', days: null, key: '' };
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueDateStr);
  const days = Math.floor((due - now) / 86400000);
  if (days < 0) return { text: 'หมดอายุ ' + Math.abs(days) + ' วัน', badge: 'background:#fce8e8;color:var(--red)', days, key: 'expired' };
  if (days <= 30) return { text: 'อีก ' + days + ' วัน', badge: 'background:#fff8e1;color:var(--amber)', days, key: 'warn' };
  return { text: 'อีก ' + days + ' วัน', badge: 'background:#e8f5e9;color:var(--green)', days, key: 'ok' };
}

function filterSW() {
  const q = (document.getElementById('swSearch')?.value || '').toLowerCase();
  const cls = document.getElementById('swClassFilter')?.value || '';
  const st = document.getElementById('swStatusFilter')?.value || '';
  swFiltered = swData.filter(w => {
    const matchQ = !q || [w.id_code, w.serial_no, w.cert_no, w.manufacturer, String(w.nominal_value)].some(v => (v||'').toLowerCase().includes(q));
    const matchC = !cls || w.class_grade === cls;
    const matchS = !st || getSWStatus(w.due_date).key === st;
    return matchQ && matchC && matchS;
  });
  renderSWStats();
  renderSWTable();
}

function renderSWStats() {
  let ok = 0, warn = 0, exp = 0;
  swData.forEach(w => {
    const k = getSWStatus(w.due_date).key;
    if (k === 'ok') ok++;
    else if (k === 'warn') warn++;
    else if (k === 'expired') exp++;
  });
  const s = id => document.getElementById(id);
  if (s('swTotal')) s('swTotal').textContent = swData.length;
  if (s('swOk')) s('swOk').textContent = ok;
  if (s('swWarn')) s('swWarn').textContent = warn;
  if (s('swExpired')) s('swExpired').textContent = exp;
}

function fmtDateTH(dateStr) {
  if (!dateStr) return '–';
  const parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + (parseInt(parts[0]) + 543);
}

function renderSWTable() {
  const tbody = document.getElementById('swTableBody');
  if (!tbody) return;
  if (!swFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-data">ไม่พบข้อมูล</td></tr>';
    return;
  }
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  tbody.innerHTML = swFiltered.map(w => {
    const st = getSWStatus(w.due_date);
    return '<tr>' +
      '<td><strong>' + (w.id_code || '–') + '</strong></td>' +
      '<td>' + w.nominal_value + ' ' + w.unit + '</td>' +
      '<td>' + (w.actual_value != null ? w.actual_value + ' ' + w.unit : '–') + '</td>' +
      '<td><span class="badge" style="background:var(--accent-light);color:var(--accent)">' + (w.class_grade || '–') + '</span></td>' +
      '<td>' + (w.serial_no || '–') + '</td>' +
      '<td>' + (w.cert_no || '–') + '</td>' +
      '<td>' + fmtDateTH(w.cal_date) + '</td>' +
      '<td>' + fmtDateTH(w.due_date) + '</td>' +
      '<td><span class="badge" style="' + st.badge + '">' + st.text + '</span></td>' +
      '<td style="white-space:nowrap">' +
        (canEdit
          ? '<button onclick="openSWModal(' + w.id + ')" style="background:var(--accent-light);color:var(--accent);border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">✏️ แก้ไข</button>' +
            '<button onclick="deleteSW(' + w.id + ',\'' + (w.id_code || '').replace(/'/g,"\\'") + '\')" style="background:#fce8e8;color:var(--red);border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font);margin-left:4px">🗑️ ลบ</button>'
          : '–') +
      '</td>' +
    '</tr>';
  }).join('');
}

function openSWModal(id) {
  id = id || null;
  editingSWId = id;
  const modal = document.getElementById('swModal');
  const title = document.getElementById('swModalTitle');
  if (!modal) return;
  ['swIdCode','swNominal','swActual','swUncertainty','swSerial','swCertNo','swManufacturer','swCalDate','swDueDate','swRemark']
    .forEach(function(fid) { var el = document.getElementById(fid); if(el) el.value = ''; });
  var u = document.getElementById('swUnit'); if(u) u.value = 'g';
  var c = document.getElementById('swClass'); if(c) c.value = '';

  if (id) {
    const w = swData.find(function(x){ return x.id === id; });
    if (w) {
      title.textContent = '✏️ แก้ไขลูกตุ้มมาตรฐาน';
      var set = function(fid, val) { var el = document.getElementById(fid); if(el) el.value = val != null ? val : ''; };
      set('swIdCode', w.id_code); set('swNominal', w.nominal_value); set('swActual', w.actual_value);
      set('swUncertainty', w.uncertainty); set('swSerial', w.serial_no); set('swCertNo', w.cert_no);
      set('swManufacturer', w.manufacturer); set('swCalDate', w.cal_date); set('swDueDate', w.due_date);
      set('swRemark', w.remark);
      var eu = document.getElementById('swUnit'); if(eu) eu.value = w.unit || 'g';
      var ec = document.getElementById('swClass'); if(ec) ec.value = w.class_grade || '';

    }
  } else {
    title.textContent = '⚖️ เพิ่มลูกตุ้มมาตรฐาน';
  }
  modal.style.display = 'flex';
}

function closeSWModal() {
  var modal = document.getElementById('swModal');
  if (modal) modal.style.display = 'none';
  editingSWId = null;
}

function autoCalcSWDue() {
  var cal = document.getElementById('swCalDate') && document.getElementById('swCalDate').value;
  var freqEl = document.getElementById('swCalFrequency');
  var freq = freqEl ? parseInt(freqEl.value) || 2 : 2;
  if (!cal) return;
  var d = new Date(cal);
  d.setFullYear(d.getFullYear() + freq);
  var due = d.toISOString().slice(0, 10);
  var el = document.getElementById('swDueDate');
  if (el) el.value = due;
}

async function saveSW() {
  const nominal = parseFloat(document.getElementById('swNominal') && document.getElementById('swNominal').value);
  const unit = document.getElementById('swUnit') && document.getElementById('swUnit').value;
  if (!nominal || !unit) { showToast('กรุณากรอกค่าพิกัดและหน่วย', 'error'); return; }
  const get = id => { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const getF = id => { var el = document.getElementById(id); return el ? parseFloat(el.value) || null : null; };
  const payload = {
    id_code: get('swIdCode') || null,
    nominal_value: nominal, unit,
    actual_value: getF('swActual'),
    uncertainty: getF('swUncertainty'),
    class_grade: get('swClass') || null,
    serial_no: get('swSerial') || null,
    cert_no: get('swCertNo') || null,
    manufacturer: get('swManufacturer') || null,
    cal_date: get('swCalDate') || null,

    due_date: get('swDueDate') || null,
    remark: get('swRemark') || null,
    updated_at: new Date().toISOString(),
  };
  try {
    showLoading('กำลังบันทึก...');
    const isNew = !editingSWId;
    let result;
    if (editingSWId) {
      result = await sb.from('standard_weights').update(payload).eq('id', editingSWId);
    } else {
      payload.created_at = new Date().toISOString();
      result = await sb.from('standard_weights').insert(payload);
    }
    if (result.error) throw result.error;
    const label = payload.nominal_value + ' ' + payload.unit + ' Class ' + (payload.class_grade || '–') + ' (' + (payload.id_code || 'ไม่มี ID') + ')';
    const fakeInst = { id: editingSWId || 0, id_code: payload.id_code || '', instrument_name: 'Standard Weight' };
    await logAudit(isNew ? 'เพิ่ม' : 'แก้ไข', fakeInst, { 'ลูกตุ้ม': { from: isNew ? '–' : label, to: label } });
    closeSWModal();
    showToast(isNew ? 'เพิ่มลูกตุ้มแล้ว' : 'แก้ไขลูกตุ้มแล้ว', 'success');
    await loadStandardWeights();
  } catch(e) {
    showToast('บันทึกไม่ได้: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteSW(id, idCode) {
  if (!confirm('ต้องการลบลูกตุ้ม ' + (idCode || id) + ' ใช่หรือไม่?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('standard_weights').delete().eq('id', id);
    if (error) throw error;
    const fakeInst = { id, id_code: idCode, instrument_name: 'Standard Weight' };
    await logAudit('ลบ', fakeInst, { 'ลูกตุ้ม': { from: idCode || String(id), to: '(ลบแล้ว)' } });
    showToast('ลบลูกตุ้มแล้ว', 'success');
    await loadStandardWeights();
  } catch(e) {
    showToast('ลบไม่ได้: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ====================================================
// PAGE NAVIGATION
// ====================================================
