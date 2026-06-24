/* ===== 13-cmc.js ===== */
// ทะเบียน CMC แบบ 2 ตาราง: cmc_set (1 ใบขอบข่าย) → cmc_row (ช่วง/จุด)
// หน่วยมาตรฐาน: from_g/to_g = กรัม, cmc_mg = mg
// ====================================================
let cmcSets = [];
let cmcRows = [];           // แถวของชุดที่กำลังดู
let cmcCurrentSetId = null;
let cmcSetEditingId = null;
let cmcRowEditingId = null;

// ---- หน่วย ----
function cmcMassToG(v, unit) { const n = Number(v); if (!Number.isFinite(n)) return null; return unit === 'mg' ? n / 1000 : unit === 'kg' ? n * 1000 : n; }
function cmcCmcToMg(v, unit) { const n = Number(v); if (!Number.isFinite(n)) return null; return (unit === 'µg' || unit === 'ug') ? n / 1000 : unit === 'g' ? n * 1000 : n; }
function cmcFmtMass(g) { g = Number(g); if (g < 1) return +(g * 1000).toPrecision(4) + ' mg'; if (g >= 1000) return +(g / 1000) + ' kg'; return +g + ' g'; }
function cmcFmtCmc(mg) { mg = Number(mg); if (mg < 1) return +(mg * 1000).toPrecision(2) + ' µg'; if (mg >= 1000) return +(mg / 1000) + ' g'; return +mg + ' mg'; }
function cmcFmtRange(from_g, to_g, low_inc) { const lo = cmcFmtMass(from_g); const hi = (to_g === null || to_g === undefined) ? '∞' : cmcFmtMass(to_g); return (low_inc ? '' : '>') + lo + ' to ' + hi; }

async function loadCmcSets() {
  try {
    const { data, error } = await sb.from('cmc_set').select('*').order('created_at');
    if (error) throw error;
    cmcSets = data || [];
    if ((!cmcCurrentSetId || !cmcSets.some(s => s.id === cmcCurrentSetId)) && cmcSets.length) cmcCurrentSetId = cmcSets[0].id;
    renderCmcSets();
    await loadCmcRows();
  } catch (e) {
    const sel = document.getElementById('cmcSetList');
    if (sel) sel.innerHTML = '<option>โหลดไม่ได้: ' + escapeHtmlText(e.message) + '</option>';
  }
}

async function loadCmcRows() {
  cmcRows = [];
  if (cmcCurrentSetId) {
    const { data } = await sb.from('cmc_row').select('*').eq('set_id', cmcCurrentSetId).order('seq');
    cmcRows = (data || []).map(r => ({ ...r, from_g: Number(r.from_g), to_g: r.to_g === null ? null : Number(r.to_g), cmc_mg: Number(r.cmc_mg) }));
  }
  renderCmcRows();
}

function curSet() { return cmcSets.find(s => s.id === cmcCurrentSetId) || null; }

function renderCmcSets() {
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const sel = document.getElementById('cmcSetList');
  if (sel) sel.innerHTML = cmcSets.length
    ? cmcSets.map(s => `<option value="${s.id}"${s.id === cmcCurrentSetId ? ' selected' : ''}>${escapeHtmlText(s.parameter || '')} · ${escapeHtmlText(s.lab_status || '')} (Rev.${escapeHtmlText(s.revision || '-')})${s.is_active ? '' : ' [ปิดใช้]'}</option>`).join('')
    : '<option value="">— ยังไม่มีชุด CMC —</option>';
  const s = curSet();
  const meta = document.getElementById('cmcSetMeta');
  if (meta) meta.innerHTML = s ? `📋 อิง <b>${escapeHtmlText(s.based_on || '-')}</b> · ${escapeHtmlText(s.accred_no || '-')} · ${escapeHtmlText(s.value_kind)}${s.valid_to ? ' · ใช้ได้ถึง ' + fmtDateTH(s.valid_to) : ''}` : '';
  ['cmcSetAddBtn', 'cmcSetEditBtn', 'cmcSetDelBtn', 'cmcRowAddBtn'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = canEdit ? '' : 'none'; });
}

function renderCmcRows() {
  const tb = document.getElementById('cmcTableBody');
  if (!tb) return;
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const s = curSet();
  tb.innerHTML = cmcRows.length ? cmcRows.map(r => `<tr>
    <td class="cmc-range">${s && s.value_kind === 'point' ? cmcFmtMass(r.from_g) : cmcFmtRange(r.from_g, r.to_g, r.low_inc)}</td>
    <td class="cmc-val"><span class="cmc-pill">${cmcFmtCmc(r.cmc_mg)}</span></td>
    <td class="cmc-mg">${r.cmc_mg}</td>
    <td class="cmc-act">${canEdit ? `<button class="b-edit" onclick="openRowEdit('${r.id}')">✏️</button> <button class="b-del" onclick="deleteCmcRow('${r.id}')">🗑️</button>` : ''}</td>
  </tr>`).join('') : '<tr><td colspan="4" class="no-data">ยังไม่มีแถวในชุดนี้ — กด "+ เพิ่มแถว"</td></tr>';
}

function selectCmcSet(id) { cmcCurrentSetId = id || null; renderCmcSets(); loadCmcRows(); }

// ---- ชุด (set) ----
function openSetEdit(id) {
  cmcSetEditingId = id || null;
  const s = id ? cmcSets.find(x => x.id === id) : null;
  const set = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = (v ?? ''); };
  document.getElementById('cmcSetModalTitle').textContent = s ? 'แก้ไขชุด CMC' : 'เพิ่มชุด CMC';
  set('csQuantity', s?.quantity ?? 'มวล (Mass)');
  set('csParameter', s?.parameter ?? 'Electronic balance');
  set('csStatus', s?.lab_status ?? 'Permanent');
  set('csBasedOn', s?.based_on ?? 'UKAS LAB 14 : 2019');
  set('csKind', s?.value_kind ?? 'range');
  set('csAccred', s?.accred_no ?? 'CALIBRATION No.0384');
  set('csRev', s?.revision);
  set('csValidFrom', s?.valid_from);
  set('csValidTo', s?.valid_to);
  set('csFormNo', s?.form_no);
  const act = document.getElementById('csActive'); if (act) act.checked = s ? !!s.is_active : true;
  document.getElementById('cmcSetModal').classList.add('open');
}
function closeCmcSetModal() { document.getElementById('cmcSetModal').classList.remove('open'); cmcSetEditingId = null; }

async function saveCmcSet() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const payload = {
    quantity: val('csQuantity') || null, parameter: val('csParameter') || null,
    lab_status: val('csStatus') || null, based_on: val('csBasedOn') || null,
    value_kind: val('csKind') || 'range', accred_no: val('csAccred') || null,
    revision: val('csRev') || null, valid_from: val('csValidFrom') || null,
    valid_to: val('csValidTo') || null, form_no: val('csFormNo') || null,
    is_active: !!document.getElementById('csActive')?.checked, updated_at: new Date().toISOString(),
  };
  try {
    showLoading('กำลังบันทึก...');
    const isNew = !cmcSetEditingId;
    const res = cmcSetEditingId ? await sb.from('cmc_set').update(payload).eq('id', cmcSetEditingId).select('id')
      : await sb.from('cmc_set').insert(payload).select('id');
    if (res.error) throw res.error;
    if (isNew && res.data && res.data[0]) cmcCurrentSetId = res.data[0].id;
    closeCmcSetModal(); showToast(isNew ? 'เพิ่มชุดแล้ว' : 'แก้ไขแล้ว', 'success');
    await loadCmcSets();
  } catch (e) { showToast('บันทึกไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function deleteCmcSet(id) {
  id = id || cmcCurrentSetId; if (!id) return;
  if (!confirm('ลบชุด CMC นี้ พร้อมทุกแถวในชุด?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('cmc_set').delete().eq('id', id);
    if (error) throw error;
    if (cmcCurrentSetId === id) cmcCurrentSetId = null;
    showToast('ลบแล้ว', 'success'); await loadCmcSets();
  } catch (e) { showToast('ลบไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}

// ---- แถว (row) ----
function openRowEdit(id) {
  cmcRowEditingId = id || null;
  const r = id ? cmcRows.find(x => x.id === id) : null;
  const s = curSet();
  const isPoint = s && s.value_kind === 'point';
  const set = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = (v ?? ''); };
  document.getElementById('cmcRowModalTitle').textContent = (r ? 'แก้ไข' : 'เพิ่ม') + (isPoint ? 'จุด' : 'ช่วง') + ' CMC';
  document.getElementById('crPointMode').style.display = isPoint ? '' : 'none';
  document.getElementById('crRangeMode').style.display = isPoint ? 'none' : 'contents';
  // ค่าเดิมแสดงเป็น g/mg (ผู้ใช้เลือกหน่วยเองได้)
  set('crSeq', r?.seq ?? (cmcRows.length + 1));
  set('crFrom', r ? r.from_g : ''); set('crFromUnit', 'g');
  set('crTo', r && r.to_g !== null ? r.to_g : ''); set('crToUnit', 'g');
  const li = document.getElementById('crLowInc'); if (li) li.checked = r ? !!r.low_inc : false;
  set('crPoint', r ? r.from_g : ''); set('crPointUnit', 'g');
  set('crCmc', r ? r.cmc_mg : ''); set('crCmcUnit', 'mg');
  document.getElementById('cmcRowModal').classList.add('open');
}
function closeCmcRowModal() { document.getElementById('cmcRowModal').classList.remove('open'); cmcRowEditingId = null; }

async function saveCmcRow() {
  const s = curSet(); if (!s) { showToast('เลือกชุดก่อน', 'error'); return; }
  const val = id => document.getElementById(id)?.value;
  const isPoint = s.value_kind === 'point';
  let from_g, to_g, low_inc;
  if (isPoint) {
    from_g = cmcMassToG(val('crPoint'), val('crPointUnit')); to_g = from_g; low_inc = false;
    if (from_g === null) { showToast('กรอกค่า nominal', 'error'); return; }
  } else {
    from_g = cmcMassToG(val('crFrom'), val('crFromUnit'));
    to_g = (val('crTo') === '' ? null : cmcMassToG(val('crTo'), val('crToUnit')));
    low_inc = !!document.getElementById('crLowInc')?.checked;
    if (from_g === null) { showToast('กรอกขอบล่าง', 'error'); return; }
    if (to_g !== null && to_g <= from_g) { showToast('ขอบบนต้องมากกว่าขอบล่าง', 'error'); return; }
    // ตรวจช่วงทับซ้อนในชุดเดียวกัน (ยกเว้นแถวที่กำลังแก้)
    const hi = to_g === null ? Infinity : to_g;
    const overlap = cmcRows.some(r => r.id !== cmcRowEditingId && (Math.max(from_g, r.from_g) < Math.min(hi, r.to_g === null ? Infinity : r.to_g)));
    if (overlap) { showToast('ช่วงนี้ทับกับช่วงที่มีอยู่', 'error'); return; }
  }
  const cmc_mg = cmcCmcToMg(val('crCmc'), val('crCmcUnit'));
  if (cmc_mg === null) { showToast('กรอกค่า CMC', 'error'); return; }
  const payload = { set_id: s.id, seq: parseInt(val('crSeq')) || 0, from_g, to_g, low_inc, cmc_mg };
  try {
    showLoading('กำลังบันทึก...');
    const isNew = !cmcRowEditingId;
    const res = cmcRowEditingId ? await sb.from('cmc_row').update(payload).eq('id', cmcRowEditingId)
      : await sb.from('cmc_row').insert(payload);
    if (res.error) throw res.error;
    closeCmcRowModal(); showToast(isNew ? 'เพิ่มแถวแล้ว' : 'แก้ไขแล้ว', 'success');
    await loadCmcRows();
  } catch (e) { showToast('บันทึกไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}

async function deleteCmcRow(id) {
  if (!confirm('ลบแถวนี้?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('cmc_row').delete().eq('id', id);
    if (error) throw error;
    showToast('ลบแล้ว', 'success'); await loadCmcRows();
  } catch (e) { showToast('ลบไม่ได้: ' + e.message, 'error'); } finally { hideLoading(); }
}
