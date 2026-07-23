/* ===== 03-instruments.js ===== (generated from index.html inline app script) */
// CERT MODAL — Supabase Storage
// ====================================================
let currentInstrumentId = null;

async function openCertModal(instrumentId, idCode, certNo, equipment) {
  currentInstrumentId = instrumentId;
  document.getElementById('mIdCode').textContent = idCode;
  document.getElementById('mCertNo').textContent = certNo;
  document.getElementById('mEquipment').textContent = equipment;
  document.getElementById('certModal').classList.add('open');
  document.getElementById('fileListSection').innerHTML = '<p style="color:var(--text3);font-size:13px">กำลังโหลดไฟล์...</p>';
  await loadCertFiles(instrumentId, idCode);
}

async function loadCertFiles(instrumentId, idCode) {
  try {
    const folder = `cert_${instrumentId}_${idCode}`;
    const { data, error } = await sb.storage.from('certificates').list(folder);
    if (error) throw error;
    renderFileList(data || [], folder);

    // อัพเดทปุ่มในตาราง
    const validCnt = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').length;
    fileCountCache[instrumentId] = validCnt;
    const btn = document.getElementById('certbtn-' + instrumentId);
    if (btn) {
      btn.className = validCnt > 0 ? 'btn-cert btn-cert-has' : 'btn-cert btn-cert-empty';
      btn.innerHTML = validCnt > 0 ? `📎 ${validCnt} ไฟล์` : '📎 ไฟล์';
    }
  } catch(e) {
    document.getElementById('fileListSection').innerHTML = '<p style="color:var(--red);font-size:13px">โหลดไฟล์ไม่สำเร็จ</p>';
  }
}

function renderFileList(files, folder) {
  const section = document.getElementById('fileListSection');
  const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
  if (!validFiles.length) { section.innerHTML = '<p style="color:var(--text3);font-size:13px;margin-top:12px;text-align:center">ยังไม่มีไฟล์</p>'; return; }

  section.innerHTML = validFiles.map(f => {
    const icon = f.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️';
    const size = f.metadata?.size ? (f.metadata.size/1024).toFixed(0) + ' KB' : '';
    const canEdit = currentUser?.role !== 'viewer';
    return `<div class="file-item">
      <div class="file-item-icon">${icon}</div>
      <div class="file-item-info">
        <div class="file-item-name">${f.name}</div>
        <div class="file-item-meta">${size}</div>
      </div>
      <div class="file-item-actions">
        <button class="btn-view" onclick="viewFile('${folder}','${f.name}')">ดู</button>
        ${canEdit ? `<button class="btn-del" onclick="deleteFile('${folder}','${f.name}')">ลบ</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function viewFile(folder, name) {
  const { data } = await sb.storage.from('certificates').createSignedUrl(`${folder}/${name}`, 300);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
}

async function deleteFile(folder, name) {
  if (!confirm('ต้องการลบไฟล์นี้?')) return;
  const { error } = await sb.storage.from('certificates').remove([`${folder}/${name}`]);
  if (error) { showToast('ลบไม่สำเร็จ', 'error'); return; }
  showToast('ลบไฟล์แล้ว', 'success');
  const idCode = document.getElementById('mIdCode').textContent;
  const inst = allData.find(d => d.id === currentInstrumentId);
  await logAudit('ลบไฟล์', inst || { id: currentInstrumentId, id_code: idCode }, {
    ไฟล์: { from: name, to: '(ลบแล้ว)' },
  });
  await loadCertFiles(currentInstrumentId, idCode);
}

async function handleFileSelect(files) {
  if (!currentInstrumentId) return;
  if (currentUser?.role === 'viewer') { showToast('ไม่มีสิทธิ์อัพโหลด', 'error'); return; }
  const idCode = document.getElementById('mIdCode').textContent;
  const folder = `cert_${currentInstrumentId}_${idCode}`;
  showLoading('กำลังอัพโหลด...');
  try {
    const uploadedNames = [];
    for (const file of files) {
      const { error } = await sb.storage.from('certificates').upload(`${folder}/${file.name}`, file, { upsert: true });
      if (error) throw error;
      uploadedNames.push(file.name);
    }
    showToast('อัพโหลดสำเร็จ', 'success');
    const inst = allData.find(d => d.id === currentInstrumentId);
    await logAudit('อัพโหลดไฟล์', inst || { id: currentInstrumentId, id_code: idCode }, {
      ไฟล์: { from: '–', to: uploadedNames.join(', ') },
    });
    await loadCertFiles(currentInstrumentId, idCode);
  } catch(e) { showToast('อัพโหลดไม่สำเร็จ: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

function closeCertModal() { document.getElementById('certModal').classList.remove('open'); currentInstrumentId = null; }

// ====================================================
// INSTRUMENT DETAIL MODAL (registry redesign)
// ====================================================
function regDetailItem(label, value, full = false) {
  return `<div class="reg-info-item ${full ? 'full' : ''}"><span>${escapeHtmlText(label)}</span><strong>${escapeHtmlText(value || '–')}</strong></div>`;
}

// แสดงชื่อหน่วยงานเต็มใต้ช่องรหัสหน่วยงานในฟอร์ม (จาก list departments)
function updateDeptUnitHint() {
  const el = document.getElementById('iDeptUnitHint');
  if (!el) return;
  const code = (document.getElementById('iDept')?.value || '').trim().toUpperCase();
  el.textContent = (code && typeof deptUnitName === 'function') ? deptUnitName(code) : '';
}

// ===== รูปภาพประกอบเครื่องมือ (hero gallery) =====
const INST_PHOTO_MAX = 5;
function instPhotoFolder(d) { return `photos_${d.id}_${d.id_code}`; }

async function loadDetailPhotos(d) {
  const el = document.getElementById('regDetailPhotos');
  if (!el) return;
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const folder = instPhotoFolder(d);
  try {
    const { data, error } = await sb.storage.from('certificates').list(folder);
    if (error) throw error;
    const imgs = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder' && /\.(jpe?g|png|webp|gif)$/i.test(f.name)).slice(0, INST_PHOTO_MAX);
    const items = [];
    for (const f of imgs) {
      const { data: u } = await sb.storage.from('certificates').createSignedUrl(`${folder}/${f.name}`, 600);
      if (u?.signedUrl) items.push({ name: f.name, url: u.signedUrl });
    }
    const id = Number(d.id) || 0;
    const cells = items.map(it => `<div class="reg-photo-cell">
      <img src="${it.url}" onclick="openPhotoFull('${it.url}')" alt="รูปเครื่องมือ">
      ${canEdit ? `<button class="reg-photo-edit" title="หมุน / ครอปรูป" onclick="editInstrumentPhoto('${folder}','${escapeJsSingle(it.name)}',${id})">✎</button>` : ''}
      ${canEdit ? `<button class="reg-photo-del" title="ลบรูป" onclick="deleteInstrumentPhoto('${folder}','${escapeJsSingle(it.name)}',${id})">✕</button>` : ''}
    </div>`).join('');
    const addCell = (canEdit && items.length < INST_PHOTO_MAX)
      ? `<div class="reg-photo-addcell">
        <div class="add-title"><span class="ic">＋</span>เพิ่มรูป</div>
        <div class="add-acts">
          <button type="button" onclick="uploadInstrumentPhoto(${id}, true)">📷 ถ่ายภาพ</button>
          <button type="button" onclick="uploadInstrumentPhoto(${id}, false)">🖼 เลือกรูป</button>
        </div>
      </div>` : '';
    if (!items.length && !canEdit) {
      el.innerHTML = `<div class="reg-photo-empty">ยังไม่มีรูปเครื่องมือ</div>`;
      return;
    }
    el.innerHTML = `<div class="reg-photo-grid">${cells}${addCell}</div>`;
  } catch (e) {
    el.innerHTML = `<div class="reg-photo-empty" style="color:var(--red)">โหลดรูปไม่สำเร็จ</div>`;
  }
}
function openPhotoFull(url) { if (url) window.open(url, '_blank'); }

function uploadInstrumentPhoto(id, useCamera) {
  const d = (allData || []).find(x => x.id === id); if (!d) return;
  if (!(currentUser?.role === 'admin' || currentUser?.role === 'editor')) { showToast('ไม่มีสิทธิ์อัพโหลด', 'error'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  if (useCamera) inp.setAttribute('capture', 'environment');
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (!/^image\//.test(f.type || '')) { showToast('รับเฉพาะไฟล์รูปภาพ', 'error'); return; }
    // เปิดตัวแก้รูปก่อนบันทึก — หมุนรูปที่ถ่ายกลับหัว/แนวนอน + ครอปได้ · บันทึกเป็น JPEG ย่อขนาด
    openPhotoEditor(f, blob => saveInstrumentPhoto(d, `${Date.now()}_photo.jpg`, blob, true));
  };
  inp.click();
}
// อัพโหลดรูป (จากตัวแก้รูป) — isNew: เช็คจำนวนไม่เกิน INST_PHOTO_MAX ก่อน
async function saveInstrumentPhoto(d, name, blob, isNew) {
  const folder = instPhotoFolder(d);
  try {
    showLoading('กำลังบันทึกรูป...');
    if (isNew) {
      const { data: cur } = await sb.storage.from('certificates').list(folder);
      const n = (cur || []).filter(x => x.name !== '.emptyFolderPlaceholder' && /\.(jpe?g|png|webp|gif)$/i.test(x.name)).length;
      if (n >= INST_PHOTO_MAX) { showToast(`รูปครบ ${INST_PHOTO_MAX} แล้ว — ลบก่อนถ้าจะเพิ่ม`, 'error'); return; }
    }
    const { error } = await sb.storage.from('certificates').upload(`${folder}/${name}`, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    showToast('บันทึกรูปแล้ว', 'success');
    await loadDetailPhotos(d);
  } catch (e) { showToast('บันทึกรูปไม่สำเร็จ: ' + (e.message || ''), 'error'); }
  finally { hideLoading(); }
}
// แก้รูปที่อัพไว้แล้ว: โหลดกลับมา → หมุน/ครอป → เขียนทับชื่อเดิม
async function editInstrumentPhoto(folder, name, id) {
  if (!(currentUser?.role === 'admin' || currentUser?.role === 'editor')) return;
  try {
    showLoading('กำลังโหลดรูป...');
    const { data: u, error } = await sb.storage.from('certificates').createSignedUrl(`${folder}/${name}`, 120);
    if (error || !u?.signedUrl) throw (error || new Error('no url'));
    const blob = await (await fetch(u.signedUrl)).blob();
    hideLoading();
    const d = (allData || []).find(x => x.id === id);
    openPhotoEditor(blob, out => { if (d) saveInstrumentPhoto(d, name, out, false); });
  } catch (e) { hideLoading(); showToast('โหลดรูปไม่สำเร็จ: ' + (e.message || ''), 'error'); }
}

// ===== ตัวแก้รูป: หมุน 90° + ครอปด้วยการลากกรอบ (canvas ล้วน ไม่ใช้ไลบรารี — เบากับเครื่อง GPU อ่อน) =====
let PE = null;              // { bmp, rot, sel:{x,y,w,h}|null, cb }
const PE_MAX_SIDE = 1600;   // จำกัดด้านยาวตอนบันทึก — ไฟล์เล็ก โหลดเร็ว
function ensurePhotoEditor() {
  if (document.getElementById('photoEditorOverlay')) return;
  const div = document.createElement('div');
  div.id = 'photoEditorOverlay';
  div.innerHTML = `
    <div class="pe-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <b style="font-size:14px">จัดรูปก่อนบันทึก — ลากบนรูปเพื่อครอป · ปุ่มหมุนถ้ารูปกลับหัว/แนวนอน</b>
        <button onclick="closePhotoEditor()" style="border:none;background:none;font-size:20px;color:var(--text3);cursor:pointer">✕</button>
      </div>
      <div class="pe-canvas-wrap"><canvas id="peCanvas"></canvas></div>
      <div class="pe-btns">
        <button type="button" onclick="peRotate(-90)">↺ หมุนซ้าย</button>
        <button type="button" onclick="peRotate(90)">↻ หมุนขวา</button>
        <button type="button" onclick="peResetSel()">⛶ ยกเลิกกรอบครอป</button>
        <button type="button" class="pe-primary" onclick="peSave()">✔ ใช้รูปนี้</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  const cv = document.getElementById('peCanvas');
  let drag = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; };
  cv.addEventListener('pointerdown', e => { if (!PE) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); drag = pos(e); PE.sel = null; peDraw(); });
  cv.addEventListener('pointermove', e => {
    if (!PE || !drag) return;
    const p = pos(e), x = Math.max(0, Math.min(drag.x, p.x)), y = Math.max(0, Math.min(drag.y, p.y));
    PE.sel = { x, y, w: Math.min(cv.width, Math.max(drag.x, p.x)) - x, h: Math.min(cv.height, Math.max(drag.y, p.y)) - y };
    peDraw();
  });
  cv.addEventListener('pointerup', () => { if (!PE) return; drag = null; if (PE.sel && (PE.sel.w < 16 || PE.sel.h < 16)) { PE.sel = null; peDraw(); } });
}
async function openPhotoEditor(blob, cb) {
  ensurePhotoEditor();
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }   // ใช้ EXIF หมุนให้ก่อนอัตโนมัติ
  catch (e) { try { bmp = await createImageBitmap(blob); } catch (e2) { showToast('เปิดรูปไม่สำเร็จ', 'error'); return; } }
  PE = { bmp, rot: 0, sel: null, cb };
  document.getElementById('photoEditorOverlay').style.display = 'flex';
  peDraw();
}
function closePhotoEditor() { PE = null; const o = document.getElementById('photoEditorOverlay'); if (o) o.style.display = 'none'; }
function peRotate(deg) { if (!PE) return; PE.rot = (PE.rot + deg + 360) % 360; PE.sel = null; peDraw(); }
function peResetSel() { if (!PE) return; PE.sel = null; peDraw(); }
function peDraw() {
  const cv = document.getElementById('peCanvas'); if (!cv || !PE) return;
  const rot90 = PE.rot % 180 !== 0;
  const dw = rot90 ? PE.bmp.height : PE.bmp.width, dh = rot90 ? PE.bmp.width : PE.bmp.height;
  const scale = Math.min(1, PE_MAX_SIDE / Math.max(dw, dh));
  cv.width = Math.max(1, Math.round(dw * scale)); cv.height = Math.max(1, Math.round(dh * scale));
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.rotate(PE.rot * Math.PI / 180);
  const sw = rot90 ? cv.height : cv.width, sh = rot90 ? cv.width : cv.height;
  ctx.drawImage(PE.bmp, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
  if (PE.sel) {   // มืดรอบนอกกรอบครอป + เส้นประ
    const s = PE.sel;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, cv.width, s.y);
    ctx.fillRect(0, s.y, s.x, s.h);
    ctx.fillRect(s.x + s.w, s.y, cv.width - s.x - s.w, s.h);
    ctx.fillRect(0, s.y + s.h, cv.width, cv.height - s.y - s.h);
    ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, Math.max(0, s.w - 2), Math.max(0, s.h - 2));
    ctx.setLineDash([]);
  }
}
function peSave() {
  if (!PE) return;
  const cv = document.getElementById('peCanvas');
  const sel = PE.sel;
  PE.sel = null; peDraw();   // วาดใหม่แบบไม่มีกรอบก่อนตัด
  const s = sel || { x: 0, y: 0, w: cv.width, h: cv.height };
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(s.w)); out.height = Math.max(1, Math.round(s.h));
  out.getContext('2d').drawImage(cv, s.x, s.y, s.w, s.h, 0, 0, out.width, out.height);
  const cb = PE.cb;
  out.toBlob(b => { closePhotoEditor(); if (b && cb) cb(b); }, 'image/jpeg', 0.87);
}
async function deleteInstrumentPhoto(folder, name, id) {
  if (!(currentUser?.role === 'admin' || currentUser?.role === 'editor')) return;
  if (!confirm('ลบรูปนี้?')) return;
  try {
    showLoading('กำลังลบ...');
    const { error } = await sb.storage.from('certificates').remove([`${folder}/${name}`]);
    if (error) throw error;
    showToast('ลบรูปแล้ว', 'success');
    const d = (allData || []).find(x => x.id === id);
    if (d) await loadDetailPhotos(d);
  } catch (e) { showToast('ลบไม่สำเร็จ: ' + (e.message || ''), 'error'); }
  finally { hideLoading(); }
}

// เปิดหน้าสอบเทียบเครื่องชั่ง (balance-cal) พร้อมข้อมูลเครื่องที่เลือก
function openBalanceCal(id) {
  const d = (allData || []).find(x => x.id === id);
  if (!d) { if (typeof showToast === 'function') showToast('ไม่พบเครื่องมือ', 'error'); return; }
  // เครื่องกรอกมือไม่มี capacity/resolution ตัวเลข และไม่มี range_profile → แปลงจากช่องหลายช่วง
  // (resolution_text / usage_max / tolerance) ด้วย logic เดียวกับตัว import บัญชีรายการ
  const reg = (typeof parseBalanceRegister === 'function' ? parseBalanceRegister(d, d.instrument_type) : null) || {};
  const inst = {
    from: 'รายการเครื่องมือ',
    instrument_id: Number(d.id) || null,
    name: d.instrument_name || '', name_th: '',
    id_code: d.id_code || '', asset: d.asset_no || '',
    manufacturer: d.brand || '', model: d.model || '', serial: d.serial_no || '',
    // capacity_unit มีค่า = พิกัดไม่ใช่หน่วยมวล (ไม่ใช่กรัม) — อย่าส่งให้ cal engine เครื่องชั่ง
    capacity: (d.capacity_unit ? '' : d.capacity) ?? reg.capacity ?? '', resolution: d.resolution ?? reg.resolution ?? '', accuracy_class: d.accuracy_class || '',
    user_range: d.range_val || '', cal_type: d.cal_type || '', tolerance: d.tolerance || '', range_profile: d.range_profile || reg.range_profile || null, tolerance_bands: d.tolerance_bands || null,
    balance_type: d.balance_type || null,   // single | range | interval — ใบบันทึกเปิดมาถูกประเภทเลย
    section: d.division || '', unit_dept: d.department || '', location: d.location || '',
    date_recv: '',
  };
  window.open('balance-cal.html#inst=' + encodeURIComponent(JSON.stringify(inst)), '_blank');
}

function openInstrumentDetail(id) {
  const d = allData.find(x => x.id === id);
  if (!d) return;
  const displayType = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
  const [letter, icon, color] = regTypeMeta(displayType, d);
  const days = d.days_left;
  const cancelled = d.calibration_cancelled === true
    || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
  const remarkClean = typeof window.stripCalibrationCancelMarker === 'function'
    ? window.stripCalibrationCancelMarker(d.remark) : d.remark;
  let statusBadge, dueExtra;
  if (cancelled) { statusBadge = '<span class="badge badge-red">ยกเลิกสอบเทียบ</span>'; dueExtra = ''; }
  else if (days === null) { statusBadge = '<span class="badge badge-gray">–</span>'; dueExtra = ''; }
  else if (days < 0) { statusBadge = '<span class="badge badge-red">🔴 เลยกำหนด</span>'; dueExtra = ` (เกิน ${Math.abs(days)} วัน)`; }
  else if (days <= 30) { statusBadge = '<span class="badge badge-amber">🟡 ใกล้ครบ</span>'; dueExtra = days === 0 ? ' (วันนี้)' : ` (อีก ${days} วัน)`; }
  else { statusBadge = '<span class="badge badge-green">🟢 ปกติ</span>'; dueExtra = ` (อีก ${days} วัน)`; }
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'editor';
  const openCertCall = `openCertModal(${Number(d.id)||0},'${escapeJsSingle(d.id_code)}','${escapeJsSingle(d.cert_no)}','${escapeJsSingle(d.instrument_name)}')`;
  const isBalance = letter === 'B' || /ชั่ง|balance/i.test(displayType || d.instrument_type || '');

  document.getElementById('instrumentDetailBody').innerHTML = `
    <div class="reg-detail-head">
      <div class="reg-detail-title">
        <span class="reg-iconbox" style="color:${color};background:${color}14;border-color:${color}40"><i class="ti ${icon}"></i></span>
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="reg-name" style="font-size:15px">${escapeHtmlText(d.instrument_name || '–')}</span>
            ${statusBadge}
            ${typeof repairBadgeHtml === 'function' ? repairBadgeHtml(d.id) : ''}
          </div>
          <div class="reg-sub" style="margin-top:2px">
            <span class="reg-chip" style="background:${color};width:30px;min-height:20px;font-size:11px">${escapeHtmlText(letter)}</span>
            ${escapeHtmlText((displayType || d.instrument_type || '–').split(' (')[0])} · ${escapeHtmlText(d.department || '–')}
          </div>
        </div>
      </div>
      <div class="reg-detail-actions">
        ${isBalance && canEdit ? `<button class="btn-view" style="background:#00695C;color:#fff;border-color:#00695C" onclick="closeInstrumentDetail();openBalanceCal(${Number(d.id)||0})">⚖️ สอบเทียบ</button>` : ''}
        ${canEdit ? `<button class="btn-view" onclick="closeInstrumentDetail();openInstrumentModal(${Number(d.id)||0})">✏️ แก้ไข</button>` : ''}
        <button class="btn-view" onclick="closeInstrumentDetail();${openCertCall}">📎 ไฟล์</button>
        <button class="btn-view" onclick="closeInstrumentDetail();openCalHistory(${Number(d.id)||0})">🕘 ประวัติ</button>
        <button class="btn-view" onclick="closeInstrumentDetail();openRepairsForInstrument(${Number(d.id)||0})">🔧 ประวัติซ่อม</button>
        ${canEdit && typeof getOpenRepair === 'function' && !getOpenRepair(d.id) ? `<button class="btn-view" style="color:#b45309;border-color:#b45309" onclick="closeInstrumentDetail();showPage('repairs');openRepairModal(null, ${Number(d.id)||0})">🔧 แจ้งซ่อม</button>` : ''}
        ${canEdit ? `<button class="btn-view" style="color:#0b7a44;border-color:#0b7a44" onclick="closeInstrumentDetail();openAssetOutModal(${Number(d.id)||0})">📤 นำทรัพย์สินออก</button>` : ''}
        <button class="btn-view" onclick="closeInstrumentDetail();openAssetOutHistory(${Number(d.id)||0})">📄 ใบนำออก (ประวัติ)</button>
      </div>
    </div>

    <div class="reg-section">รูปเครื่องมือ</div>
    <div id="regDetailPhotos"><div class="reg-photo-empty">กำลังโหลดรูป...</div></div>

    <div class="reg-metric-grid">
      <div class="reg-metric"><span>CERT.</span><strong>${escapeHtmlText(d.cert_no || '–')}</strong></div>
      <div class="reg-metric"><span>ID.No.</span><strong>${escapeHtmlText(d.id_code || '–')}</strong></div>
      <div class="reg-metric"><span>วันที่สอบเทียบ</span><strong>${formatDate(d.cal_date)}</strong></div>
      <div class="reg-metric"><span>วันครบกำหนด</span><strong>${formatDate(d.due_date)}${escapeHtmlText(dueExtra)}</strong></div>
    </div>

    <div class="reg-section">รายละเอียดเครื่องมือ</div>
    <div class="reg-info-grid">
      ${regDetailItem('ประเภทเครื่องมือ', displayType)}
      ${regDetailItem('กลุ่มสินค้า (Product group)', d.product_group)}
      ${regDetailItem('รหัสเครื่องจักร (Machine Code)', d.machine_name)}
      ${regDetailItem('ยี่ห้อ (Manufacturer)', d.brand)}
      ${regDetailItem('รุ่น (Model)', d.model)}
      ${regDetailItem('พิกัด Max', d.capacity != null && d.capacity !== '' ? `${d.capacity} ${d.capacity_unit || 'g'}` : '')}
      ${regDetailItem('ความละเอียด (Resolution)', d.resolution_text || d.resolution)}
      ${regDetailItem('Accuracy Class', d.accuracy_class)}
      ${regDetailItem('สถานที่ใช้งาน', d.location)}
      ${regDetailItem('Range', d.range_val)}
      ${regDetailItem('Tolerance (±)', d.tolerance)}
      ${regDetailItem('ใช้งานต่ำสุด (Min usage)', d.usage_min)}
      ${regDetailItem('ใช้งานสูงสุด (Max usage)', d.usage_max)}
      ${regDetailItem('ความถี่ใช้งาน (Usage freq.)', d.usage_frequency)}
      ${regDetailItem('USP Type (A/B/C)', d.usp_type)}
      ${regDetailItem('ประเภทเครื่องชั่ง', ({ single: 'Single Range (ช่วงเดียว)', range: 'Multiple Range (หลายช่วง)', interval: 'Multi-Interval (หลายช่วงความละเอียด)' })[d.balance_type] || d.balance_type)}
      ${regDetailItem('Serial No.', d.serial_no)}
      ${regDetailItem('Asset No.', d.asset_no)}
      ${regDetailItem('หน่วยงาน (Unit)', d.department && typeof deptUnitName === 'function' && deptUnitName(d.department) ? `${d.department} · ${deptUnitName(d.department)}` : d.department)}
      ${regDetailItem('แผนก (Section)', d.division)}
      ${regDetailItem('ความถี่สอบเทียบ', d.cal_frequency)}
      ${regDetailItem('ภายใน/ภายนอก', d.cal_type)}
      ${regDetailItem('สถานะสอบเทียบ', cancelled ? 'ยกเลิกสอบเทียบ' : 'ใช้งาน / รอสอบเทียบ')}
      ${regDetailItem('Remark', remarkClean, true)}
    </div>

    <div class="reg-section">ไฟล์ใบรับรอง</div>
    <div id="regDetailFiles"><div class="reg-empty">กำลังโหลดไฟล์...</div></div>

    <div class="reg-section">Audit Log</div>
    <div id="regDetailAudit"><div class="reg-empty">กำลังโหลด...</div></div>
  `;
  document.getElementById('instrumentDetailModal').classList.add('open');
  loadDetailFiles(d);
  loadDetailAudit(d);
  loadDetailPhotos(d);
}

function closeInstrumentDetail() {
  document.getElementById('instrumentDetailModal').classList.remove('open');
}

async function loadDetailFiles(d) {
  const el = document.getElementById('regDetailFiles');
  if (!el) return;
  try {
    const folder = `cert_${d.id}_${d.id_code}`;
    const { data, error } = await sb.storage.from('certificates').list(folder);
    if (error) throw error;
    const files = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder');
    fileCountCache[d.id] = files.length;
    if (!files.length) { el.innerHTML = '<div class="reg-empty">ยังไม่มีไฟล์</div>'; return; }
    el.innerHTML = files.map(f => {
      const icon = f.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️';
      const size = f.metadata?.size ? Math.round(f.metadata.size / 1024) + ' KB' : '–';
      return `<div class="reg-file-row">
        <div class="reg-row-icon">${icon}</div>
        <div>
          <div class="reg-name" style="font-size:12px;overflow-wrap:anywhere">${escapeHtmlText(f.name)}</div>
          <div class="reg-sub">${escapeHtmlText(size)}</div>
        </div>
        <button class="btn-view" onclick="viewFile('${folder}','${escapeJsSingle(f.name)}')">ดู</button>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="reg-empty" style="color:var(--red)">โหลดไฟล์ไม่สำเร็จ</div>';
  }
}

async function loadDetailAudit(d) {
  const el = document.getElementById('regDetailAudit');
  if (!el) return;
  try {
    const { data, error } = await sb.from('audit_logs')
      .select('created_at,username,action,changes')
      .eq('instrument_id', d.id)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) { el.innerHTML = '<div class="reg-empty">ยังไม่มี Audit Log</div>'; return; }
    el.innerHTML = rows.map(log => {
      const action = String(log.action || '');
      const type = action.includes('ลบ') ? 'del' : action.includes('ไฟล์') ? 'file' : action.includes('เพิ่ม') ? 'add' : 'edit';
      const icon = { del: '🗑️', file: '📎', add: '➕', edit: '✏️' }[type];
      const detail = log.changes
        ? Object.entries(log.changes).map(([field, ch]) => {
            if (ch && typeof ch === 'object') return `${field}: ${ch.from || '–'} → ${ch.to || '–'}`;
            return `${field}: ${ch}`;
          }).join(' · ')
        : 'สร้างรายการเครื่องมือ';
      const when = log.created_at ? new Date(log.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
      return `<div class="reg-audit-row ${type}">
        <div class="reg-row-icon">${icon}</div>
        <div>
          <div class="reg-name" style="font-size:12px">${escapeHtmlText(action || 'กิจกรรม')}</div>
          <div class="reg-sub" style="overflow-wrap:anywhere">${escapeHtmlText(detail)}</div>
          <div class="reg-audit-meta"><span>${escapeHtmlText(log.username || '–')}</span><span>${escapeHtmlText(when)}</span></div>
        </div>
        <span class="reg-sub">${escapeHtmlText(d.id_code || '')}</span>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="reg-empty" style="color:var(--red)">โหลด Audit Log ไม่สำเร็จ</div>';
  }
}

const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFileSelect(e.dataTransfer.files); });

// ====================================================
// ADMIN
// ====================================================
let usersData = [];

async function loadUsers() {
  const { data } = await sb.rpc('admin_list_users', { p_token: currentUser?.token });
  usersData = data || [];
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTable');
  const roleMap = { admin: ['badge-purple','Admin'], editor: ['badge-blue','Editor'], viewer: ['badge-gray','Viewer'], owner: ['badge-amber','Owner'] };
  tbody.innerHTML = usersData.map(u => {
    const [cls, label] = roleMap[u.role] || ['badge-gray', u.role];
    const activeBadge = u.active ? '<span class="badge badge-green">เปิด</span>' : '<span class="badge badge-red">ปิด</span>';
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : '–';
    const isSelf = currentUser?.id === u.id;
    const typesList = (u.instrument_types && u.instrument_types.length > 0)
      ? u.instrument_types.map(t => (typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType({ instrument_type: t }) : t).split(' (')[0]).join(', ')
      : '<span style="color:var(--text3);font-size:12px">ทุกประเภท</span>';
    return `<tr>
      <td><strong>${u.name}</strong></td>
      <td style="font-family:var(--mono);font-size:20px">${u.username}</td>
      <td><span class="badge ${cls}">${label}</span>${u.department ? ` <span style="font-size:11px;color:var(--text3)">${u.department}</span>` : ''}</td>
      <td>${activeBadge}</td>
      <td style="font-size:13px;max-width:220px;white-space:normal;line-height:1.5">${typesList}</td>
      <td>${date}</td>
      <td>
        <button class="btn-view" style="margin-right:6px" onclick="openUserModal('${u.id}')">แก้ไข</button>
        ${!isSelf ? `<button class="btn-del" onclick="deleteUser('${u.id}')">ลบ</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

let editingUserId = null;

async function loadInstrumentTypesForModal(selectedTypes) {
  const container = document.getElementById('uTypesContainer');
  // ดึงประเภทเครื่องมือทั้งหมดจาก allData
  const getType = d => typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
  const types = [...new Set(allData.map(getType).filter(Boolean))].sort();
  if (!types.length) {
    // ถ้ายังไม่มีข้อมูล ดึงจาก Supabase
    const { data } = await sb.from('instruments').select('instrument_type');
    const dbTypes = [...new Set((data||[]).map(getType).filter(Boolean))].sort();
    renderTypeCheckboxes(container, dbTypes, selectedTypes);
  } else {
    renderTypeCheckboxes(container, types, selectedTypes);
  }
}

function renderTypeCheckboxes(container, types, selectedTypes) {
  const selected = (selectedTypes || []).map(t => typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType({ instrument_type: t }) : t);
  container.innerHTML = types.map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 4px;cursor:pointer;font-size:14px;border-radius:6px" 
           onmouseover="this.style.background='var(--accent-light)'" onmouseout="this.style.background=''">
      <input type="checkbox" value="${escapeHtmlAttr(t)}" ${selected.includes(t) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
      <span>${escapeHtmlText(t)}</span>
    </label>
  `).join('');
}

function openUserModal(userId) {
  editingUserId = userId || null;
  document.getElementById('userModalTitle').textContent = userId ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้';
  document.getElementById('uActiveGroup').style.display = userId ? 'block' : 'none';
  if (userId) {
    const u = usersData.find(x => x.id === userId);
    if (!u) return;
    document.getElementById('uName').value = u.name;
    document.getElementById('uUsername').value = u.username;
    document.getElementById('uPassword').value = '';
    document.getElementById('uPasswordHint').textContent = 'เว้นว่างถ้าไม่ต้องการเปลี่ยนรหัสผ่าน';
    document.getElementById('uPasswordLabel').textContent = 'รหัสผ่านใหม่';
    document.getElementById('uRole').value = u.role;
    document.getElementById('uActive').value = String(u.active);
    document.getElementById('uDepartment').value = u.department || '';
  } else {
    document.getElementById('uName').value = '';
    document.getElementById('uUsername').value = '';
    document.getElementById('uPassword').value = '';
    document.getElementById('uPasswordHint').textContent = '';
    document.getElementById('uPasswordLabel').textContent = 'รหัสผ่าน';
    document.getElementById('uRole').value = 'viewer';
    document.getElementById('uDepartment').value = '';
  }
  // ช่องรหัสหน่วยงานโชว์เฉพาะ role owner
  const syncDeptVisible = () => {
    document.getElementById('uDeptGroup').style.display =
      document.getElementById('uRole').value === 'owner' ? 'block' : 'none';
  };
  document.getElementById('uRole').onchange = syncDeptVisible;
  syncDeptVisible();
  document.getElementById('userModal').classList.add('open');
  // โหลด checkboxes ประเภทเครื่องมือ
  const selectedTypes = userId ? (usersData.find(x => x.id === userId)?.instrument_types || []) : [];
  loadInstrumentTypesForModal(selectedTypes);
}

function closeUserModal() { document.getElementById('userModal').classList.remove('open'); editingUserId = null; }

async function saveUser() {
  const name = document.getElementById('uName').value.trim();
  const username = document.getElementById('uUsername').value.trim().toLowerCase();
  const password = document.getElementById('uPassword').value;
  const role = document.getElementById('uRole').value;
  const active = document.getElementById('uActive').value === 'true';
  const department = document.getElementById('uDepartment').value.trim().toUpperCase();

  if (!name || !username) { showToast('กรุณากรอกชื่อและ username', 'error'); return; }
  if (!editingUserId && !password) { showToast('กรุณากรอกรหัสผ่าน', 'error'); return; }
  if (password && password.length < 6) { showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัว', 'error'); return; }
  if (role === 'owner' && !department) { showToast('กรุณากรอกรหัสหน่วยงานของ Owner (เช่น WRM1)', 'error'); return; }

  const btn = document.getElementById('saveUserBtn');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    // เก็บประเภทที่เลือก
    const checkedTypes = [...document.querySelectorAll('#uTypesContainer input[type=checkbox]:checked')].map(el => el.value);
    const passwordHash = password ? await sha256(password) : '';

    const { error } = await sb.rpc('admin_save_user', {
      p_token: currentUser?.token,
      p_id: editingUserId || null,
      p_name: name,
      p_username: username,
      p_role: role,
      p_active: editingUserId ? active : true,
      p_instrument_types: checkedTypes.length > 0 ? checkedTypes : null,
      p_password_hash: passwordHash,
      p_department: role === 'owner' ? department : null
    });
    if (error) throw error;
    await loadUsers();
    closeUserModal();
    showToast('บันทึกสำเร็จ', 'success');
  } catch(e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'บันทึก'; }
}

async function deleteUser(userId) {
  if (!confirm('ต้องการลบผู้ใช้นี้?')) return;
  const { error } = await sb.rpc('admin_delete_user', { p_token: currentUser?.token, p_id: userId });
  if (error) { showToast('ลบไม่สำเร็จ', 'error'); return; }
  await loadUsers();
  showToast('ลบผู้ใช้แล้ว', 'success');
}

// ====================================================
// PAGES
// ====================================================

// ====================================================
// INSTRUMENT CRUD
// ====================================================
let editingInstrumentId = null;

function openInstrumentModal(instrumentId) {
  editingInstrumentId = instrumentId || null;
  clearInstrumentDuplicateWarning();
  document.getElementById('instrumentModalTitle').textContent = instrumentId ? 'แก้ไขเครื่องมือ' : 'เพิ่มเครื่องมือ';

  if (instrumentId) {
    const d = allData.find(x => x.id === instrumentId);
    if (!d) return;

    const categoryEl = document.getElementById('iCategory');
    categoryEl.value = d.instrument_type || '';
    if (!categoryEl.value && typeof getDisplayInstrumentType === 'function') {
      categoryEl.value = getDisplayInstrumentType(d) || '';
    }
    document.getElementById('iName').value = d.instrument_name || '';
    // ข้อมูลเก่าเก็บ "ยี่ห้อ/รุ่น" รวมในช่องเดียว → ถ้ายังไม่มี model แยกให้อัตโนมัติ (บันทึกครั้งถัดไปจะเก็บแยก)
    let _brand = d.brand || '', _model = d.model || '';
    if (!_model && _brand.includes('/')) {
      const _i = _brand.indexOf('/');
      _model = _brand.slice(_i + 1).trim();
      _brand = _brand.slice(0, _i).trim();
    }
    document.getElementById('iBrand').value = _brand;
    document.getElementById('iModel').value = _model;
    setRangeField(d.range_val || '');
    setCapacityField(d.capacity, d.capacity_unit);
    setToleranceFields(d.tolerance || '');
    // resolution_text (จากบัญชีรายการ) มาก่อน · เครื่องเก่าบางตัวมีแต่ resolution ตัวเลข (หน่วย g)
    setBandFields(d.resolution_text || (d.resolution != null && d.resolution !== '' ? d.resolution + ' g' : ''), RES_IDS, 'iResUnit');
    setBandFields(d.usage_min || '', USE_MIN_IDS, 'iUsageMinUnit');
    setBandFields(d.usage_max || '', USE_MAX_IDS, 'iUsageMaxUnit');
    document.getElementById('iUsageFreq').value = d.usage_frequency || '';
    document.getElementById('iProductGroup').value = d.product_group || '';
    document.getElementById('iUspType').value = d.usp_type || '';
    document.getElementById('iBalanceType').value = d.balance_type || '';
    document.getElementById('iMachineName').value = d.machine_name || '';
    document.getElementById('iLocation').value = d.location || '';
    document.getElementById('iCalFrequency').value = d.cal_frequency || '';
    document.getElementById('iCalType').value = d.cal_type || '';
    document.getElementById('iRemark').value = d.remark || '';
    document.getElementById('iSerial').value = d.serial_no || '';
    document.getElementById('iAssetNo').value = d.asset_no || '';
    document.getElementById('iDept').value = d.department || '';
    document.getElementById('iDivision').value = d.division || '';
    document.getElementById('iCostCenter').value = d.cost_center || '';
    document.getElementById('iIdCode').value = d.id_code || '';
    document.getElementById('iCertNo').value = d.cert_no || '';
    document.getElementById('iCalDate').value = d.cal_date || '';
    document.getElementById('iDueDate').value = d.due_date || '';
    document.getElementById('iPrevCertNo').value = d.prev_cert_no || '–';
    document.getElementById('iPrevCalDate').value = d.prev_cal_date || '';
  } else {
    ['iCategory','iName','iBrand','iModel','iSerial','iAssetNo','iDept','iDivision','iCostCenter','iIdCode','iCertNo','iCalDate','iDueDate','iMachineName','iLocation','iCalFrequency','iCalType','iRemark',
     'iUsageFreq','iProductGroup','iUspType','iBalanceType']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    setRangeField('');
    setCapacityField('');
    setToleranceFields('');
    setBandFields('', RES_IDS, 'iResUnit');
    setBandFields('', USE_MIN_IDS, 'iUsageMinUnit');
    setBandFields('', USE_MAX_IDS, 'iUsageMaxUnit');
  }
  if (typeof updateDeptUnitHint === 'function') updateDeptUnitHint();
  document.getElementById('instrumentModal').classList.add('open');
  initInstrumentDuplicateCheck();
  checkInstrumentDuplicates(false);
}

// ===== ค่าแบบหลายช่วง (สูงสุด 3) + หน่วย SI — ใช้ร่วมกัน Tolerance / ใช้งานต่ำสุด / ใช้งานสูงสุด =====
// เก็บเป็นสตริงเดียวในคอลัมน์เดิม: ต่อหน่วยไว้ท้ายทุกค่า คั่นด้วย " / " เช่น "0.1 g / 0.2 g" หรือ "150 kg / >800 kg"
// (ต่อหน่วยทุกค่าเพื่อให้ตัว parse ฝั่ง cal engine — regSplitBands/regToGrams — แปลงหน่วยถูกทุกช่วง)
function parseBandStr(str) {
  const s = String(str || '').trim().replace(/^±\s*/, '');
  if (!s) return { vals: ['', '', ''], unit: 'g' };
  let unit = '';
  const vals = [];
  s.split('/').map(x => x.trim().replace(/^±\s*/, '')).filter(Boolean).forEach(p => {
    // รองรับตัวเปรียบเทียบนำหน้า เช่น ">800 kg" → ค่า ">800" หน่วย "kg"
    const m = p.match(/^([<>≤≥]?\s*-?[\d.]+)\s*(.*)$/);
    if (m) { vals.push(m[1].replace(/\s+/g, '')); if (m[2]) unit = m[2].trim(); }
    else { vals.push(p); }
  });
  while (vals.length < 3) vals.push('');
  return { vals: vals.slice(0, 3), unit: unit || 'g' };
}
// dropdown หน่วยของ usage ใช้รายการเดียวกับ Tolerance — clone จาก iTolUnit ครั้งแรกที่ใช้
function ensureUnitOptions(sel) {
  if (!sel || sel.options.length) return;
  const src = document.getElementById('iTolUnit');
  if (src) sel.innerHTML = src.innerHTML;
}
function setBandFields(str, ids, unitId) {
  const p = parseBandStr(str);
  ids.forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = p.vals[i] || ''; });
  const sel = document.getElementById(unitId);
  if (sel) {
    ensureUnitOptions(sel);
    // ถ้าหน่วยที่เก็บไว้ไม่มีใน dropdown (เช่นจากไฟล์ import) ให้เพิ่ม option ชั่วคราวเพื่อแสดงค่าเดิม
    if (p.unit && !Array.from(sel.options).some(o => o.value === p.unit)) {
      sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtmlText(p.unit)}">${escapeHtmlText(p.unit)}</option>`);
    }
    sel.value = p.unit || 'g';
  }
}
function buildBandStr(ids, unitId) {
  const unit = (document.getElementById(unitId) || {}).value || '';
  const u = unit ? ' ' + unit : '';
  const vals = ids
    .map(id => ((document.getElementById(id) || {}).value || '').trim())
    .filter(Boolean);
  if (!vals.length) return null;
  return vals.map(v => v + u).join(' / ');
}
const TOL_IDS = ['iTol1', 'iTol2', 'iTol3'], USE_MIN_IDS = ['iUsageMin1', 'iUsageMin2', 'iUsageMin3'], USE_MAX_IDS = ['iUsageMax1', 'iUsageMax2', 'iUsageMax3'], RES_IDS = ['iRes1', 'iRes2', 'iRes3'];
function setToleranceFields(str) { setBandFields(str, TOL_IDS, 'iTolUnit'); }
function buildToleranceStr() { return buildBandStr(TOL_IDS, 'iTolUnit'); }

// ===== พิกัด Max + ย่านการวัด (range_val — ข้อความ+หน่วยต่อท้าย) =====
// หน่วยมวล (g/kg/mg/µg): DB เก็บกรัมเสมอ (capacity_unit = null) — cal engine เครื่องชั่งอ่านเป็นกรัม
// หน่วยอื่น (kgf.cm, °C, bar, ...): เก็บตัวเลขตามที่กรอก + หน่วยใน capacity_unit
const CAP_UNIT_G = { g: 1, kg: 1000, mg: 0.001, 'µg': 0.000001 };
// โหลด: มวล ≥1000 g แสดงเป็น kg ให้อ่านง่ายแบบบัญชีรายการ (30000 → 30 kg)
function setCapacityField(capacity, capacityUnit) {
  const inp = document.getElementById('iCapacity'), sel = document.getElementById('iCapacityUnit');
  if (!inp || !sel) return;
  ensureUnitOptions(sel);
  const v = parseFloat(capacity);
  if (!Number.isFinite(v)) { inp.value = ''; sel.value = 'g'; return; }
  const u = String(capacityUnit || '').trim();
  if (u && !CAP_UNIT_G[u]) {
    // หน่วยไม่ใช่มวล — แสดงตามที่เก็บ (เพิ่ม option ชั่วคราวถ้าไม่มีในลิสต์)
    if (!Array.from(sel.options).some(o => o.value === u)) {
      sel.insertAdjacentHTML('beforeend', `<option value="${escapeHtmlText(u)}">${escapeHtmlText(u)}</option>`);
    }
    inp.value = v; sel.value = u;
    return;
  }
  if (v >= 1000) { inp.value = +(v / 1000).toFixed(6); sel.value = 'kg'; }
  else { inp.value = v; sel.value = 'g'; }
}
function buildCapacityG() {
  const v = parseFloat((document.getElementById('iCapacity') || {}).value);
  if (!Number.isFinite(v)) return null;
  const u = (document.getElementById('iCapacityUnit') || {}).value;
  if (!CAP_UNIT_G[u]) return v;                 // หน่วยไม่ใช่มวล — เก็บตัวเลขตรง ๆ
  return v * (CAP_UNIT_G[u] || 1);
}
function buildCapacityUnit() {
  const v = parseFloat((document.getElementById('iCapacity') || {}).value);
  if (!Number.isFinite(v)) return null;
  const u = (document.getElementById('iCapacityUnit') || {}).value;
  return CAP_UNIT_G[u] ? null : (u || null);    // มวล → null (สื่อว่าเป็นกรัม)
}
// Range: แยกหน่วยท้ายข้อความเข้า dropdown ("0 - 30 kg" → "0 - 30" + kg) · หน่วยไม่รู้จักคงไว้ในข้อความ
function setRangeField(str) {
  const inp = document.getElementById('iRange'), sel = document.getElementById('iRangeUnit');
  if (!inp || !sel) return;
  ensureUnitOptions(sel);
  const s = String(str || '').trim();
  const m = s.match(/^(.*?)\s*([^\s\d.\-–()]+)$/);
  const opt = m ? Array.from(sel.options).find(o => o.value.toLowerCase() === m[2].toLowerCase()) : null;
  if (opt) { inp.value = m[1].trim(); sel.value = opt.value; }
  else { inp.value = s; sel.value = 'g'; }
}
function buildRangeVal() {
  const t = ((document.getElementById('iRange') || {}).value || '').trim();
  if (!t) return '';
  if (/[^\s\d.\-–()]$/.test(t)) return t;   // ลงท้ายด้วยตัวอักษร = มีหน่วยติดมาแล้ว ไม่เติมซ้ำ
  const u = (document.getElementById('iRangeUnit') || {}).value || '';
  return u ? t + ' ' + u : t;
}

function closeInstrumentModal() {
  document.getElementById('instrumentModal').classList.remove('open');
  editingInstrumentId = null;
  clearInstrumentDuplicateWarning();
}

let lastInstrumentDuplicateToastKey = '';

function normalizeInstrumentDuplicateValue(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInstrumentDuplicateMatches(idCode, certNo) {
  const idValue = normalizeInstrumentDuplicateValue(idCode);
  const certValue = normalizeInstrumentDuplicateValue(certNo);
  const currentId = editingInstrumentId ? String(editingInstrumentId) : null;
  const matches = [];

  (allData || []).forEach(d => {
    if (currentId && String(d.id) === currentId) return;
    const fields = [];
    if (idValue && normalizeInstrumentDuplicateValue(d.id_code) === idValue) fields.push('ID Code');
    if (certValue && normalizeInstrumentDuplicateValue(d.cert_no) === certValue) fields.push('CERT.');
    if (fields.length) matches.push({ instrument: d, fields });
  });

  return matches;
}

async function getInstrumentDuplicateMatchesFromDb(idCode, certNo) {
  const currentId = editingInstrumentId ? String(editingInstrumentId) : null;
  const rowsById = new Map();
  const fieldsById = new Map();
  const cols = 'id,instrument_type,instrument_name,brand,serial_no,department,id_code,cert_no';

  const collectRows = (rows, fieldLabel) => {
    (rows || []).forEach(d => {
      if (currentId && String(d.id) === currentId) return;
      rowsById.set(String(d.id), d);
      const fields = fieldsById.get(String(d.id)) || [];
      if (!fields.includes(fieldLabel)) fields.push(fieldLabel);
      fieldsById.set(String(d.id), fields);
    });
  };

  if (idCode) {
    const { data, error } = await sb.from('instruments').select(cols).eq('id_code', idCode);
    if (error) throw error;
    collectRows(data, 'ID Code');
  }

  if (certNo) {
    const { data, error } = await sb.from('instruments').select(cols).eq('cert_no', certNo);
    if (error) throw error;
    collectRows(data, 'CERT.');
  }

  return [...rowsById.entries()].map(([id, instrument]) => ({
    instrument,
    fields: fieldsById.get(id) || [],
  }));
}

function clearInstrumentDuplicateWarning() {
  const box = document.getElementById('instrumentDuplicateWarning');
  if (box) {
    box.style.display = 'none';
    box.innerHTML = '';
  }
  lastInstrumentDuplicateToastKey = '';
}

function renderInstrumentDuplicateWarning(matches) {
  const box = document.getElementById('instrumentDuplicateWarning');
  if (!box) return;
  if (!matches.length) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  box.style.display = 'block';
  box.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px">พบข้อมูลซ้ำ กรุณาตรวจสอบก่อนบันทึก</div>
    ${matches.map(({ instrument: d, fields }) => `
      <div style="background:#fff;border:1px solid #F3B7B7;border-radius:8px;padding:8px 10px;margin-top:7px">
        <div style="font-weight:700;color:#7A1818">${fields.join(' และ ')} ซ้ำกับรายการที่มีอยู่แล้ว</div>
        <div style="margin-top:4px;color:#5F1E1E">
          <strong>${escapeHtml(d.instrument_name || '–')}</strong>
          <span style="color:#8A5A5A"> · ${escapeHtml(d.department || '–')} · ${escapeHtml(d.instrument_type || '–')}</span>
        </div>
        <div style="margin-top:3px;font-family:var(--mono);font-size:12px;color:#7A1818">
          ID: ${escapeHtml(d.id_code || '–')} · CERT: ${escapeHtml(d.cert_no || '–')} · S/N: ${escapeHtml(d.serial_no || '–')}
        </div>
      </div>
    `).join('')}
  `;
}

function checkInstrumentDuplicates(showToastOnDuplicate = false) {
  const idCode = document.getElementById('iIdCode')?.value || '';
  const certNo = document.getElementById('iCertNo')?.value || '';
  const matches = getInstrumentDuplicateMatches(idCode, certNo);
  renderInstrumentDuplicateWarning(matches);

  if (showToastOnDuplicate && matches.length) {
    const toastKey = matches.map(m => `${m.instrument.id}:${m.fields.join('+')}`).join('|');
    if (toastKey && toastKey !== lastInstrumentDuplicateToastKey) {
      showToast('พบข้อมูลซ้ำ: ' + matches.map(m => m.fields.join('/')).join(', '), 'error');
      lastInstrumentDuplicateToastKey = toastKey;
    }
  } else if (!matches.length) {
    lastInstrumentDuplicateToastKey = '';
  }

  return matches;
}

function initInstrumentDuplicateCheck() {
  const idInput = document.getElementById('iIdCode');
  const certInput = document.getElementById('iCertNo');
  if (idInput && !idInput.dataset.duplicateCheckReady) {
    idInput.addEventListener('input', () => checkInstrumentDuplicates(true));
    idInput.dataset.duplicateCheckReady = 'true';
  }
  if (certInput && !certInput.dataset.duplicateCheckReady) {
    certInput.addEventListener('input', () => checkInstrumentDuplicates(true));
    certInput.dataset.duplicateCheckReady = 'true';
  }
}

async function saveInstrument() {
  const payload = {
    instrument_type: document.getElementById('iCategory').value || null,
    category: document.getElementById('iCategory').value || null,
    instrument_name: document.getElementById('iName').value.trim(),
    brand: document.getElementById('iBrand').value.trim(),
    model: document.getElementById('iModel').value.trim() || null,
    range_val: buildRangeVal(),
    capacity: buildCapacityG(),
    capacity_unit: buildCapacityUnit(),
    tolerance: buildToleranceStr(),
    resolution_text: buildBandStr(RES_IDS, 'iResUnit'),
    usage_min: buildBandStr(USE_MIN_IDS, 'iUsageMinUnit'),
    usage_max: buildBandStr(USE_MAX_IDS, 'iUsageMaxUnit'),
    usage_frequency: document.getElementById('iUsageFreq').value.trim() || null,
    product_group: document.getElementById('iProductGroup').value.trim() || null,
    usp_type: document.getElementById('iUspType').value.trim() || null,
    balance_type: document.getElementById('iBalanceType').value || null,
    serial_no: document.getElementById('iSerial').value.trim(),
    asset_no: document.getElementById('iAssetNo').value.trim() || null,
    department: document.getElementById('iDept').value.trim(),
    division: document.getElementById('iDivision').value.trim() || null,
    cost_center: document.getElementById('iCostCenter').value.trim() || null,
    id_code: document.getElementById('iIdCode').value.trim(),
    cert_no: document.getElementById('iCertNo').value.trim(),
    cal_date: document.getElementById('iCalDate').value || null,
    due_date: document.getElementById('iDueDate').value || null,
    machine_name: document.getElementById('iMachineName').value.trim() || null,
    location: document.getElementById('iLocation').value.trim() || null,
    cal_frequency: document.getElementById('iCalFrequency').value.trim() || null,
    cal_type: document.getElementById('iCalType').value || null,
    remark: document.getElementById('iRemark').value.trim() || null,
    cal_status: document.getElementById('iCalStatus')?.value === 'cancelled' ? 'cancelled' : 'active',
  };
  // หมายเหตุ: range_profile / tolerance_bands ไม่อยู่ใน payload แล้ว (ถอด UI ตารางออก 2026-07)
  // — save จะไม่แตะคอลัมน์เหล่านี้ ค่าเดิมของเครื่อง multi-range ใน DB คงอยู่ให้ balance-cal ใช้ต่อ

  if (!payload.id_code) { showToast('กรุณากรอก ID Code', 'error'); return; }

  const duplicateMatches = checkInstrumentDuplicates(false);
  if (duplicateMatches.length) {
    showToast('บันทึกไม่ได้: พบ ID Code หรือ CERT. ซ้ำกับข้อมูลที่มีอยู่แล้ว', 'error');
    return;
  }

  try {
    const dbDuplicateMatches = await getInstrumentDuplicateMatchesFromDb(payload.id_code, payload.cert_no);
    if (dbDuplicateMatches.length) {
      renderInstrumentDuplicateWarning(dbDuplicateMatches);
      showToast('บันทึกไม่ได้: พบ ID Code หรือ CERT. ซ้ำกับข้อมูลล่าสุดในระบบ', 'error');
      return;
    }
  } catch(e) {
    showToast('ตรวจสอบข้อมูลซ้ำไม่สำเร็จ: ' + e.message, 'error');
    return;
  }

  const btn = document.getElementById('saveInstrumentBtn');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    if (editingInstrumentId) {
      const original = allData.find(x => x.id === editingInstrumentId);
      // ถ้า cert หรือวันสอบเปลี่ยน → save prev + บันทึกลง history
      if (original) {
        const certChanged = original.cert_no && original.cert_no !== payload.cert_no;
        const dateChanged = original.cal_date && original.cal_date !== payload.cal_date;
        if (certChanged || dateChanged) {
          payload.prev_cert_no = original.cert_no || null;
          payload.prev_cal_date = original.cal_date || null;
          await sb.from('calibration_history').insert({
            instrument_id: editingInstrumentId,
            cert_no: original.cert_no || null,
            cal_date: original.cal_date || null,
            due_date: original.due_date || null,
          });
        }
      }
      const { error } = await sb.from('instruments').update(payload).eq('id', editingInstrumentId);
      if (error) throw error;
      const diff = original ? getDiff(original, {...original, ...payload}) : null;
      await logAudit('แก้ไข', {...payload, id: editingInstrumentId}, diff);
      showToast('แก้ไขเครื่องมือแล้ว', 'success');
    } else {
      const { data: inserted, error } = await sb.from('instruments').insert(payload).select().single();
      if (error) throw error;
      await logAudit('เพิ่ม', inserted, null);
      showToast('เพิ่มเครื่องมือแล้ว', 'success');
    }
    const highlightCode = payload.id_code || '';
    closeInstrumentModal();
    await loadData(true);
    // scroll ไปหาแถวที่แก้ไข/เพิ่ม
    if (highlightCode) {
      setTimeout(() => {
        const rows = document.querySelectorAll('#dataTable tr');
        rows.forEach(row => {
          if (row.textContent.includes(highlightCode)) {
            row.style.background = '#e0f4f1';
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { row.style.background = ''; }, 2500);
          }
        });
      }, 800);
    }
  } catch(e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'บันทึก'; }
}

async function deleteInstrument(id, name) {
  if (!confirm(`ต้องการลบ "${name}" ออกจากระบบ?`)) return;
  try {
    const instrument = allData.find(x => x.id === id);
    const { error } = await sb.from('instruments').delete().eq('id', id);
    if (error) throw error;
    await logAudit('ลบ', instrument || {id, instrument_name: name, id_code: ''}, null);
    showToast('ลบเครื่องมือแล้ว', 'success');
    await loadData(true);
  } catch(e) { showToast('ลบไม่สำเร็จ: ' + e.message, 'error'); }
}

function toggleManageColumns(show) {
  document.getElementById('btnAddInstrument').style.display = show ? 'flex' : 'none';
  document.getElementById('thManage').style.display = show ? '' : 'none';
  const btnImp = document.getElementById('btnImportExcel');
  if (btnImp) btnImp.style.display = show ? 'flex' : 'none';
}


// ====================================================
