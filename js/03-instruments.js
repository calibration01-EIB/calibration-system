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
      ? u.instrument_types.map(t => t.split(' (')[0]).join(', ')
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
  const types = [...new Set(allData.map(d => d.instrument_type).filter(Boolean))].sort();
  if (!types.length) {
    // ถ้ายังไม่มีข้อมูล ดึงจาก Supabase
    const { data } = await sb.from('instruments').select('instrument_type');
    const dbTypes = [...new Set((data||[]).map(d => d.instrument_type).filter(Boolean))].sort();
    renderTypeCheckboxes(container, dbTypes, selectedTypes);
  } else {
    renderTypeCheckboxes(container, types, selectedTypes);
  }
}

function renderTypeCheckboxes(container, types, selectedTypes) {
  const selected = selectedTypes || [];
  container.innerHTML = types.map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 4px;cursor:pointer;font-size:14px;border-radius:6px" 
           onmouseover="this.style.background='var(--accent-light)'" onmouseout="this.style.background=''">
      <input type="checkbox" value="${t}" ${selected.includes(t) ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
      <span>${t}</span>
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
  document.getElementById('instrumentModalTitle').textContent = instrumentId ? 'แก้ไขเครื่องมือ' : 'เพิ่มเครื่องมือ';

  if (instrumentId) {
    const d = allData.find(x => x.id === instrumentId);
    if (!d) return;

    document.getElementById('iCategory').value = d.instrument_type || '';
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
    document.getElementById('iDept').value = d.department || '';
    document.getElementById('iIdCode').value = d.id_code || '';
    document.getElementById('iCertNo').value = d.cert_no || '';
    document.getElementById('iCalDate').value = d.cal_date || '';
    document.getElementById('iDueDate').value = d.due_date || '';
    document.getElementById('iPrevCertNo').value = d.prev_cert_no || '–';
    document.getElementById('iPrevCalDate').value = d.prev_cal_date || '';
  } else {
    ['iCategory','iName','iBrand','iRange','iTolerance','iSerial','iDept','iIdCode','iCertNo','iCalDate','iDueDate','iMachineName','iLocation','iCalFrequency','iCalType','iRemark']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  }
  document.getElementById('instrumentModal').classList.add('open');
}

function closeInstrumentModal() {
  document.getElementById('instrumentModal').classList.remove('open');
  editingInstrumentId = null;
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
  };

  if (!payload.id_code) { showToast('กรุณากรอก ID Code', 'error'); return; }

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
    await loadData();
  } catch(e) { showToast('ลบไม่สำเร็จ: ' + e.message, 'error'); }
}

function toggleManageColumns(show) {
  document.getElementById('btnAddInstrument').style.display = show ? 'flex' : 'none';
  document.getElementById('thManage').style.display = show ? '' : 'none';
  const btnImp = document.getElementById('btnImportExcel');
  if (btnImp) btnImp.style.display = show ? 'flex' : 'none';
}


// ====================================================
