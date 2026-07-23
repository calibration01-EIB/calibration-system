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
    const mr = Array.isArray(p.ranges) && p.ranges.length ? p.ranges : null;
    const range = mr
      ? `หลายย่าน · ${mr.length} ย่าน`
      : ((p.capacity_from != null || p.capacity_to != null)
        ? `${p.capacity_from ?? '0'} – ${p.capacity_to ?? '∞'} ${p.unit || 'g'}` : '–');   // raw — cell escapes the whole string
    const mrTip = mr ? mr.map((r, i) => `ย่าน ${i + 1}: ${r.max ?? '?'} g${r.res ? ' d' + r.res : ''} · ${(Array.isArray(r.points) ? r.points.length : 0)} จุด`).join(' | ') : '';
    return `<tr>
      <td><strong>${escapeHtmlText(p.name || '–')}</strong></td>
      <td${mr ? ` title="${escapeHtmlText(mrTip)}"` : ''}>${escapeHtmlText(range)}</td>
      <td style="text-align:right">${pts.length}${mr ? ` <span title="พรีเซ็ทหลายย่าน — ${escapeHtmlText(mrTip)}" style="color:var(--accent);font-size:11px;white-space:nowrap">🎚️${mr.length}</span>` : ''}${(p.weights && Array.isArray(p.weights.checked) && p.weights.checked.length) ? ` <span title="พรีเซ็ทนี้เก็บตุ้มที่เลือกไว้ด้วย ${p.weights.checked.length} ลูก" style="color:var(--accent);font-size:11px;white-space:nowrap">🔩${p.weights.checked.length}</span>` : ''}${(p.setup && [p.setup.plPoint, p.setup.repPoint, p.setup.eccWt, p.setup.tareWt].some(v => v != null && String(v).trim() !== '')) ? ` <span title="พรีเซ็ทนี้เก็บ 3.1–3.5 (Preload/Repeatability/Eccentricity/Tare)" style="font-size:11px">⚙️</span>` : ''}</td>
      <td style="font-family:var(--mono);font-size:11px">${escapeHtmlText(pts.join(', ')) || '–'}</td>
      <td style="white-space:nowrap">${canEdit ? `<button class="btn-view" onclick="openPresetEdit('${p.id}')">✏️</button> <button class="btn-del" onclick="deleteCalPreset('${p.id}')">🗑️</button>` : ''}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="no-data">ยังไม่มีพรีเซ็ท — กด "เพิ่มพรีเซ็ท"</td></tr>';
}

// ชุดตุ้มที่อนุมัติแล้ว จัดกลุ่มตาม set_code → ใช้คำนวณ checked ตอนบันทึก (key = set_code หรือ 'ID:'+id_code ให้ตรง balance-cal)
let presetWeightGroups = {};
async function loadPresetWeightSets(selected) {
  const box = document.getElementById('presetWeightSets');
  if (!box) return;
  box.innerHTML = '<span style="color:var(--text3)">กำลังโหลดชุดตุ้ม…</span>';
  presetWeightGroups = {};
  try {
    const { data, error } = await sb.from('standard_weights')
      .select('id_code,set_code,nominal_value,unit,class_grade').eq('status', 'approved')
      .order('set_code').order('nominal_value');
    if (error) throw error;
    const groups = {};
    (data || []).forEach(w => { const key = w.set_code || ('ID:' + (w.id_code || '')); (groups[key] = groups[key] || []).push(w); });
    Object.keys(groups).forEach(k => { presetWeightGroups[k] = groups[k].map(w => w.id_code).filter(Boolean); });
    const sel = new Set((selected || []).map(String));
    const keys = Object.keys(groups);
    if (!keys.length) { box.innerHTML = '<span style="color:var(--text3)">ไม่มีชุดตุ้มที่อนุมัติ — อนุมัติที่หน้า “ใบ Cert Reference (ตุ้มมาตรฐาน)” ก่อน</span>'; return; }
    box.innerHTML = keys.map(k => {
      const ws = groups[k];
      const label = k + (ws[0].class_grade ? ' · ' + ws[0].class_grade : '') + ' (' + ws.length + ')';
      return `<label style="display:flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:8px;padding:4px 9px;cursor:pointer;background:var(--surface)"><input type="checkbox" class="presetSetChk" value="${escapeHtmlText(k)}" ${sel.has(k) ? 'checked' : ''}> ${escapeHtmlText(label)}</label>`;
    }).join('');
  } catch (e) {
    box.innerHTML = '<span style="color:var(--red)">โหลดชุดตุ้มไม่ได้: ' + escapeHtmlText(e.message) + '</span>';
  }
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
  // 3.1–3.5
  set('presetPlPoint', p?.setup?.plPoint);
  set('presetRepPoint', p?.setup?.repPoint);
  set('presetEccWt', p?.setup?.eccWt);
  set('presetEccPan', p?.setup?.eccPan ?? '0');
  set('presetTareWt', p?.setup?.tareWt);
  // ชุดตุ้ม (โหลด async + ติ๊กชุดที่พรีเซ็ทเก็บไว้)
  loadPresetWeightSets(Array.isArray(p?.weights?.sets) ? p.weights.sets : []);
  // พรีเซ็ทหลายย่าน: ซ่อนช่องย่านเดียว + โชว์สรุป read-only (แก้ได้แค่ชื่อ)
  const mr = Array.isArray(p?.ranges) && p.ranges.length ? p.ranges : null;
  const info = document.getElementById('presetMultiInfo');
  if (info) info.style.display = mr ? '' : 'none';
  document.querySelectorAll('#presetModal .presetSingleOnly').forEach(el => { el.style.display = mr ? 'none' : ''; });
  if (mr) {
    const box = document.getElementById('presetMultiRanges');
    if (box) box.innerHTML = mr.map((r, i) => {
      const nom = (Array.isArray(r.points) ? r.points : []).map(x => x.nominal).join(', ');
      return `ย่าน ${i + 1}: Max ${escapeHtmlText(String(r.max ?? '?'))} g${r.res ? ' · d ' + escapeHtmlText(String(r.res)) : ''} · ${(Array.isArray(r.points) ? r.points.length : 0)} จุด${nom ? ' (' + escapeHtmlText(nom) + ')' : ''}`;
    }).join('<br>');
  }
  document.getElementById('presetModal').classList.add('open');
}
function closePresetModal() { document.getElementById('presetModal').classList.remove('open'); presetEditingId = null; }

async function saveCalPreset() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const num = id => { const v = parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) ? v : null; };
  const name = val('presetName');
  const points = parsePresetPoints(val('presetPoints'));
  const editing = presetEditingId ? presetData.find(x => String(x.id) === String(presetEditingId)) : null;
  const keepRanges = (editing && Array.isArray(editing.ranges) && editing.ranges.length) ? editing.ranges : null;
  if (!name) { showToast('กรอกชื่อพรีเซ็ท', 'error'); return; }
  if (!keepRanges && !points.length) { showToast('กรอกจุดสอบอย่างน้อย 1 จุด (คั่นด้วยจุลภาค)', 'error'); return; }
  // ชุดตุ้มที่ติ๊ก → sets + checked (รวมลูกในชุดทั้งหมด) ให้ balance-cal ผูกตุ้มต่อจุดเอง
  const sets = [...document.querySelectorAll('.presetSetChk:checked')].map(el => el.value);
  const checked = sets.flatMap(k => presetWeightGroups[k] || []);
  const weights = sets.length ? { sets, checked, std_ov: {} } : null;
  // 3.1–3.5
  const setup = { plPoint: val('presetPlPoint'), repPoint: val('presetRepPoint'),
    eccWt: val('presetEccWt'), eccPan: val('presetEccPan'), tareWt: val('presetTareWt') };
  const hasSetup = [setup.plPoint, setup.repPoint, setup.eccWt, setup.tareWt].some(v => v !== '');
  const payload = {
    name, capacity_from: num('presetFrom'), capacity_to: num('presetTo'),
    points: keepRanges ? (Array.isArray(editing.points) ? editing.points : []) : points,
    unit: val('presetUnit') || 'g',
    ranges: keepRanges,
    weights, setup: hasSetup ? setup : null,
    updated_at: new Date().toISOString(),
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
