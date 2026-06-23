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
// แปลงเลขเป็นสตริงเต็ม (กัน toFixed→Number กลายเป็น 3e-7) แล้วตัดศูนย์ท้าย
function swTrim(v, dp) {
  if (v == null || v === '' || !Number.isFinite(Number(v))) return '–';
  let s = Number(v).toFixed(dp);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
function swFmtG(v) {
  if (v == null || v === '') return '–';
  v = Number(v);
  if (!Number.isFinite(v)) return '–';
  const s = swTrim(v, Math.abs(v) < 1e-4 ? 7 : 5);
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
    // เรียงตามมวลจริง (เอาหน่วยมาคูณ): mg < g < kg → 1mg,2mg,…,1g,2g,…,1kg
    ws.sort((a, b) => (Number(a.nominal_value) * (SW_MASS_MG[a.unit] || 1)) - (Number(b.nominal_value) * (SW_MASS_MG[b.unit] || 1)));
    const cls = ws[0].class_grade || '–', model = ws[0].model || '';
    const sn = ws[0].serial_no || '', certNo = ws[0].cert_no || '', due = ws[0].due_date || '';
    const nDraft = ws.filter(w => w.status !== 'approved').length;
    const head = `<div class="sw-sethead">
        <span class="sw-setcode">📜 ${escapeHtmlText(set)}</span>
        <span class="sw-setmeta">Class ${escapeHtmlText(cls)}${model ? ' · ' + escapeHtmlText(model) : ''}${sn ? ' · S/N ' + escapeHtmlText(sn) : ''}</span>
        ${certNo ? `<span class="sw-setmeta">Cert <b>${escapeHtmlText(certNo)}</b></span>` : ''}
        ${due ? `<span class="sw-setmeta">ครบ ${fmtDateTH(due)}</span>` : ''}
        <span class="sw-setcnt">${ws.length} ลูก${nDraft ? ' · <b style="color:var(--amber)">รออนุมัติ ' + nDraft + '</b>' : ' · <b style="color:var(--green)">อนุมัติครบ</b>'}</span>
        ${canApprove && nDraft ? `<button class="sw-btn approve" onclick="approveSWSet('${escapeJsSingle(set)}')">✅ อนุมัติทั้งชุด</button>` : ''}
        ${canEdit ? `<button class="sw-btn sm" style="background:#e8f5f3;color:#0b5e6d" onclick="openSWSetModal('${escapeJsSingle(set)}')">✏️ แก้ไขชุด</button>` : ''}
        ${canEdit ? `<button class="sw-btn sm" style="background:#fbe9e7;color:#c0392b" onclick="deleteSWSet('${escapeJsSingle(set)}')">🗑️</button>` : ''}
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
        <td class="sw-cur"><strong>${av == null ? '–' : swTrim(av, 7)}</strong></td>
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
        <td class="sw-act" style="white-space:nowrap">${canEdit ? `<i class="sw-i" title="ลบลูกนี้" onclick="deleteSW(${w.id},'${escapeJsSingle(w.id_code || '')}')">🗑️</i>` : ''}</td>
      </tr>`;
    }).join('');
    return `<div class="sw-card">${head}
      <div class="sw-tw"><table class="sw-tbl">
        <thead class="sw-grp"><tr>
          <th class="sw-blank"></th><th class="sw-blank"></th><th class="sw-blank"></th><th class="sw-blank"></th>
          <th colspan="5" class="sw-h-cur">◀ ค่าปัจจุบัน (ใบล่าสุด)</th>
          <th colspan="2" class="sw-h-prev">ค่าครั้งก่อน</th>
          <th colspan="2" class="sw-h-drift">Drift / Dₛ</th>
          <th class="sw-blank"></th><th class="sw-blank"></th>
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

// ===== Modal เพิ่ม/แก้ไข — แบบชุด (1 ใบ Cert = 1 ชุด) =====
let swSetEditing = null;   // set_code ที่กำลังแก้ (null = ชุดใหม่)
let swSetOrigIds = [];     // id ตุ้มเดิมในชุด (ไว้ตรวจว่าถูกลบแถวไหน)

function openSWSetModal(setCode) {
  swSetEditing = setCode || null;
  const ws = setCode ? swData.filter(w => (w.set_code || '— ไม่ระบุชุด —') === setCode)
                         .sort((a, b) => (a.nominal_value * (SW_MASS_MG[a.unit] || 1)) - (b.nominal_value * (SW_MASS_MG[b.unit] || 1)))
                     : [];
  swSetOrigIds = ws.map(w => w.id);
  const h = ws[0] || {};
  const set = (fid, v) => { const el = document.getElementById(fid); if (el) el.value = (v == null ? '' : v); };
  set('swSetCode', h.set_code === '— ไม่ระบุชุด —' ? '' : h.set_code);
  set('swClass', h.class_grade || 'E2'); set('swModel', h.model); set('swSerial', h.serial_no);
  set('swCertNo', h.cert_no); set('swPrevCert', h.prev_cert_no);
  set('swCalDate', h.cal_date ? String(h.cal_date).split('T')[0] : '');
  set('swDueDate', h.due_date ? String(h.due_date).split('T')[0] : '');
  const body = document.getElementById('swRows'); if (body) body.innerHTML = '';
  if (ws.length) ws.forEach(addSWRow); else addSWRow();
  const t = document.getElementById('swModalTitle');
  if (t) t.textContent = setCode ? ('✏️ แก้ไขชุด — ' + setCode) : '⚖️ เพิ่มใบ Cert / ชุดตุ้มมาตรฐาน';
  const note = document.getElementById('swEditNote');
  if (note) note.style.display = ws.some(w => w.status === 'approved') ? 'block' : 'none';
  const modal = document.getElementById('swModal'); if (modal) modal.style.display = 'flex';
}
function closeSWModal() { const m = document.getElementById('swModal'); if (m) m.style.display = 'none'; swSetEditing = null; swSetOrigIds = []; }

function addSWRow(w) {
  w = (w && w.id != null) ? w : {};
  const body = document.getElementById('swRows'); if (!body) return;
  const tr = document.createElement('tr');
  tr.dataset.id = w.id != null ? w.id : '';
  const u = w.unit || 'g';
  tr.innerHTML =
    `<td><input class="swrin l sw-r-nom" type="number" step="any" value="${w.nominal_value != null ? w.nominal_value : ''}" placeholder="1"></td>` +
    `<td><select class="swrin sw-r-unit">${['mg', 'g', 'kg'].map(x => `<option ${x === u ? 'selected' : ''}>${x}</option>`).join('')}</select></td>` +
    `<td><input class="swrin l sw-r-idc" type="text" value="${escapeHtmlAttr(w.id_code || '')}" placeholder="CLCLCS01-WI07"></td>` +
    `<td><input class="swrin sw-r-corr" type="number" step="any" value="${w.correction != null ? w.correction : ''}" placeholder="0.000006"></td>` +
    `<td><input class="swrin sw-r-unc" type="number" step="any" value="${w.uncertainty != null ? w.uncertainty : ''}" placeholder="0.010"></td>` +
    `<td><input class="swrin sw-r-prev" type="number" step="any" value="${w.prev_correction != null ? w.prev_correction : ''}" placeholder="0.000021" style="background:#f8f5fd"></td>` +
    `<td style="text-align:center"><button type="button" class="sw-rowdel" onclick="this.closest('tr').remove()" title="ลบแถว">✕</button></td>`;
  body.appendChild(tr);
}

function autoCalcSWDue() {
  const cal = document.getElementById('swCalDate')?.value;
  const freq = parseInt(document.getElementById('swCalFrequency')?.value) || 2;
  if (!cal) return;
  const d = new Date(cal); d.setFullYear(d.getFullYear() + freq);
  const el = document.getElementById('swDueDate'); if (el) el.value = d.toISOString().slice(0, 10);
}

async function saveSWSet() {
  const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const setCode = get('swSetCode');
  if (!setCode) { showToast('กรุณากรอกชื่อชุด (Set code)', 'error'); return; }
  const header = {
    set_code: setCode, class_grade: get('swClass') || null,
    model: get('swModel') || null, serial_no: get('swSerial') || null,
    cert_no: get('swCertNo') || null, prev_cert_no: get('swPrevCert') || null,
    cal_date: get('swCalDate') || null, due_date: get('swDueDate') || null,
  };
  const rows = [...document.querySelectorAll('#swRows tr')].map(tr => {
    const q = sel => tr.querySelector(sel);
    const f = sel => { const v = parseFloat(q(sel)?.value); return Number.isFinite(v) ? v : null; };
    return {
      _id: tr.dataset.id ? Number(tr.dataset.id) : null,
      nominal_value: f('.sw-r-nom'), unit: q('.sw-r-unit')?.value || 'g',
      id_code: (q('.sw-r-idc')?.value || '').trim() || null,
      correction: f('.sw-r-corr'), uncertainty: f('.sw-r-unc'), prev_correction: f('.sw-r-prev'),
    };
  }).filter(r => r.nominal_value != null);
  if (!rows.length) { showToast('กรุณาเพิ่มอย่างน้อย 1 ลูก (ใส่ค่าพิกัด)', 'error'); return; }
  const now = new Date().toISOString();
  const mk = r => {
    const actual = r.correction == null ? null : r.nominal_value + r.correction * SW_MASS_MG.g / (SW_MASS_MG[r.unit] || 1);
    return {
      ...header, nominal_value: r.nominal_value, unit: r.unit, id_code: r.id_code,
      correction: r.correction, actual_value: actual, uncertainty: r.uncertainty, prev_correction: r.prev_correction,
      status: 'draft', approved_by: null, approved_at: null, updated_at: now,   // แก้ไข/เพิ่ม → อนุมัติใหม่ทั้งชุด
    };
  };
  try {
    showLoading('กำลังบันทึก...');
    const keepIds = rows.filter(r => r._id).map(r => r._id);
    const toDelete = swSetOrigIds.filter(id => !keepIds.includes(id));
    if (toDelete.length) { const { error } = await sb.from('standard_weights').delete().in('id', toDelete); if (error) throw error; }
    const inserts = [];
    for (const r of rows) {
      if (r._id) { const { error } = await sb.from('standard_weights').update(mk(r)).eq('id', r._id); if (error) throw error; }
      else inserts.push({ ...mk(r), created_at: now });
    }
    if (inserts.length) { const { error } = await sb.from('standard_weights').insert(inserts); if (error) throw error; }
    await logAudit(swSetEditing ? 'แก้ไข' : 'เพิ่ม', { id: 0, id_code: setCode, instrument_name: 'Standard Weight Set' },
      { 'ชุด': { from: swSetEditing || '–', to: rows.length + ' ลูก (รออนุมัติ)' } });
    closeSWModal();
    showToast('บันทึกชุด ' + setCode + ' แล้ว (' + rows.length + ' ลูก) — รออนุมัติ', 'success');
    await loadStandardWeights();
  } catch (e) { showToast('บันทึกไม่ได้: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

async function deleteSWSet(setCode) {
  const ids = swData.filter(w => (w.set_code || '— ไม่ระบุชุด —') === setCode).map(w => w.id);
  if (!ids.length) return;
  if (!confirm('ลบทั้งชุด ' + setCode + ' (' + ids.length + ' ลูก) ?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('standard_weights').delete().in('id', ids);
    if (error) throw error;
    await logAudit('ลบ', { id: 0, id_code: setCode, instrument_name: 'Standard Weight Set' }, { 'ชุด': { from: setCode, to: '(ลบแล้ว)' } });
    showToast('ลบทั้งชุดแล้ว (' + ids.length + ' ลูก)', 'success');
    await loadStandardWeights();
  } catch (e) { showToast('ลบไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
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
