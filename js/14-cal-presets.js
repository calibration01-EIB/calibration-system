/* ===== 14-cal-presets.js ===== */
// ทะเบียนพรีเซ็ทจุดสอบเทียบ (cal_point_presets) — ชุดจุดทดสอบมาตรฐานตามช่วงพิกัด
// หน้าสอบเทียบ (balance-cal) ดึงไปเป็นตัวเลือก/auto-match ตามพิกัดเครื่อง · จุดเก็บหน่วยกรัม (g)
// ====================================================
let presetData = [];
let presetEditingId = null;

async function loadCalPresets() {
  const tbody = document.getElementById('presetTableBody');
  if (tbody && !presetData.length) tbody.innerHTML = '<tr><td colspan="5" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('cal_point_presets').select('*').order('capacity_from', { nullsFirst: true });
    if (error) throw error;
    presetData = data || [];
    renderCalPresets();
  } catch (e) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="no-data" style="color:var(--red)">โหลดข้อมูลไม่ได้: ' + escapeHtmlText(e.message) + '</td></tr>';
  }
}

// แปลงข้อความ "1, 2, 5, 10" → [1,2,5,10] (ตัดค่าที่ไม่ใช่ตัวเลข/≤0)
function parsePresetPoints(text) {
  return String(text || '').split(/[\s,]+/).map(t => parseFloat(t)).filter(v => Number.isFinite(v) && v > 0);
}

function renderCalPresets() {
  const tbody = document.getElementById('presetTableBody');
  if (!tbody) return;
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const addBtn = document.getElementById('presetAddBtn');
  if (addBtn) addBtn.style.display = canEdit ? '' : 'none';
  const q = (document.getElementById('presetSearch')?.value || '').trim().toLowerCase();
  const rows = presetData.filter(p => !q || String(p.name || '').toLowerCase().includes(q));
  tbody.innerHTML = rows.length ? rows.map(p => {
    const pts = Array.isArray(p.points) ? p.points : [];
    const range = (p.capacity_from != null || p.capacity_to != null)
      ? `${p.capacity_from ?? '0'} – ${p.capacity_to ?? '∞'} ${escapeHtmlText(p.unit || 'g')}` : '–';
    return `<tr>
      <td><strong>${escapeHtmlText(p.name || '–')}</strong></td>
      <td>${range}</td>
      <td style="text-align:right">${pts.length}${(p.weights && Array.isArray(p.weights.checked) && p.weights.checked.length) ? ` <span title="พรีเซ็ทนี้เก็บตุ้มที่เลือกไว้ด้วย ${p.weights.checked.length} ลูก" style="color:var(--accent);font-size:11px;white-space:nowrap">🔩${p.weights.checked.length}</span>` : ''}</td>
      <td style="font-family:var(--mono);font-size:11px">${escapeHtmlText(pts.join(', ')) || '–'}</td>
      <td style="white-space:nowrap">${canEdit ? `<button class="btn-view" onclick="openPresetEdit('${p.id}')">✏️</button> <button class="btn-del" onclick="deleteCalPreset('${p.id}')">🗑️</button>` : ''}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="no-data">ยังไม่มีพรีเซ็ท — กด "เพิ่มพรีเซ็ท"</td></tr>';
}

function openPresetEdit(id) {
  presetEditingId = id || null;
  const p = id ? presetData.find(x => String(x.id) === String(id)) : null;
  const set = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = (v ?? ''); };
  document.getElementById('presetModalTitle').textContent = p ? 'แก้ไขพรีเซ็ทจุด' : 'เพิ่มพรีเซ็ทจุด';
  set('presetName', p?.name);
  set('presetFrom', p?.capacity_from);
  set('presetTo', p?.capacity_to);
  set('presetUnit', p?.unit ?? 'g');
  set('presetPoints', Array.isArray(p?.points) ? p.points.join(', ') : '');
  document.getElementById('presetModal').classList.add('open');
}
function closePresetModal() { document.getElementById('presetModal').classList.remove('open'); presetEditingId = null; }

async function saveCalPreset() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const num = id => { const v = parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) ? v : null; };
  const name = val('presetName');
  const points = parsePresetPoints(val('presetPoints'));
  if (!name) { showToast('กรอกชื่อพรีเซ็ท', 'error'); return; }
  if (!points.length) { showToast('กรอกจุดสอบอย่างน้อย 1 จุด (คั่นด้วยจุลภาค)', 'error'); return; }
  const payload = {
    name, capacity_from: num('presetFrom'), capacity_to: num('presetTo'),
    points, unit: val('presetUnit') || 'g', updated_at: new Date().toISOString(),
  };
  try {
    showLoading('กำลังบันทึก...');
    const isNew = !presetEditingId;
    const result = presetEditingId
      ? await sb.from('cal_point_presets').update(payload).eq('id', presetEditingId)
      : await sb.from('cal_point_presets').insert(payload);
    if (result.error) throw result.error;
    closePresetModal();
    showToast(isNew ? 'เพิ่มพรีเซ็ทแล้ว' : 'แก้ไขแล้ว', 'success');
    await loadCalPresets();
  } catch (e) {
    showToast('บันทึกไม่ได้: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function deleteCalPreset(id) {
  if (!confirm('ลบพรีเซ็ทนี้?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.from('cal_point_presets').delete().eq('id', id);
    if (error) throw error;
    showToast('ลบแล้ว', 'success');
    await loadCalPresets();
  } catch (e) {
    showToast('ลบไม่ได้: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}
