/* ===== 22-users.js ===== ผู้ใช้และสิทธิ์ (หน้า ADMIN — แยกจาก 03-instruments.js) */
// ขอบเขต: ตารางผู้ใช้ + modal เพิ่ม/แก้/ลบ ผ่าน RPC admin_* (admin_list_users / admin_save_user / admin_delete_user)
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
