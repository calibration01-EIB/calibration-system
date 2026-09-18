/* ===== 01-core.js ===== (generated from index.html inline app script) */
// ====================================================
// SUPABASE CONFIG — ย้ายไป js/00-config.js (โหลดก่อนไฟล์นี้) → SUPABASE_URL / SUPABASE_KEY
// ====================================================
const sb = calCreateClient();

// ====================================================
// SESSION
// ====================================================
let currentUser = null;

function getSession() {
  try { return JSON.parse(localStorage.getItem('cal_session') || 'null'); } catch(e) { return null; }
}
function setSession(u) { localStorage.setItem('cal_session', JSON.stringify(u)); currentUser = u; }
function clearSession() { localStorage.removeItem('cal_session'); currentUser = null; }

// ====================================================
// SHA-256
// ====================================================
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ====================================================
// LOGIN
// ====================================================
function toggleLoginPassword(button) {
  const input = document.getElementById('loginPassword');
  if (!input || !button) return;
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(reveal));
  button.setAttribute('aria-label', reveal ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
}

function setLoginButtonLabel(button, text) {
  const label = button.querySelector('span:not(.cal-submit-arrow)');
  if (label) label.textContent = text;
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) return;

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; setLoginButtonLabel(btn, 'กำลังตรวจสอบ...');
  document.getElementById('loginError').style.display = 'none';

  try {
    const hash = await sha256(password);
    const { data, error } = await sb.rpc('app_login', {
      p_username: username,
      p_password_hash: hash
    });
    const user = Array.isArray(data) ? data[0] : data;

    if (error || !user) {
      document.getElementById('loginError').style.display = 'block';
    } else {
      setSession(user);
      // reload เพื่อสร้าง Supabase client ใหม่ที่แนบ header x-app-token (จำเป็นต่อการเขียนข้อมูล)
      location.reload();
    }
  } catch(e) {
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    btn.disabled = false; setLoginButtonLabel(btn, 'เข้าสู่ระบบ');
  }
}

async function requireInstrumentWriteSession() {
  const { data: role, error } = await sb.rpc('app_current_role');
  if (error) throw new Error('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ: ' + error.message);
  if (!role) throw new Error('การเข้าสู่ระบบหมดอายุ กรุณาเก็บข้อมูลที่กรอกไว้ แล้วออกจากระบบและเข้าสู่ระบบใหม่ก่อนบันทึก');
  if (role !== 'admin' && role !== 'editor') throw new Error('บัญชีนี้ไม่มีสิทธิ์บันทึกเครื่องมือ กรุณาติดต่อผู้ดูแลระบบ');
}

async function enterApp(user) {
  // Sessions created before token-auth (or any session missing a token) can read
  // but silently fail every write under RLS. Force a fresh login so calCreateClient
  // attaches x-app-token and edits actually save.
  if (!user || !user.token) { clearSession(); location.reload(); return; }
  // มี token ในเครื่องไม่ได้แปลว่า session ยังใช้ได้: ตรวจวันหมดอายุ/สถานะบัญชีที่ server
  try {
    const { data: role, error } = await sb.rpc('app_current_role');
    if (error) throw error;
    if (!role) { clearSession(); location.reload(); return; }
    user = { ...user, role };
    setSession(user);
  } catch (e) {
    showToast('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาโหลดหน้าใหม่: ' + e.message, 'error');
    return;
  }
  document.body.classList.add('app-mode');
  document.body.classList.remove('login-mode');
  document.getElementById('loginPage').style.setProperty('display', 'none', 'important');
  document.getElementById('app').style.setProperty('display', 'block', 'important');
  document.getElementById('sidebarName').textContent = user.name;
  document.getElementById('sidebarRole').textContent = user.role;
  document.getElementById('sidebarInitial').textContent = user.name.charAt(0).toUpperCase();
  if (user.role === 'admin') {
    const adminBtn = document.getElementById('sidebarAdminBtn'); if (adminBtn) adminBtn.style.display = 'inline-flex';
    document.getElementById('nav-audit').style.display = 'flex';
    const ba = document.getElementById('bnav-admin'); if (ba) ba.style.display = 'flex';
    const bau = document.getElementById('bnav-audit'); if (bau) bau.style.display = 'flex';
  }
  if (user.role === 'viewer' || user.role === 'owner') document.getElementById('uploadSection').style.display = 'none';
  if (user.role === 'admin' || user.role === 'editor') toggleManageColumns(true);
  // show bottom nav on mobile/tablet
  if (window.innerWidth <= 768) {
    const bn = document.querySelector('.bottom-nav');
    if (bn) bn.style.display = 'flex';
  }
  setDriveStatus(true, 'เชื่อมต่อ Supabase แล้ว');
  // หน้าแรกหลังล็อกอิน = Home (ดีไซน์ใหม่) ไม่ใช่ Dashboard
  if (typeof showPage === 'function') showPage('home');
  loadData();
}

async function doLogout() {
  const token = currentUser?.token;
  if (token) { try { await sb.rpc('app_logout', { p_token: token }); } catch(e) {} }
  clearSession();
  location.reload();
}

// ====================================================
