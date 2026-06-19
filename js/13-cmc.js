/* ===== 13-cmc.js ===== */
// ทะเบียน CMC (Calibration and Measurement Capability) — ขอบข่ายที่ห้องปฏิบัติการได้รับการรับรอง
// ค่าความสามารถการวัดที่ดีที่สุด ตามช่วงพิกัด · ตอนออกผลถ้า U ที่คำนวณ ≤ CMC จะรายงานเป็น CMC แทน (ISO/IEC 17025)
// ====================================================
let cmcData = [];
let cmcEditingId = null;

async function loadCmcScope() {
  const tbody = document.getElementById('cmcTableBody');
  if (tbody && !cmcData.length) tbody.innerHTML = '<tr><td colspan="9" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('cmc_scope').select('*').order('range_from');
    if (error) throw error;
    cmcData = data || [];
    renderCmc();
  } catch (e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="no-data" style="color:var(--red)">โหลดข้อมูลไม่ได้: ' + escapeHtmlText(e.message) + '</td></tr>';
  }
}

// ดึงค่า CMC ตามค่าพิกัด (หน่วยเดียวกับ range) — ช่วง from < nominal ≤ to · ใช้ในโมดูลสอบเทียบ
function cmcFor(nominal, quantity) {
  const n = Number(nominal);
  const hit = cmcData.find(c => (!quantity || c.quantity === quantity) && n > Number(c.range_from) && n <= Number(c.range_to));
  return hit ? { cmc: Number(hit.cmc), unit: hit.unit, row: hit } : null;
}

function renderCmc() {
  const tbody = document.getElementById('cmcTableBody');
  if (!tbody) return;
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const addBtn = document.getElementById('cmcAddBtn');
  if (addBtn) addBtn.style.display = canEdit ? '' : 'none';
  const q = (document.getElementById('cmcSearch')?.value || '').trim().toLowerCase();
  const rows = cmcData.filter(c => !q || [c.quantity, c.instrument_type, c.accred_cert_no].some(v => String(v || '').toLowerCase().includes(q)));
  tbody.innerHTML = rows.length ? rows.map(c => `<tr>
    <td>${escapeHtmlText(c.quantity || '–')}</td>
    <td>${escapeHtmlText(c.instrument_type || '–')}</td>
    <td style="text-align:right">${c.range_from}</td>
    <td style="text-align:right">${c.range_to}</td>
    <td style="text-align:right"><strong>${c.cmc}</strong></td>
    <td>${escapeHtmlText(c.unit || 'mg')}</td>
    <td>${escapeHtmlText(c.accred_cert_no || '–')}</td>
    <td>${c.valid_to ? fmtDateTH(c.valid_to) : '–'}</td>
    <td style="white-space:nowrap">${canEdit ? `<button class="btn-view" onclick="openCmcEdit('${c.id}')">✏️</button> <button class="btn-del" onclick="deleteCmc('${c.id}')">🗑️</button>` : ''}</td>
  </tr>`).join('') : '<tr><td colspan="9" class="no-data">ยังไม่มีช่วง CMC — กด "เพิ่มช่วง CMC"</td></tr>';
}

function openCmcEdit(id) {
  cmcEditingId = id || null;
  const c = id ? cmcData.find(x => x.id === id) : null;
  const set = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = (v ?? ''); };
  document.getElementById('cmcModalTitle').textContent = c ? 'แก้ไขช่วง CMC' : 'เพิ่มช่วง CMC';
  set('cmcQuantity', c?.quantity ?? 'มวล (Mass)');
  set('cmcInstrType', c?.instrument_type ?? 'เครื่องชั่งไฟฟ้า');
  set('cmcFrom', c?.range_from);
  set('cmcTo', c?.range_to);
  set('cmcVal', c?.cmc);
  set('cmcUnit', c?.unit ?? 'mg');
  set('cmcAccred', c?.accred_cert_no);
  set('cmcValidFrom', c?.valid_from);
  set('cmcValidTo', c?.valid_to);
  set('cmcRemark', c?.remark);
  document.getElementById('cmcModal').classList.add('open');
}
function closeCmcModal() { document.getElementById('cmcModal').classList.remove('open'); cmcEditingId = null; }

async function saveCmc() {
  const num = id => { const v = parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) ? v : null; };
  const val = id => (document.getElementById(id)?.value || '').trim();
  const from = num('cmcFrom'), to = num('cmcTo'), cmc = num('cmcVal');
  if (from === null || to === null || cmc === null) { showToast('กรอกช่วงพิกัด (จาก-ถึง) และค่า CMC', 'error'); return; }
  if (to <= from) { showToast('ช่วง "ถึง" ต้องมากกว่า "จาก"', 'error'); return; }
  const payload = {
    quantity: val('cmcQuantity') || 'มวล (Mass)',
    instrument_type: val('cmcInstrType') || null,
    range_from: from, range_to: to, cmc, unit: val('cmcUnit') || 'mg',
    accred_cert_no: val('cmcAccred') || null,
    valid_from: val('cmcValidFrom') || null,
    valid_to: val('cmcValidTo') || null,
    remark: val('cmcRemark') || null,
    updated_at: new Date().toISOString(),
  };
  try {
    showLoading('กำลังบันทึก...');
    const isNew = !cmcEditingId;
    const result = cmcEditingId
      ? await sb.from('cmc_scope').update(payload).eq('id', cmcEditingId)
      : await sb.from('cmc_scope').insert(payload);
    if (result.error) throw result.error;
    closeCmcModal();
    showToast(isNew ? 'เพิ่มช่วง CMC แล้ว' : 'แก้ไขแล้ว', 'success');
    await loadCmcScope();
  } catch (e) {
    showToast('บันทึกไม่ได้: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteCmc(id) {
  if (!confirm('ลบช่วง CMC นี้?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('cmc_scope').delete().eq('id', id);
    if (error) throw error;
    showToast('ลบแล้ว', 'success');
    await loadCmcScope();
  } catch (e) {
    showToast('ลบไม่ได้: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}
