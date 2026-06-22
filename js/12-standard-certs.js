/* ===== 12-standard-certs.js ===== */
// ใบ Cert Reference — เก็บใบ cert ของเครื่องมือมาตรฐานพร้อมตารางผลวัดรายจุด
// ค่าจากหน้านี้ (ค่าจริง + U) ใช้เป็นต้นทางการคำนวณตอนออกใบ cert สอบเทียบภายใน
// ====================================================
let scData = [];
let scEditingId = null;
let scDetailId = null;

const SC_CATEGORIES = {
  'ตุ้มน้ำหนักมาตรฐาน': ['⚖️', '#639922'],
  'เครื่องชั่ง':         ['⚖️', '#00897b'],
  'มวล/น้ำหนัก':         ['⚖️', '#00897b'],
  'อุณหภูมิ':     ['🌡️', '#d85a30'],
  'ความดัน':      ['🎛️', '#534ab7'],
  'ความยาว/มิติ': ['📏', '#185fa5'],
  'ไฟฟ้า':        ['⚡', '#ba7517'],
};
function scCatMeta(cat) { return SC_CATEGORIES[cat] || ['🧰', '#52667d']; }

function switchSWTab(tab) {
  // "certs" = ใบ Cert Reference (set-view ของ standard_weights) · "cmc" = ขอบข่าย CMC
  const sections = { certs: 'swSection', cmc: 'cmcSection' };
  const buttons = { certs: 'swTabCerts', cmc: 'swTabCmc' };
  const scSec = document.getElementById('scSection'); if (scSec) scSec.style.display = 'none';
  Object.entries(sections).forEach(([t, sec]) => { const el = document.getElementById(sec); if (el) el.style.display = (t === tab) ? '' : 'none'; });
  Object.entries(buttons).forEach(([t, id]) => { const b = document.getElementById(id); if (b) b.classList.toggle('active', t === tab); });
  if (tab === 'certs' && typeof loadStandardWeights === 'function') loadStandardWeights();
  if (tab === 'cmc' && typeof loadCmcScope === 'function') loadCmcScope();
}

async function loadStandardCerts() {
  const addBtn = document.getElementById('scAddBtn');
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  if (addBtn) addBtn.style.display = canEdit ? '' : 'none';
  const tbody = document.getElementById('scTableBody');
  if (tbody && !scData.length) tbody.innerHTML = '<tr><td colspan="9" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const [cRes, vRes] = await Promise.all([
      sb.from('standard_certs').select('*').order('measurement_date', { ascending: false }),
      sb.from('standard_cert_values').select('*').order('sort_order'),
    ]);
    if (cRes.error) throw cRes.error;
    if (vRes.error) throw vRes.error;
    const byCert = {};
    (vRes.data || []).forEach(v => { (byCert[v.cert_id] = byCert[v.cert_id] || []).push(v); });
    scData = (cRes.data || []).map(c => ({ ...c, values: byCert[c.id] || [] }));
    renderSC();
  } catch (e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="no-data" style="color:var(--red)">โหลดข้อมูลไม่ได้: ' + escapeHtmlText(e.message) + '</td></tr>';
  }
}

// สถานะ: มีใบใหม่กว่าของชุด+S/N เดียวกัน > หมดอายุ > ใกล้หมด (60 วัน) > ใช้งาน
function scStatus(c) {
  const newer = scData.some(o => o.id !== c.id && o.set_code === c.set_code && o.serial_no === c.serial_no
    && o.measurement_date && c.measurement_date && new Date(o.measurement_date) > new Date(c.measurement_date));
  if (newer) return { key: 'superseded', label: '🔄 มีใบใหม่แทน', cls: 'badge-gray' };
  if (!c.due_date) return { key: 'ok', label: 'ใช้งานอยู่', cls: 'badge-green' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(c.due_date + 'T00:00:00') - today) / 86400000);
  if (days < 0) return { key: 'expired', label: '❌ หมดอายุ ' + Math.abs(days) + ' วัน', cls: 'badge-red' };
  if (days <= 60) return { key: 'warn', label: '⚠️ อีก ' + days + ' วัน', cls: 'badge-amber' };
  return { key: 'ok', label: '✅ อีก ' + days + ' วัน', cls: 'badge-green' };
}

// ค่าจริงของจุดวัด = ค่าพิกัด + ค่าแก้ (แปลงหน่วยเมื่อเป็นหน่วยมวล)
const SC_MASS_MG = { mg: 1, g: 1000, kg: 1000000 };
function scConvert(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (SC_MASS_MG[fromUnit] && SC_MASS_MG[toUnit]) return value * SC_MASS_MG[fromUnit] / SC_MASS_MG[toUnit];
  return null;
}
function scTrueValue(r) {
  const corr = scConvert(Number(r.correction), r.corr_unit, r.unit);
  return corr === null ? null : Number(r.nominal_value) + corr;
}
function scFmtTrue(r) {
  const v = scTrueValue(r);
  if (v !== null) return parseFloat(v.toFixed(8)).toString() + ' ' + r.unit;
  return `${r.nominal_value} ${r.unit} ${Number(r.correction) >= 0 ? '+' : '−'} ${Math.abs(r.correction)} ${r.corr_unit}`;
}
function scSigned(v) { return (Number(v) > 0 ? '+' : '') + Number(v); }
function scPass(r) { return Math.abs(Number(r.correction)) + Number(r.uncertainty) <= Number(r.mpe); }

// ===== Drift เทียบใบครั้งก่อน (FRM-CAL92 5.1.2) — Dₛ = max(U, |Δค่าแก้|) =====
// ใบก่อนหน้า = ชุด+ซีเรียลเดียวกัน วันที่สอบเทียบเก่ากว่า เลือกใบที่ใหม่ที่สุดในกลุ่มนั้น
function scPreviousCert(c) {
  const prior = scData.filter(o => o.id !== c.id && o.set_code === c.set_code && o.serial_no === c.serial_no
    && o.measurement_date && c.measurement_date && new Date(o.measurement_date) < new Date(c.measurement_date));
  if (!prior.length) return null;
  return prior.reduce((a, b) => new Date(b.measurement_date) > new Date(a.measurement_date) ? b : a);
}
// จับคู่จุดวัดด้วย ค่าพิกัด + หน่วย + marking
function scMatchRow(cert, row) {
  if (!cert) return null;
  return (cert.values || []).find(r => Number(r.nominal_value) === Number(row.nominal_value)
    && r.unit === row.unit && (r.marking || '') === (row.marking || ''));
}
function scRowDrift(c, row, prev) {
  prev = prev !== undefined ? prev : scPreviousCert(c);
  const prevRow = scMatchRow(prev, row);
  if (!prev || !prevRow) return { hasPrev: false, prev, prevRow: null, drift: 0, Ds: Number(row.uncertainty) };
  const drift = Math.abs(Number(row.correction) - Number(prevRow.correction));
  return { hasPrev: true, prev, prevRow, drift, Ds: Math.max(Number(row.uncertainty), drift) };
}
// ใบมวลล่าสุดของชุด/ซีเรียล + ดึงค่า correction/U/Dₛ ให้ตุ้มรายลูก (ใช้โดยแท็บลูกตุ้ม — เตรียมไว้)
function scLatestMassCert(serial, setCode) {
  const m = scData.filter(c => ['ตุ้มน้ำหนักมาตรฐาน', 'มวล/น้ำหนัก'].includes(c.category)
    && c.serial_no === serial && (!setCode || c.set_code === setCode));
  if (!m.length) return null;
  return m.reduce((a, b) => new Date(b.measurement_date || 0) > new Date(a.measurement_date || 0) ? b : a);
}
function stdValueFor(w) {
  const cert = scLatestMassCert(w.serial_no, w.set_code);
  if (!cert) return { hasCert: false };
  const cand = (cert.values || []).filter(r => Number(r.nominal_value) === Number(w.nominal_value) && r.unit === w.unit);
  if (!cand.length) return { hasCert: true, hasRow: false, cert };
  const row = (w.marking ? cand.find(r => (r.marking || '') === (w.marking || '')) : null) || cand[0];
  const dr = scRowDrift(cert, row);
  return { hasCert: true, hasRow: true, cert, prev: dr.prev,
    correction: Number(row.correction), U: Number(row.uncertainty), corr_unit: row.corr_unit,
    actual: scTrueValue(row), Ds: dr.Ds, drift: dr.drift, hasPrev: dr.hasPrev };
}

function scFiltered() {
  const q = (document.getElementById('scSearch')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('scCatFilter')?.value || '';
  const st = document.getElementById('scStatusFilter')?.value || '';
  return scData.filter(c => {
    if (cat && c.category !== cat) return false;
    if (st && scStatus(c).key !== st) return false;
    if (!q) return true;
    return [c.cert_no, c.set_code, c.item, c.serial_no, c.lab, c.manufacturer, c.category]
      .some(v => String(v || '').toLowerCase().includes(q));
  });
}

function renderSC() {
  // stats
  let ok = 0, warn = 0, bad = 0;
  scData.forEach(c => {
    const k = scStatus(c).key;
    if (k === 'ok') ok++; else if (k === 'warn') warn++; else bad++;
  });
  const s = id => document.getElementById(id);
  if (s('scTotal')) s('scTotal').textContent = scData.length;
  if (s('scOk')) s('scOk').textContent = ok;
  if (s('scWarn')) s('scWarn').textContent = warn;
  if (s('scExpired')) s('scExpired').textContent = bad;

  // category filter options
  const catSel = s('scCatFilter');
  if (catSel) {
    const cats = [...new Set(scData.map(c => c.category).filter(Boolean))].sort();
    const cur = catSel.value;
    catSel.innerHTML = '<option value="">ทุกประเภท</option>' +
      cats.map(c => `<option value="${escapeHtmlAttr(c)}" ${c === cur ? 'selected' : ''}>${escapeHtmlText(c)}</option>`).join('');
  }

  const tbody = s('scTableBody');
  if (!tbody) return;
  const rows = scFiltered();
  tbody.innerHTML = rows.length ? rows.map(c => {
    const st = scStatus(c);
    const [icon, color] = scCatMeta(c.category);
    return `<tr onclick="openSCDetail(${c.id})" style="cursor:pointer">
      <td><div style="display:flex;align-items:center;gap:9px">
        <span style="width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:8px;background:${color}14;border:1px solid ${color}40;font-size:16px">${icon}</span>
        <div><div style="font-weight:700">${escapeHtmlText(c.cert_no)}</div><div style="font-size:11px;color:var(--text3)">${escapeHtmlText(c.item || '–')}</div></div>
      </div></td>
      <td><span class="badge" style="background:${color}14;color:${color}">${escapeHtmlText(c.category || '–')}</span></td>
      <td><strong>${escapeHtmlText(c.set_code)}</strong></td>
      <td>${escapeHtmlText(c.class_grade || '–')}</td>
      <td>${escapeHtmlText(c.serial_no || '–')}</td>
      <td><strong>${c.values.length}</strong> <span style="font-size:11px;color:var(--text3)">จุด</span></td>
      <td>${fmtDateTH(c.measurement_date)}</td>
      <td><strong>${fmtDateTH(c.due_date)}</strong></td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="9" class="no-data">ไม่พบข้อมูล</td></tr>';
}

// ===== DETAIL =====
function openSCDetail(id) {
  const c = scData.find(x => x.id === id);
  if (!c) return;
  scDetailId = id;
  const st = scStatus(c);
  const [icon, color] = scCatMeta(c.category);
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const isMass = ['ตุ้มน้ำหนักมาตรฐาน', 'มวล/น้ำหนัก'].includes(c.category);
  const scPrev = scPreviousCert(c);
  const showDrift = !!scPrev;
  document.getElementById('scDetailBody').innerHTML = `
    <div class="reg-detail-head">
      <div class="reg-detail-title">
        <span style="width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:8px;background:${color}14;border:1px solid ${color}40;font-size:17px">${icon}</span>
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="reg-name" style="font-size:15px">${escapeHtmlText(c.cert_no)}</span>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          <div class="reg-sub" style="margin-top:2px"><strong>${escapeHtmlText(c.set_code)}</strong> · ${escapeHtmlText(c.category || '')} · ${escapeHtmlText(c.item || '')}</div>
        </div>
      </div>
      <div class="reg-detail-actions">
        ${canEdit ? `<button class="btn-view" onclick="closeSCDetail();openSCEdit(${c.id})">✏️ แก้ไข</button>` : ''}
        ${canEdit ? `<button class="btn-del" onclick="deleteSC(${c.id})">🗑️ ลบ</button>` : ''}
      </div>
    </div>

    <div class="reg-metric-grid">
      <div class="reg-metric"><span>Class / Grade</span><strong>${escapeHtmlText(c.class_grade || '–')}</strong></div>
      <div class="reg-metric"><span>Serial No.</span><strong>${escapeHtmlText(c.serial_no || '–')}</strong></div>
      <div class="reg-metric"><span>วันที่สอบเทียบ</span><strong>${fmtDateTH(c.measurement_date)}</strong></div>
      <div class="reg-metric"><span>ครบกำหนด</span><strong>${fmtDateTH(c.due_date)}</strong></div>
    </div>
    <div class="reg-info-grid">
      <div class="reg-info-item"><span>ห้องปฏิบัติการ</span><strong>${escapeHtmlText(c.lab || '–')}</strong></div>
      <div class="reg-info-item"><span>ผู้ผลิต</span><strong>${escapeHtmlText(c.manufacturer || '–')}</strong></div>
      <div class="reg-info-item full"><span>สภาวะแวดล้อม / หมายเหตุ</span><strong>${escapeHtmlText(c.remark || '–')}</strong></div>
    </div>

    <div class="reg-section"><span>ผลวัด — ค่าแก้ &amp; เกณฑ์ยอมรับ${isMass ? ' (Conventional mass · OIML R 111-1)' : ''}</span><span class="reg-sub">${c.values.length} จุด</span></div>
    ${showDrift ? `<div class="reg-sub" style="margin:-2px 0 6px;color:#534ab7">↺ Drift เทียบใบครั้งก่อน <strong>${escapeHtmlText(scPrev.cert_no)}</strong> (${fmtDateTH(scPrev.measurement_date)}) · Dₛ = max(U, |Δค่าแก้|) ตาม FRM-CAL92 5.1.2</div>` : ''}
    <div style="overflow-x:auto">
      <table class="sc-vals">
        <thead><tr><th>#</th><th>จุดวัด</th><th>รายละเอียด</th><th class="num">Correction</th><th class="num">ค่าจริง</th><th class="num">U, k=2</th>${showDrift ? '<th class="num">Drift</th><th class="num">Dₛ</th>' : ''}<th class="num">เกณฑ์ ±</th><th>ผล</th></tr></thead>
        <tbody>
          ${c.values.map((r, i) => {
            const dr = showDrift ? scRowDrift(c, r, scPrev) : null;
            return `<tr>
            <td style="color:var(--text3)">${i + 1}</td>
            <td><strong>${r.nominal_value} ${escapeHtmlText(r.unit)}</strong></td>
            <td style="color:var(--text3)">${escapeHtmlText(r.marking || '–')}</td>
            <td class="num">${scSigned(r.correction)} ${escapeHtmlText(r.corr_unit)}</td>
            <td class="num"><strong>${scFmtTrue(r)}</strong></td>
            <td class="num">${r.uncertainty} ${escapeHtmlText(r.corr_unit)}</td>
            ${showDrift ? `<td class="num ${dr.hasPrev && dr.drift > Number(r.uncertainty) ? 'sc-fail' : ''}">${dr.hasPrev ? parseFloat(dr.drift.toFixed(6)) : '–'}</td><td class="num"><strong>${parseFloat(dr.Ds.toFixed(6))} ${escapeHtmlText(r.corr_unit)}</strong></td>` : ''}
            <td class="num">${r.mpe} ${escapeHtmlText(r.corr_unit)}</td>
            <td class="${scPass(r) ? 'sc-pass' : 'sc-fail'}">${scPass(r) ? '✓ ผ่าน' : '✗ เกิน'}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    ${c.values.length ? `<div class="sc-calc">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <strong>🧮 ค่าสำหรับนำไปคำนวณ:</strong>
        <select id="scCalcPick" onchange="renderSCCalc()" style="min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px">
          ${c.values.map((r, i) => `<option value="${i}">${r.nominal_value} ${escapeHtmlText(r.unit)}${r.marking && r.marking !== 'none' ? ' (' + escapeHtmlText(r.marking) + ')' : ''}</option>`).join('')}
        </select>
      </div>
      <div class="sc-calc-out" id="scCalcOut"></div>
      <div class="reg-sub" style="margin-top:8px">โมดูลสอบเทียบใช้ <strong>ค่าจริง${isMass ? ' (Conventional mass)' : ''}</strong> เป็นค่าอ้างอิง และใช้ u = U/2 ในงบประมาณความไม่แน่นอน</div>
    </div>` : ''}

    <div class="reg-section">ไฟล์ใบรับรอง ${canEdit ? `<button class="btn-view" style="margin-left:auto" onclick="document.getElementById('scDetailFileInput').click()">📎 เพิ่มไฟล์</button>` : ''}</div>
    <div id="scDetailFiles"><div class="reg-empty">กำลังโหลดไฟล์...</div></div>
    <input type="file" id="scDetailFileInput" multiple accept=".pdf,image/*" style="display:none" onchange="uploadSCFiles(this.files)">
  `;
  document.getElementById('scDetailModal').classList.add('open');
  renderSCCalc();
  loadSCFiles(c);
}

function renderSCCalc() {
  const c = scData.find(x => x.id === scDetailId);
  const out = document.getElementById('scCalcOut');
  if (!c || !out) return;
  const r = c.values[Number(document.getElementById('scCalcPick')?.value) || 0];
  if (!r) { out.innerHTML = ''; return; }
  const dr = scRowDrift(c, r);
  out.innerHTML = `
    <div class="reg-metric"><span>ค่าจริงของจุดวัด</span><strong>${scFmtTrue(r)}</strong></div>
    <div class="reg-metric"><span>ความไม่แน่นอนมาตรฐาน u = U/2</span><strong>${parseFloat((Number(r.uncertainty) / 2).toFixed(6))} ${escapeHtmlText(r.corr_unit)}</strong></div>
    ${dr.hasPrev ? `<div class="reg-metric"><span>Drift = |ค่าแก้ปัจจุบัน − ครั้งก่อน (${scSigned(dr.prevRow.correction)})|</span><strong>${parseFloat(dr.drift.toFixed(6))} ${escapeHtmlText(r.corr_unit)}</strong></div>
    <div class="reg-metric"><span>Dₛ = max(U, Drift) → ใช้ Dₛ/√3 ในงบ Uncer</span><strong>${parseFloat(dr.Ds.toFixed(6))} ${escapeHtmlText(r.corr_unit)}</strong></div>` : `<div class="reg-metric"><span>Drift</span><strong>ไม่มีใบครั้งก่อน → Dₛ = U</strong></div>`}
    <div class="reg-metric"><span>เทียบเกณฑ์ยอมรับ</span><strong>|${scSigned(r.correction)}| + ${r.uncertainty} ≤ ${r.mpe} ${escapeHtmlText(r.corr_unit)}</strong></div>
  `;
}

function closeSCDetail() {
  document.getElementById('scDetailModal').classList.remove('open');
  scDetailId = null;
}

function scFolder(c) { return 'stdcert_' + c.id + '_' + (c.cert_no || '').replace(/[^A-Za-z0-9_-]/g, ''); }

async function loadSCFiles(c) {
  const el = document.getElementById('scDetailFiles');
  if (!el) return;
  try {
    const { data, error } = await sb.storage.from('certificates').list(scFolder(c));
    if (error) throw error;
    const files = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
    if (!files.length) { el.innerHTML = '<div class="reg-empty">ยังไม่มีไฟล์</div>'; return; }
    el.innerHTML = files.map(f => {
      const size = f.metadata?.size ? Math.round(f.metadata.size / 1024) + ' KB' : '–';
      return `<div class="reg-file-row">
        <div class="reg-row-icon">${f.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</div>
        <div><div class="reg-name" style="font-size:12px;overflow-wrap:anywhere">${escapeHtmlText(f.name)}</div><div class="reg-sub">${escapeHtmlText(size)}</div></div>
        <button class="btn-view" onclick="viewFile('${scFolder(c)}','${escapeJsSingle(f.name)}')">ดู</button>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="reg-empty" style="color:var(--red)">โหลดไฟล์ไม่สำเร็จ</div>';
  }
}

async function uploadSCFiles(files) {
  const c = scData.find(x => x.id === scDetailId);
  if (!c || !files?.length) return;
  showLoading('กำลังอัพโหลด...');
  try {
    const names = [];
    for (const file of files) {
      const { error } = await sb.storage.from('certificates').upload(scFolder(c) + '/' + file.name, file, { upsert: true });
      if (error) throw error;
      names.push(file.name);
    }
    await logAudit('อัพโหลดไฟล์', { id: c.id, id_code: c.set_code, instrument_name: 'Cert Reference ' + c.cert_no }, { ไฟล์: { from: '–', to: names.join(', ') } });
    showToast('อัพโหลดสำเร็จ', 'success');
    document.getElementById('scDetailFileInput').value = '';
    loadSCFiles(c);
  } catch (e) {
    showToast('อัพโหลดไม่สำเร็จ: ' + e.message, 'error');
  } finally { hideLoading(); }
}

// ===== EDIT =====
function scRowHtml(r) {
  r = r || { nominal_value: '', unit: 'g', marking: '', correction: '', uncertainty: '', mpe: '', corr_unit: 'mg' };
  return `<tr>
    <td><input type="number" step="any" class="scNominal" value="${r.nominal_value}"></td>
    <td><input type="text" class="scUnit" value="${escapeHtmlAttr(r.unit)}" placeholder="g, °C, bar"></td>
    <td><input type="text" class="scMarking" value="${escapeHtmlAttr(r.marking || '')}"></td>
    <td><input type="number" step="any" class="scCorr" value="${r.correction}"></td>
    <td><input type="number" step="any" class="scUnc" value="${r.uncertainty}"></td>
    <td><input type="number" step="any" class="scMpe" value="${r.mpe}"></td>
    <td><input type="text" class="scCorrUnit" value="${escapeHtmlAttr(r.corr_unit)}"></td>
    <td><button class="btn-del" type="button" onclick="this.closest('tr').remove()">✕</button></td>
  </tr>`;
}
function addSCRow(r) { document.getElementById('scValueRows').insertAdjacentHTML('beforeend', scRowHtml(r)); }

function openSCEdit(id) {
  scEditingId = id;
  const c = id ? scData.find(x => x.id === id) : null;
  document.getElementById('scEditTitle').textContent = c ? '✏️ แก้ไขใบ Cert — ' + c.cert_no : '📜 เพิ่มใบ Cert';
  const set = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val ?? ''; };
  set('scCertNo', c?.cert_no); set('scSetCode', c?.set_code);
  set('scItem', c?.item); set('scManufacturer', c?.manufacturer);
  set('scClass', c?.class_grade); set('scSerial', c?.serial_no);
  set('scLab', c?.lab); set('scMeasDate', c?.measurement_date);
  set('scInterval', c?.interval_years ?? 2); set('scDueDate', c?.due_date);
  set('scRemark', c?.remark);
  document.getElementById('scCategory').value = c?.category === 'มวล/น้ำหนัก' ? 'ตุ้มน้ำหนักมาตรฐาน' : (c?.category || 'ตุ้มน้ำหนักมาตรฐาน');
  document.getElementById('scFile').value = '';
  document.getElementById('scValueRows').innerHTML = '';
  (c?.values?.length ? c.values : [null]).forEach(r => addSCRow(r));
  document.getElementById('scEditModal').classList.add('open');
}
function closeSCEdit() {
  document.getElementById('scEditModal').classList.remove('open');
  scEditingId = null;
}

function scAutoDue() {
  const meas = document.getElementById('scMeasDate').value;
  const years = parseInt(document.getElementById('scInterval').value) || 2;
  if (!meas) return;
  const d = new Date(meas + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  document.getElementById('scDueDate').value = d.toISOString().slice(0, 10);
}

function collectSCRows() {
  return [...document.getElementById('scValueRows').querySelectorAll('tr')].map((tr, i) => ({
    sort_order: i + 1,
    nominal_value: parseFloat(tr.querySelector('.scNominal').value),
    unit: tr.querySelector('.scUnit').value.trim() || 'g',
    marking: tr.querySelector('.scMarking').value.trim() || null,
    correction: parseFloat(tr.querySelector('.scCorr').value) || 0,
    uncertainty: parseFloat(tr.querySelector('.scUnc').value) || 0,
    mpe: parseFloat(tr.querySelector('.scMpe').value) || 0,
    corr_unit: tr.querySelector('.scCorrUnit').value.trim() || 'mg',
  })).filter(r => !Number.isNaN(r.nominal_value));
}

async function saveSC() {
  const certNo = document.getElementById('scCertNo').value.trim();
  const setCode = document.getElementById('scSetCode').value.trim();
  if (!certNo || !setCode) { showToast('กรุณากรอก Cert No. และชุดมาตรฐาน', 'error'); return; }
  const rows = collectSCRows();
  if (!rows.length) { showToast('กรุณากรอกผลวัดอย่างน้อย 1 จุด', 'error'); return; }
  const payload = {
    cert_no: certNo, set_code: setCode,
    category: document.getElementById('scCategory').value,
    item: document.getElementById('scItem').value.trim() || null,
    manufacturer: document.getElementById('scManufacturer').value.trim() || null,
    class_grade: document.getElementById('scClass').value.trim() || null,
    serial_no: document.getElementById('scSerial').value.trim() || null,
    lab: document.getElementById('scLab').value.trim() || null,
    measurement_date: document.getElementById('scMeasDate').value || null,
    interval_years: parseInt(document.getElementById('scInterval').value) || 2,
    due_date: document.getElementById('scDueDate').value || null,
    remark: document.getElementById('scRemark').value.trim() || null,
    updated_at: new Date().toISOString(),
  };
  const btn = document.getElementById('scSaveBtn');
  btn.disabled = true;
  showLoading('กำลังบันทึก...');
  try {
    let certId = scEditingId;
    if (scEditingId) {
      const { error } = await sb.from('standard_certs').update(payload).eq('id', scEditingId);
      if (error) throw error;
      const { error: delErr } = await sb.from('standard_cert_values').delete().eq('cert_id', scEditingId);
      if (delErr) throw delErr;
    } else {
      const { data, error } = await sb.from('standard_certs').insert(payload).select('id').single();
      if (error) throw error;
      certId = data.id;
    }
    const { error: valErr } = await sb.from('standard_cert_values')
      .insert(rows.map(r => ({ ...r, cert_id: certId })));
    if (valErr) throw valErr;

    // อัพโหลดไฟล์ถ้าเลือกไว้
    const fileInput = document.getElementById('scFile');
    if (fileInput.files[0]) {
      const folder = 'stdcert_' + certId + '_' + certNo.replace(/[^A-Za-z0-9_-]/g, '');
      const { error: upErr } = await sb.storage.from('certificates')
        .upload(folder + '/' + fileInput.files[0].name, fileInput.files[0], { upsert: true });
      if (upErr) showToast('บันทึกแล้ว แต่อัพโหลดไฟล์ไม่สำเร็จ: ' + upErr.message, 'error');
    }

    const label = certNo + ' (' + setCode + ' · ' + rows.length + ' จุด)';
    await logAudit(scEditingId ? 'แก้ไข' : 'เพิ่ม',
      { id: certId, id_code: setCode, instrument_name: 'Cert Reference ' + certNo },
      { 'ใบ Cert Reference': { from: scEditingId ? label : '–', to: label } });
    showToast(scEditingId ? 'แก้ไขใบ Cert แล้ว' : 'เพิ่มใบ Cert แล้ว', 'success');
    closeSCEdit();
    await loadStandardCerts();
  } catch (e) {
    showToast('บันทึกไม่ได้: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    hideLoading();
  }
}

async function deleteSC(id) {
  const c = scData.find(x => x.id === id);
  if (!c) return;
  if (!confirm('ต้องการลบใบ Cert ' + c.cert_no + ' (' + c.values.length + ' จุดวัด) ใช่หรือไม่?')) return;
  showLoading('กำลังลบ...');
  try {
    const { error } = await sb.from('standard_certs').delete().eq('id', id);
    if (error) throw error;
    await logAudit('ลบ', { id, id_code: c.set_code, instrument_name: 'Cert Reference ' + c.cert_no },
      { 'ใบ Cert Reference': { from: c.cert_no, to: '(ลบแล้ว)' } });
    showToast('ลบใบ Cert แล้ว', 'success');
    closeSCDetail();
    await loadStandardCerts();
  } catch (e) {
    showToast('ลบไม่ได้: ' + e.message, 'error');
  } finally { hideLoading(); }
}
