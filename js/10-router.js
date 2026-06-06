/* ===== 10-router.js ===== (generated from index.html inline app script) */
// SHOW PAGE
// ====================================================
function showPage(page) {
  const pages = ['dashboard','list','audit','admin','monthly','plan','weights','cert'];
  pages.forEach(p => {
    const el = document.getElementById('page' + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) el.style.display = page === p ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: ['Dashboard','ภาพรวมสถานะเครื่องมือ'],
    list: ['รายการเครื่องมือ','ค้นหา กรอง และจัดการรายการ'],
    audit: ['Audit Log','ประวัติการเปลี่ยนแปลง'],
    admin: ['จัดการผู้ใช้','ตั้งค่าบัญชีและสิทธิ์'],
    monthly: ['รายงานรายเดือน','แผนสอบเทียบ'],
    plan: ['📅 วางแผนสอบเทียบ','กำหนดตารางและ Export FRM-EIB04'],
    weights: ['⚖️ Standard Weights','ทะเบียนลูกตุ้มมาตรฐาน'],
    cert: ['🏷️ ออก Cert','บันทึกการออกหมายเลขใบรับรองผลการสอบเทียบ'],
  };
  const t = titles[page] || ['',''];
  const tb = document.getElementById('topbarTitle');
  const ts = document.getElementById('topbarSub');
  if (tb) tb.textContent = t[0];
  if (ts) ts.textContent = t[1];

  if (page === 'plan') { loadPlanConfirmBadge(); initPlanPage(); }
  if (page === 'weights') loadStandardWeights();
  if (page === 'admin') loadUsers();
  if (page === 'audit') loadAuditLogs();
  if (page === 'cert') {
    const waitAndLoad = (attempt) => {
      if (allData && allData.length > 0) { loadCertPage(); return; }
      if (attempt > 20) { loadCertPage(); return; }
      setTimeout(() => waitAndLoad(attempt + 1), 200);
    };
    waitAndLoad(0);
  }
}

// ====================================================
// INIT — ตรวจ session อัตโนมัติตอนโหลดหน้า
// ====================================================


function filterByStatus(status) {
  showPage('list');
  const sel = document.getElementById('statusFilter');
  if (sel) sel.value = status;
  if (typeof filterData === 'function') filterData();
}

(function init() {
  const session = getSession();
  if (session) {
    currentUser = session;
    enterApp(session);
  } else {
    document.body.classList.add('login-mode');
    document.body.classList.remove('app-mode');
    document.getElementById('loginPage')?.style.setProperty('display', 'grid', 'important');
    document.getElementById('app')?.style.setProperty('display', 'none', 'important');
  }
})();

