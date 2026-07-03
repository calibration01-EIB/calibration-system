/* ===== 01-core.js ===== (generated from index.html inline app script) */
// ====================================================
// SUPABASE CONFIG — ใส่ค่าจาก Supabase Dashboard
// ====================================================
const SUPABASE_URL = 'https://wgdzcchleuojkbnqvbfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHpjY2hsZXVvamtibnF2YmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODM4MDYsImV4cCI6MjA5NDA1OTgwNn0.kmJWFP6mCr10_aQ_AU30yd45lqSi0rX9hapdIKMsH2c';

// ====================================================
// SUPABASE CLIENT + APP TOKEN
// RLS write policies require app_current_role() IS NOT NULL, which reads the
// per-session token from the "x-app-token" request header. We recreate the
// client with that header after login / on session restore so writes are allowed.
// ====================================================
let sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
function applyAppToken(token) {
  sb = token
    ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { 'x-app-token': token } } })
    : supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

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
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) return;

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...';
  document.getElementById('loginError').style.display = 'none';

  try {
    const hash = await sha256(password);
    // app_login (SECURITY DEFINER) verifies the credentials, creates a row in
    // app_sessions and returns a token that authorizes writes via RLS.
    const { data, error } = await sb.rpc('app_login', { p_username: username, p_password_hash: hash });
    const user = Array.isArray(data) ? data[0] : data;

    if (error || !user || !user.token) {
      document.getElementById('loginError').style.display = 'block';
    } else {
      applyAppToken(user.token);
      setSession(user);
      enterApp(user);
    }
  } catch(e) {
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
  }
}

function enterApp(user) {
  // Sessions cached before token-auth existed have no token → force a fresh
  // login so writes are authorized instead of silently failing under RLS.
  if (!user.token) { clearSession(); location.reload(); return; }
  applyAppToken(user.token);
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
  if (user.role === 'viewer') document.getElementById('uploadSection').style.display = 'none';
  if (user.role === 'admin' || user.role === 'editor') toggleManageColumns(true);
  // show bottom nav on mobile/tablet
  if (window.innerWidth <= 768) {
    const bn = document.querySelector('.bottom-nav');
    if (bn) bn.style.display = 'flex';
  }
  setDriveStatus(true, 'เชื่อมต่อ Supabase แล้ว');
  loadData();
}

async function doLogout() {
  const token = currentUser && currentUser.token;
  if (token) { try { await sb.rpc('app_logout', { p_token: token }); } catch (e) {} }
  applyAppToken(null);
  clearSession();
  location.reload();
}

// ====================================================
