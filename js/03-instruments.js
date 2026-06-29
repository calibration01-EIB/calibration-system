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
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (!/^image\//.test(f.type || '')) { showToast('รับเฉพาะไฟล์รูปภาพ', 'error'); return; }
    const folder = instPhotoFolder(d);
    try {
      showLoading('กำลังอัพโหลดรูป...');
      const { data: cur } = await sb.storage.from('certificates').list(folder);
      const n = (cur || []).filter(x => x.name !== '.emptyFolderPlaceholder' && /\.(jpe?g|png|webp|gif)$/i.test(x.name)).length;
      if (n >= INST_PHOTO_MAX) { showToast(`รูปครบ ${INST_PHOTO_MAX} แล้ว — ลบก่อนถ้าจะเพิ่ม`, 'error'); return; }
      if (f.size > 5 * 1024 * 1024) showToast('ไฟล์ใหญ่กว่า 5MB — แนะนำย่อก่อน', 'info');
      const safe = f.name.replace(/[^\w.\-]/g, '_');
      const { error } = await sb.storage.from('certificates').upload(`${folder}/${Date.now()}_${safe}`, f, { upsert: true, contentType: f.type });
      if (error) throw error;
      showToast('อัพโหลดรูปแล้ว', 'success');
      await loadDetailPhotos(d);
    } catch (e) { showToast('อัพโหลดไม่สำเร็จ: ' + (e.message || ''), 'error'); }
    finally { hideLoading(); }
  };
  inp.click();
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
  const inst = {
    from: 'รายการเครื่องมือ',
    instrument_id: Number(d.id) || null,
    name: d.instrument_name || '', name_th: '',
    id_code: d.id_code || '', asset: d.asset_no || '',
    manufacturer: d.brand || '', model: d.model || '', serial: d.serial_no || '',
    capacity: d.capacity ?? '', resolution: d.resolution ?? '', accuracy_class: d.accuracy_class || '',
    user_range: d.range_val || '', cal_type: d.cal_type || '', tolerance: d.tolerance || '', range_profile: d.range_profile || null,
    section: d.department || '', unit_dept: d.department || '', location: d.location || '',
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
      ${regDetailItem('ชื่อเครื่องจักร', d.machine_name)}
      ${regDetailItem('ยี่ห้อ / รุ่น', d.brand)}
      ${regDetailItem('รุ่น (Model)', d.model)}
      ${regDetailItem('พิกัด Max (g)', d.capacity)}
      ${regDetailItem('ความละเอียด d (g)', d.resolution)}
      ${regDetailItem('Accuracy Class', d.accuracy_class)}
      ${regDetailItem('สถานที่ใช้งาน', d.location)}
      ${regDetailItem('Range', d.range_val)}
      ${regDetailItem('Tolerance (±)', d.tolerance)}
      ${Array.isArray(d.range_profile) && d.range_profile.length
        ? regDetailItem('ช่วง d / Tolerance (Multi-interval)', d.range_profile.map((s, i, a) => {
            const from = i === 0 ? 0 : a[i-1].to;
            return `${from}–${s.to} g: d ${s.d ?? '–'} g, tol ${s.tol != null ? '±' + s.tol + ' ' + (s.unit || 'g') : '–'}`;
          }).join('  ·  '), true)
        : ''}
      ${regDetailItem('Serial No.', d.serial_no)}
      ${regDetailItem('Asset No.', d.asset_no)}
      ${regDetailItem('หน่วยงาน', d.department)}
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
  const { data } = await sb.from('users').select('*').order('created_at');
  usersData = data || [];
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTable');
  const roleMap = { admin: ['badge-purple','Admin'], editor: ['badge-blue','Editor'], viewer: ['badge-gray','Viewer'] };
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
      <td><span class="badge ${cls}">${label}</span></td>
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
  } else {
    document.getElementById('uName').value = '';
    document.getElementById('uUsername').value = '';
    document.getElementById('uPassword').value = '';
    document.getElementById('uPasswordHint').textContent = '';
    document.getElementById('uPasswordLabel').textContent = 'รหัสผ่าน';
    document.getElementById('uRole').value = 'viewer';
  }
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

  if (!name || !username) { showToast('กรุณากรอกชื่อและ username', 'error'); return; }
  if (!editingUserId && !password) { showToast('กรุณากรอกรหัสผ่าน', 'error'); return; }
  if (password && password.length < 6) { showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัว', 'error'); return; }

  const btn = document.getElementById('saveUserBtn');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  try {
    // เก็บประเภทที่เลือก
    const checkedTypes = [...document.querySelectorAll('#uTypesContainer input[type=checkbox]:checked')].map(el => el.value);
    const payload = { name, username, role, active, instrument_types: checkedTypes.length > 0 ? checkedTypes : null };
    if (password) payload.password = await sha256(password);

    if (editingUserId) {
      const { error } = await sb.from('users').update(payload).eq('id', editingUserId);
      if (error) throw error;
    } else {
      const { error } = await sb.from('users').insert({ ...payload, active: true });
      if (error) throw error;
    }
    await loadUsers();
    closeUserModal();
    showToast('บันทึกสำเร็จ', 'success');
  } catch(e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'บันทึก'; }
}

async function deleteUser(userId) {
  if (!confirm('ต้องการลบผู้ใช้นี้?')) return;
  const { error } = await sb.from('users').delete().eq('id', userId);
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
    document.getElementById('iBrand').value = d.brand || '';
    document.getElementById('iRange').value = d.range_val || '';
    document.getElementById('iTolerance').value = d.tolerance || '';
    document.getElementById('iMachineName').value = d.machine_name || '';
    document.getElementById('iLocation').value = d.location || '';
    document.getElementById('iCalFrequency').value = d.cal_frequency || '';
    document.getElementById('iCalType').value = d.cal_type || '';
    document.getElementById('iRemark').value = d.remark || '';
    document.getElementById('iSerial').value = d.serial_no || '';
    document.getElementById('iAssetNo').value = d.asset_no || '';
    document.getElementById('iDept').value = d.department || '';
    document.getElementById('iIdCode').value = d.id_code || '';
    document.getElementById('iCertNo').value = d.cert_no || '';
    document.getElementById('iCalDate').value = d.cal_date || '';
    document.getElementById('iDueDate').value = d.due_date || '';
    document.getElementById('iPrevCertNo').value = d.prev_cert_no || '–';
    document.getElementById('iPrevCalDate').value = d.prev_cal_date || '';
    instRange = Array.isArray(d.range_profile) ? d.range_profile.map(s => ({ to: s.to, d: s.d, tol: s.tol, unit: s.unit || 'g' })) : [];
    renderInstRangeRows();
  } else {
    ['iCategory','iName','iBrand','iRange','iTolerance','iSerial','iAssetNo','iDept','iIdCode','iCertNo','iCalDate','iDueDate','iMachineName','iLocation','iCalFrequency','iCalType','iRemark']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    instRange = []; renderInstRangeRows();
  }
  document.getElementById('instrumentModal').classList.add('open');
  initInstrumentDuplicateCheck();
  checkInstrumentDuplicates(false);
}

// ===== Multi-interval range_profile entry (ในฟอร์มเพิ่ม/แก้เครื่องมือ) =====
let instRange = [];
function renderInstRangeRows() {
  const tb = document.getElementById('iRangeRows'); if (!tb) return;
  const inp = 'width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-family:var(--font)';
  const unitOpts = (u) => ['g','kg','mg'].map(x => `<option value="${x}" ${(u||'g')===x?'selected':''}>${x}</option>`).join('');
  tb.innerHTML = instRange.map((s, i) => `<tr>
    <td style="padding:2px 6px"><input type="number" step="any" value="${s.to ?? ''}" style="${inp}"></td>
    <td style="padding:2px 6px"><input type="number" step="any" value="${s.d ?? ''}" style="${inp}"></td>
    <td style="padding:2px 6px"><input type="number" step="any" value="${s.tol ?? ''}" style="${inp}"></td>
    <td style="padding:2px 6px"><select style="${inp}">${unitOpts(s.unit)}</select></td>
    <td style="text-align:center"><button type="button" onclick="removeInstRangeRow(${i})" style="border:none;background:none;color:#c0392b;cursor:pointer;font-size:16px">✕</button></td>
  </tr>`).join('');
}
function readInstRangeFromDom() {
  return [...document.querySelectorAll('#iRangeRows tr')].map(tr => {
    const ins = tr.querySelectorAll('input');
    const sel = tr.querySelector('select');
    return { to: ins[0].value, d: ins[1].value, tol: ins[2].value, unit: sel ? sel.value : 'g' };
  });
}
function addInstRangeRow() { instRange = readInstRangeFromDom(); instRange.push({ to: '', d: '', tol: '', unit: 'g' }); renderInstRangeRows(); }
function removeInstRangeRow(i) { instRange = readInstRangeFromDom(); instRange.splice(i, 1); renderInstRangeRows(); }
// อ่านตาราง → range_profile [{to,d,tol,unit}] (เรียงตาม to · ข้ามแถวที่ to ว่าง) · ว่าง → null
function buildRangeProfileFromForm() {
  const rp = readInstRangeFromDom().map(s => ({
    to: parseFloat(s.to),
    d: (s.d !== '' && s.d != null) ? parseFloat(s.d) : null,
    tol: (s.tol !== '' && s.tol != null) ? parseFloat(s.tol) : null,
    unit: s.unit || 'g',
  })).filter(s => Number.isFinite(s.to) && s.to > 0).sort((a, b) => a.to - b.to);
  return rp.length ? rp : null;
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
    range_val: document.getElementById('iRange').value.trim(),
    tolerance: document.getElementById('iTolerance').value.trim() || null,
    serial_no: document.getElementById('iSerial').value.trim(),
    asset_no: document.getElementById('iAssetNo').value.trim() || null,
    department: document.getElementById('iDept').value.trim(),
    id_code: document.getElementById('iIdCode').value.trim(),
    cert_no: document.getElementById('iCertNo').value.trim(),
    cal_date: document.getElementById('iCalDate').value || null,
    due_date: document.getElementById('iDueDate').value || null,
    machine_name: document.getElementById('iMachineName').value.trim() || null,
    location: document.getElementById('iLocation').value.trim() || null,
    cal_frequency: document.getElementById('iCalFrequency').value.trim() || null,
    cal_type: document.getElementById('iCalType').value || null,
    remark: document.getElementById('iRemark').value.trim() || null,
    range_profile: buildRangeProfileFromForm(),
  };

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
