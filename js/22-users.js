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

/* ===== จัดการผู้ใช้ (ดีไซน์ Calibration App) =====
   ตาราง users ไม่มีคอลัมน์ ตำแหน่ง / เข้าใช้งานล่าสุด ที่ดีไซน์มี
   จึงใช้ "ขอบเขตข้อมูล" (instrument_types) ซึ่งเป็นของจริงและมีความหมายกว่าแทน */

const USER_ROLES = [
  { id: 'admin',  name: 'ผู้ดูแลระบบ', en: 'Admin',  emoji: '🛡️', color: '#6d28d9', tint: '#ede9fe', bd: '#ddd6fe', bg: '#faf9ff',
    desc: 'ดูแลระบบทั้งหมด อนุมัติเลข Cert อนุมัติแผนสอบเทียบ และจัดการบัญชีผู้ใช้',
    rights: ['อนุมัติทุกอย่าง', 'จัดการผู้ใช้', 'ดู Audit Log'], scope: 'ทุกหน่วยงาน ทุกประเภทเครื่องมือ' },
  { id: 'editor', name: 'ผู้บันทึกข้อมูล', en: 'Editor', emoji: '✏️', color: '#185fa5', tint: '#e6f1fb', bd: '#cfe1f4', bg: '#f8fbfe',
    desc: 'เพิ่ม/แก้ไขเครื่องมือ ออกเลข Cert แนบไฟล์ใบรับรอง สร้างแผน และแจ้งซ่อม',
    rights: ['แก้ไขข้อมูล', 'ออกเลข Cert', 'แนบไฟล์'], scope: 'ตามประเภทเครื่องมือที่กำหนดให้' },
  { id: 'viewer', name: 'ผู้ดูข้อมูล', en: 'Viewer', emoji: '👁️', color: '#5b7186', tint: '#eef2f6', bd: '#e2e8ef', bg: '#fbfcfd',
    desc: 'ดูข้อมูลและรายงานได้อย่างเดียว แก้ไขหรือแนบไฟล์ไม่ได้',
    rights: ['ดูรายการ', 'ดูรายงาน'], scope: 'อ่านอย่างเดียว' },
  { id: 'owner',  name: 'เจ้าของเครื่องมือ', en: 'Owner', emoji: '🏭', color: '#b45309', tint: '#fdf3dd', bd: '#f3e0b6', bg: '#fffcf6',
    desc: 'รับทราบแผนสอบเทียบของหน่วยงานตนเอง และติดตามสถานะเครื่องมือในหน่วยงาน',
    rights: ['รับทราบแผน', 'ดูเครื่องในหน่วยงาน'], scope: 'เฉพาะหน่วยงานของตน (unit code)' },
];
function userRoleMeta(role) {
  return USER_ROLES.find(r => r.id === role) || { name: role || '–', en: role || '', emoji: '👤', color: '#5b7186', tint: '#eef2f6' };
}

/* สรุปอ้างอิงจากเงื่อนไขสิทธิ์ที่มีอยู่จริงในโค้ด (admin / editor / viewer / owner) */
const USER_PERMS = [
  ['g', 'รายการเครื่องมือ'],
  ['r', 'ดูรายการ ค้นหา และรายงาน',            ['full', 'full', 'full', 'part']],
  ['r', 'เพิ่ม / แก้ไขเครื่องมือ',              ['full', 'full', 'none', 'none']],
  ['r', 'ลบเครื่องมือ',                        ['full', 'full', 'none', 'none']],
  ['r', 'แนบไฟล์ใบรับรอง',                     ['full', 'full', 'none', 'none']],
  ['g', 'ใบรับรอง / สอบเทียบ'],
  ['r', 'ออกเลขลำดับ Cert',                    ['full', 'full', 'none', 'none']],
  ['r', 'อนุมัติเลข Cert',                     ['full', 'none', 'none', 'none']],
  ['r', 'แนบสแกนใบรับรอง',                     ['full', 'full', 'none', 'none']],
  ['g', 'วางแผนสอบเทียบ'],
  ['r', 'สร้าง / แก้ไขแผน',                    ['full', 'full', 'none', 'none']],
  ['r', 'อนุมัติแผน และยืนยันผลสอบ',            ['full', 'none', 'none', 'none']],
  ['r', 'รับทราบแผนของหน่วยงานตน',              ['full', 'none', 'none', 'part']],
  ['g', 'งานซ่อม'],
  ['r', 'แจ้งซ่อม และอัปเดตสถานะ',              ['full', 'full', 'none', 'none']],
  ['g', 'ระบบ'],
  ['r', 'ดู Audit Log',                        ['full', 'none', 'none', 'none']],
  ['r', 'จัดการผู้ใช้งาน',                      ['full', 'none', 'none', 'none']],
];
const PERM_MARK = {
  full: ['✓', '#e2f6ec', '#0d7a58', 'มีสิทธิ์เต็ม'],
  part: ['◐', '#fdf0dc', '#b45309', 'เฉพาะของหน่วยงานตน'],
  none: ['–', 'transparent', '#a9b8c5', 'ไม่มีสิทธิ์'],
};

function clearUserFilters() {
  ['userSearch', 'userRoleFilter', 'userStatusFilter']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderUsersTable();
}
function setUserRoleFilter(role) {
  const sel = document.getElementById('userRoleFilter');
  if (sel) sel.value = sel.value === role ? '' : role;
  renderUsersTable();
}

function renderUserRoleCards() {
  const host = document.getElementById('userRoleCards');
  if (!host) return;
  const active = document.getElementById('userRoleFilter')?.value || '';
  host.innerHTML = USER_ROLES.map(r => {
    const n = usersData.filter(u => u.role === r.id).length;
    return `<button type="button" class="ax-role-card${active === r.id ? ' is-on' : ''}"
        style="background:${r.bg};border-color:${active === r.id ? r.color : r.bd}" onclick="setUserRoleFilter('${r.id}')">
      <span class="ax-role-top">
        <span class="ax-role-ic" style="background:${r.tint}">${r.emoji}</span>
        <span class="ax-role-nm"><b>${r.name}</b><span style="color:${r.color}">${r.en}</span></span>
        <span class="ax-role-n"><b style="color:${r.color}">${n}</b><span>บัญชี</span></span>
      </span>
      <p>${r.desc}</p>
      <span class="ax-role-chips">${r.rights.map(t => `<span>${t}</span>`).join('')}</span>
      <span class="ax-role-scope">ขอบเขต: ${r.scope}</span>
    </button>`;
  }).join('');
}

function renderUserPerms() {
  const table = document.getElementById('userPermTable');
  if (!table) return;
  const heads = USER_ROLES.map(r =>
    `<th class="c-role"><span class="ax-perm-h"><b style="color:${r.color}">${r.name}</b><span>${r.en}</span></span></th>`).join('');
  const body = USER_PERMS.map(row => {
    if (row[0] === 'g') return `<tr><td class="ax-perm-group" colspan="${USER_ROLES.length + 1}">${row[1]}</td></tr>`;
    const cells = row[2].map(k => {
      const [mark, bg, fg, title] = PERM_MARK[k];
      return `<td class="c-mark"><span class="ax-perm-mark" title="${title}" style="background:${bg};color:${fg}">${mark}</span></td>`;
    }).join('');
    return `<tr><td class="c-cap">${row[1]}</td>${cells}</tr>`;
  }).join('');
  table.innerHTML = `<thead><tr><th class="c-cap">สิทธิ์ / ความสามารถ</th>${heads}</tr></thead><tbody>${body}</tbody>`;
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTable');
  if (!tbody) return;
  renderUserRoleCards();
  renderUserPerms();

  const q = (document.getElementById('userSearch')?.value || '').trim().toLowerCase();
  const roleF = document.getElementById('userRoleFilter')?.value || '';
  const statusF = document.getElementById('userStatusFilter')?.value || '';
  const rows = usersData.filter(u => {
    if (roleF && u.role !== roleF) return false;
    if (statusF === 'active' && !u.active) return false;
    if (statusF === 'inactive' && u.active) return false;
    if (!q) return true;
    return [u.name, u.username, u.department, u.role].some(v => String(v || '').toLowerCase().includes(q));
  });

  const totalLabel = document.getElementById('userTotalLabel');
  if (totalLabel) {
    totalLabel.textContent = `บัญชีผู้ใช้ สิทธิ์การเข้าถึง และขอบเขตข้อมูลของแต่ละระดับ · ทั้งหมด ${usersData.length.toLocaleString()} บัญชี`;
  }
  const countEl = document.getElementById('userResultCount');
  if (countEl) countEl.textContent = rows.length ? `พบ ${rows.length.toLocaleString()} บัญชี` : 'ไม่พบบัญชีที่ตรงกับตัวกรอง';
  const empty = document.getElementById('userEmpty');
  if (empty) empty.style.display = rows.length ? 'none' : 'flex';
  const wrap = tbody.closest('.table-wrap');
  if (wrap) wrap.style.display = rows.length ? '' : 'none';
  if (!rows.length) { tbody.innerHTML = ''; return; }

  tbody.innerHTML = rows.map(u => {
    const r = userRoleMeta(u.role);
    const isSelf = currentUser?.id === u.id;
    const initial = escapeHtmlText(String(u.name || u.username || '?').charAt(0).toUpperCase());
    const scope = (u.instrument_types && u.instrument_types.length)
      ? u.instrument_types.map(t => escapeHtmlText(
          (typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType({ instrument_type: t }) : t).split(' (')[0]
        )).join(' · ')
      : '<span class="ax-user-all">ทุกประเภท</span>';
    return `<tr class="${u.active ? '' : 'is-off'}">
      <td class="c-user">
        <span class="ax-user-cell">
          <span class="ax-user-avatar" style="background:${r.tint};color:${r.color}">${initial}</span>
          <span class="ax-user-tx">
            <b>${escapeHtmlText(u.name || '–')}</b>
            <span>${escapeHtmlText(u.username || '')}</span>
          </span>
        </span>
      </td>
      <td class="c-dept">${escapeHtmlText(u.department || '–')}</td>
      <td class="c-role">
        <span class="ax-user-role" style="background:${r.tint};color:${r.color}">${r.emoji} ${escapeHtmlText(r.name)}</span>
      </td>
      <td class="c-status">
        <span class="ax-user-status" style="${u.active ? 'background:#e1f5ee;color:#0f6e56' : 'background:#eef0f3;color:#5f6b7a'}">${u.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
      </td>
      <td class="c-scope">${scope}</td>
      <td class="c-act">
        <span class="ax-user-acts">
          <button type="button" class="ax-crc-act" onclick="openUserModal('${u.id}')">จัดการ</button>
          ${!isSelf ? `<button type="button" class="btn-del" onclick="deleteUser('${u.id}')" title="ลบบัญชี">🗑️</button>` : ''}
        </span>
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
