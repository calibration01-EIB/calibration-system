/* ===== 08-weights.js ===== */
// ทะเบียนตุ้มน้ำหนักมาตรฐาน — รายตุ้ม (แบบไฟล์ STD): ค่าปัจจุบัน + ครั้งก่อน → Drift/Dₛ
// + ระบบอนุมัติ (admin) ก่อนนำไปใช้ในระบบสอบเทียบ
// ====================================================
let swData = [], swFiltered = [];
let editingSWId = null;

const SW_MASS_MG = { mg: 1, g: 1000, kg: 1e6 };

async function loadStandardWeights() {
  const host = document.getElementById('swSets');
  if (host && !swData.length) host.innerHTML = '<div class="no-data" style="padding:20px">กำลังโหลด...</div>';
  try {
    const { data, error } = await sb.from('standard_weights').select('*').order('set_code').order('nominal_value');
    if (error) throw error;
    swData = data || [];
    filterSW();
  } catch (e) {
    if (host) host.innerHTML = '<div class="no-data" style="padding:20px;color:var(--red)">โหลดข้อมูลไม่ได้: ' + escapeHtmlText(e.message) + '</div>';
  }
}

function getSWStatus(dueDateStr) {
  if (!dueDateStr) return { text: '–', badge: 'background:#eee;color:#888', key: '' };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.floor((new Date(dueDateStr) - now) / 86400000);
  if (days < 0) return { text: 'หมดอายุ ' + Math.abs(days) + ' วัน', badge: 'background:#fce8e8;color:var(--red)', key: 'expired' };
  if (days <= 30) return { text: 'อีก ' + days + ' วัน', badge: 'background:#fff8e1;color:var(--amber)', key: 'warn' };
  return { text: 'อีก ' + days + ' วัน', badge: 'background:#e8f5e9;color:var(--green)', key: 'ok' };
}

function fmtDateTH(dateStr) {
  if (!dateStr) return '–';
  const p = String(dateStr).split('T')[0].split('-');
  if (p.length < 3) return dateStr;
  return p[2] + '/' + p[1] + '/' + (parseInt(p[0]) + 543);
}

// ค่าจริง = ค่าพิกัด + ค่าแก้ (correction เก็บหน่วย g → แปลงเข้าหน่วยของ nominal)
function swActual(w) {
  if (w.correction == null) return (w.actual_value != null ? Number(w.actual_value) : null);
  return Number(w.nominal_value) + Number(w.correction) * SW_MASS_MG.g / (SW_MASS_MG[w.unit] || 1);
}
// Drift = |ค่าแก้ปัจจุบัน − ครั้งก่อน| (mg) · Dₛ = max(U, drift)
function swDrift(w) {
  const U = Number(w.uncertainty) || 0;
  if (w.correction == null || w.prev_correction == null) return { has: false, drift: 0, Ds: U };
  const d = Math.abs(Number(w.correction) - Number(w.prev_correction)) * 1000;
  return { has: true, drift: d, Ds: Math.max(U, d) };
}
function swFmtG(v) {
  if (v == null || v === '') return '–';
  v = Number(v);
  const s = Math.abs(v) < 1e-4 ? (+v.toFixed(7)) : (+v.toFixed(5));
  return (v > 0 ? '+' : '') + s;
}

function filterSW() {
  const q = (document.getElementById('swSearch')?.value || '').toLowerCase().trim();
  const setF = document.getElementById('swSetFilter')?.value || '';
  const stF = document.getElementById('swStatusFilter')?.value || '';
  swFiltered = swData.filter(w => {
    const mq = !q || [w.id_code, w.serial_no, w.cert_no, w.prev_cert_no, w.nominal_value + (w.unit || '')].some(v => String(v || '').toLowerCase().includes(q));
    const ms = !setF || w.set_code === setF;
    const mt = !stF || (stF === 'approved' ? w.status === 'approved' : stF === 'draft' ? w.status !== 'approved' : getSWStatus(w.due_date).key === stF);
    return mq && ms && mt;
  });
  renderSWStats();
  renderSWFilters();
  renderSW();
}

function renderSWStats() {
  let approved = 0, draft = 0, exp = 0;
  swData.forEach(w => {
    if (w.status === 'approved') approved++; else draft++;
    if (getSWStatus(w.due_date).key === 'expired') exp++;
  });
  const s = id => document.getElementById(id);
  if (s('swTotal')) s('swTotal').textContent = swData.length;
  if (s('swOk')) s('swOk').textContent = approved;
  if (s('swWarn')) s('swWarn').textContent = draft;
  if (s('swExpired')) s('swExpired').textContent = exp;
}

function renderSWFilters() {
  const sel = document.getElementById('swSetFilter');
  if (sel) {
    const sets = [...new Set(swData.map(w => w.set_code).filter(Boolean))].sort();
    const cur = sel.value;
    sel.innerHTML = '<option value="">ทุกชุด</option>' + sets.map(s => `<option value="${escapeHtmlAttr(s)}" ${s === cur ? 'selected' : ''}>${escapeHtmlText(s)}</option>`).join('');
  }
}

function renderSW() {
  const host = document.getElementById('swSets');
  if (!host) return;
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const canApprove = currentUser && currentUser.role === 'admin';
  if (!swFiltered.length) { host.innerHTML = '<div class="no-data" style="padding:24px">ไม่พบตุ้ม — กด "เพิ่มตุ้ม" เพื่อเริ่ม</div>'; return; }
  const groups = {};
  swFiltered.forEach(w => { (groups[w.set_code || '— ไม่ระบุชุด —'] = groups[w.set_code || '— ไม่ระบุชุด —'] || []).push(w); });
  host.innerHTML = Object.keys(groups).map(set => {
    const ws = groups[set];
    const cls = ws[0].class_grade || '–', model = ws[0].model || '';
    const nDraft = ws.filter(w => w.status !== 'approved').length;
    const head = `<div class="sw-sethead">
        <span class="sw-setcode">📦 ${escapeHtmlText(set)}</span>
        <span class="sw-setmeta">Class ${escapeHtmlText(cls)}${model ? ' · ' + escapeHtmlText(model) : ''}</span>
        <span class="sw-setcnt">${ws.length} ลูก${nDraft ? ' · <b style="color:var(--amber)">รออนุมัติ ' + nDraft + '</b>' : ' · <b style="color:var(--green)">อนุมัติครบ</b>'}</span>
        ${canApprove && nDraft ? `<button class="sw-btn approve" onclick="approveSWSet('${escapeJsSingle(set)}')">✅ อนุมัติทั้งชุด</button>` : ''}
      </div>`;
    const rows = ws.map(w => {
      const dr = swDrift(w), av = swActual(w), apr = w.status === 'approved';
      const dueSt = getSWStatus(w.due_date);
      return `<tr class="${apr ? '' : 'sw-pending'}">
        <td class="sw-nom"><strong>${w.nominal_value} ${escapeHtmlText(w.unit)}</strong></td>
        <td>${escapeHtmlText(w.class_grade || '–')}</td>
        <td class="sw-idc">${escapeHtmlText(w.serial_no || '–')}</td>
        <td class="sw-idc"><strong>${escapeHtmlText(w.id_code || '–')}</strong></td>
        <td class="sw-cur">${swFmtG(w.correction)}</td>
        <td class="sw-cur"><strong>${av == null ? '–' : (+av.toFixed(7))}</strong></td>
        <td class="sw-cur sw-idc">${escapeHtmlText(w.cert_no || '–')}</td>
        <td class="sw-cur">${fmtDateTH(w.due_date)}</td>
        <td class="sw-cur">${w.uncertainty != null ? w.uncertainty : '–'}</td>
        <td class="sw-prev">${swFmtG(w.prev_correction)}</td>
        <td class="sw-prev sw-idc">${escapeHtmlText(w.prev_cert_no || '–')}</td>
        <td>${dr.has ? (+dr.drift.toFixed(4)) : '–'}</td>
        <td><strong>${(+dr.Ds.toFixed(4))}</strong> ${dr.has ? (dr.drift > Number(w.uncertainty) ? '<span class="sw-pill d">Drift</span>' : '<span class="sw-pill u">≤U</span>') : '<span class="sw-pill n">ใบเดียว</span>'}</td>
        <td>${apr
            ? `<span class="sw-pill ap" title="${escapeHtmlAttr((w.approved_by || '') + ' ' + (w.approved_at ? w.approved_at.split('T')[0] : ''))}">✅ อนุมัติ</span>${canApprove ? ` <a class="sw-link" onclick="unapproveSW(${w.id})">ยกเลิก</a>` : ''}`
            : `<span class="sw-pill wait">🟡 รออนุมัติ</span>${canApprove ? ` <button class="sw-btn approve sm" onclick="approveSW(${w.id})">อนุมัติ</button>` : ''}`}</td>
        <td class="sw-act" style="white-space:nowrap">${canEdit ? `<i class="sw-i" title="แก้ไข" onclick="openSWModal(${w.id})">✏️</i><i class="sw-i" title="ลบ" onclick="deleteSW(${w.id},'${escapeJsSingle(w.id_code || '')}')">🗑️</i>` : ''}</td>
      </tr>`;
    }).join('');
    return `<div class="sw-card">${head}
      <div class="sw-tw"><table class="sw-tbl">
        <thead class="sw-grp"><tr>
          <th colspan="4" class="sw-blank"></th>
          <th colspan="5" class="sw-h-cur">◀ ค่าปัจจุบัน (ใบล่าสุด)</th>
          <th colspan="2" class="sw-h-prev">ค่าครั้งก่อน</th>
          <th colspan="2" class="sw-h-drift">Drift / Dₛ</th>
          <th colspan="2" class="sw-blank"></th>
        </tr></thead>
        <thead class="sw-cols"><tr>
          <th style="text-align:left">ค่าพิกัด</th><th>Class</th><th>S/N</th><th>ID.No.</th>
          <th class="sw-cur">ค่าแก้ (g)</th><th class="sw-cur">ค่าจริง (g)</th><th class="sw-cur">Cert.No</th><th class="sw-cur">Due</th><th class="sw-cur">U (mg)</th>
          <th class="sw-prev">ค่าแก้ (g)</th><th class="sw-prev">Cert.No</th>
          <th>Drift (mg)</th><th>Dₛ (mg)</th><th>อนุมัติ</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div>`;
  }).join('');
}

// ===== Modal เพิ่ม/แก้ไข =====
function openSWModal(id) {
  editingSWId = id || null;
  const w = id ? swData.find(x => x.id === id) : null;
  const modal = document.getElementById('swModal');
  if (!modal) return;
  const t = document.getElementById('swModalTitle');
  if (t) t.textContent = w ? '✏️ แก้ไขตุ้ม — ' + (w.nominal_value + ' ' + w.unit) + ' (' + (w.id_code || '') + ')' : '⚖️ เพิ่มตุ้มมาตรฐาน';
  const set = (fid, v) => { const el = document.getElementById(fid); if (el) el.value = (v == null ? '' : v); };
  set('swNominal', w?.nominal_value); set('swUnit', w?.unit || 'g'); set('swClass', w?.class_grade || 'E2');
  set('swSetCode', w?.set_code); set('swIdCode', w?.id_code); set('swSerial', w?.serial_no);
  set('swModel', w?.model); set('swRemark', w?.note);
  set('swCorrection', w?.correction); set('swUncertainty', w?.uncertainty); set('swCertNo', w?.cert_no);
  set('swCalDate', w?.cal_date ? String(w.cal_date).split('T')[0] : ''); set('swDueDate', w?.due_date ? String(w.due_date).split('T')[0] : '');
  set('swPrevCorr', w?.prev_correction); set('swPrevCert', w?.prev_cert_no);
  const note = document.getElementById('swEditNote');
  if (note) note.style.display = (w && w.status === 'approved') ? 'block' : 'none';
  modal.style.display = 'flex';
}
function closeSWModal() { const m = document.getElementById('swModal'); if (m) m.style.display = 'none'; editingSWId = null; }

function autoCalcSWDue() {
  const cal = document.getElementById('swCalDate')?.value;
  const freq = parseInt(document.getElementById('swCalFrequency')?.value) || 2;
  if (!cal) return;
  const d = new Date(cal); d.setFullYear(d.getFullYear() + freq);
  const el = document.getElementById('swDueDate'); if (el) el.value = d.toISOString().slice(0, 10);
}

async function saveSW() {
  const nominal = parseFloat(document.getElementById('swNominal')?.value);
  const unit = document.getElementById('swUnit')?.value;
  if (!nominal || !unit) { showToast('กรุณากรอกค่าพิกัดและหน่วย', 'error'); return; }
  const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const getF = id => { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return Number.isFinite(v) ? v : null; };
  const correction = getF('swCorrection');
  const actual = correction == null ? null : nominal + correction * SW_MASS_MG.g / (SW_MASS_MG[unit] || 1);
  const payload = {
    nominal_value: nominal, unit, class_grade: get('swClass') || null,
    set_code: get('swSetCode') || null, id_code: get('swIdCode') || null, serial_no: get('swSerial') || null,
    model: get('swModel') || null, note: get('swRemark') || null,
    correction, actual_value: actual, uncertainty: getF('swUncertainty'),
    cert_no: get('swCertNo') || null, cal_date: get('swCalDate') || null, due_date: get('swDueDate') || null,
    prev_correction: getF('swPrevCorr'), prev_cert_no: get('swPrevCert') || null,
    status: 'draft', approved_by: null, approved_at: null,   // แก้ไข/เพิ่ม → ต้องอนุมัติใหม่
    updated_at: new Date().toISOString(),
  };
  try {
    showLoading('กำลังบันทึก...');
    const isNew = !editingSWId;
    const result = editingSWId
      ? await sb.from('standard_weights').update(payload).eq('id', editingSWId)
      : await sb.from('standard_weights').insert({ ...payload, created_at: new Date().toISOString() });
    if (result.error) throw result.error;
    await logAudit(isNew ? 'เพิ่ม' : 'แก้ไข', { id: editingSWId || 0, id_code: payload.id_code || '', instrument_name: 'Standard Weight' },
      { 'ตุ้ม': { from: isNew ? '–' : (payload.id_code || ''), to: payload.nominal_value + ' ' + payload.unit + ' (รออนุมัติ)' } });
    closeSWModal();
    showToast(isNew ? 'เพิ่มตุ้มแล้ว (รออนุมัติ)' : 'แก้ไขแล้ว — ต้องอนุมัติใหม่', 'success');
    await loadStandardWeights();
  } catch (e) { showToast('บันทึกไม่ได้: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ===== อนุมัติ (admin) =====
async function approveSW(id) {
  if (!(currentUser && currentUser.role === 'admin')) { showToast('เฉพาะ admin เท่านั้นที่อนุมัติได้', 'error'); return; }
  const w = swData.find(x => x.id === id); if (!w) return;
  try {
    showLoading('กำลังอนุมัติ...');
    const { error } = await sb.from('standard_weights').update({ status: 'approved', approved_by: currentUser.name || currentUser.username || 'admin', approved_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await logAudit('อนุมัติ', { id, id_code: w.id_code || '', instrument_name: 'Standard Weight' }, { 'สถานะ': { from: 'รออนุมัติ', to: 'อนุมัติแล้ว' } });
    showToast('อนุมัติแล้ว: ' + (w.id_code || (w.nominal_value + w.unit)), 'success');
    await loadStandardWeights();
  } catch (e) { showToast('อนุมัติไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}
async function approveSWSet(setCode) {
  if (!(currentUser && currentUser.role === 'admin')) { showToast('เฉพาะ admin เท่านั้นที่อนุมัติได้', 'error'); return; }
  const ids = swData.filter(w => (w.set_code || '— ไม่ระบุชุด —') === setCode && w.status !== 'approved').map(w => w.id);
  if (!ids.length) return;
  if (!confirm('อนุมัติตุ้มทั้งชุด ' + setCode + ' (' + ids.length + ' ลูก) ?')) return;
  try {
    showLoading('กำลังอนุมัติ...');
    const { error } = await sb.from('standard_weights').update({ status: 'approved', approved_by: currentUser.name || currentUser.username || 'admin', approved_at: new Date().toISOString() }).in('id', ids);
    if (error) throw error;
    await logAudit('อนุมัติ', { id: 0, id_code: setCode, instrument_name: 'Standard Weight Set' }, { 'อนุมัติทั้งชุด': { from: '–', to: ids.length + ' ลูก' } });
    showToast('อนุมัติทั้งชุดแล้ว (' + ids.length + ' ลูก)', 'success');
    await loadStandardWeights();
  } catch (e) { showToast('อนุมัติไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}
async function unapproveSW(id) {
  if (!(currentUser && currentUser.role === 'admin')) return;
  if (!confirm('ยกเลิกการอนุมัติตุ้มนี้? (จะใช้สอบเทียบไม่ได้จนกว่าจะอนุมัติใหม่)')) return;
  try {
    showLoading('...');
    const { error } = await sb.from('standard_weights').update({ status: 'draft', approved_by: null, approved_at: null }).eq('id', id);
    if (error) throw error;
    showToast('ยกเลิกการอนุมัติแล้ว', 'success');
    await loadStandardWeights();
  } catch (e) { showToast('ทำไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function deleteSW(id, idCode) {
  if (!confirm('ลบตุ้ม ' + (idCode || id) + ' ?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('standard_weights').delete().eq('id', id);
    if (error) throw error;
    await logAudit('ลบ', { id, id_code: idCode, instrument_name: 'Standard Weight' }, { 'ตุ้ม': { from: idCode || String(id), to: '(ลบแล้ว)' } });
    showToast('ลบตุ้มแล้ว', 'success');
    await loadStandardWeights();
  } catch (e) { showToast('ลบไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}
