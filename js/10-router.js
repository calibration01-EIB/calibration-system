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

// FORMAL DASHBOARD CATEGORY OVERVIEW
// ====================================================
(function enhanceFormalDashboard() {
  const CAT_14 = [
    ['มวล/น้ำหนัก (Mass/Weight)', 'Mass/Weight'],
    ['ความยาว/มิติ (Length/Dimension)', 'Length/Dimension'],
    ['อุณหภูมิ/ความชื้น (Temperature/Humidity)', 'Temperature/Humidity'],
    ['ความดัน/สุญญากาศ (Pressure/Vacuum)', 'Pressure/Vacuum'],
    ['ความเร็วรอบ (Speed/Rotation)', 'Speed/Rotation'],
    ['เวลา (Time)', 'Time'],
    ['เคมี/ความเข้มข้น (Chemical/Concentration)', 'Chemical/Concentration'],
    ['ความหนืด/ความหนาแน่น (Viscosity/Density)', 'Viscosity/Density'],
    ['ไฟฟ้า (Electrical)', 'Electrical'],
    ['การไหล/ปริมาตร (Flow/Volume)', 'Flow/Volume'],
    ['แสง/เสียง (Light/Sound)', 'Light/Sound'],
    ['ความปลอดภัย (Safety)', 'Safety'],
    ['แรงบิด/แรงกด (Torque/Force)', 'Torque/Force'],
    ['อื่นๆ (Others)', 'Others'],
  ];

  function injectFormalDashboardStyles() {
    if (document.getElementById('codexFormalDashboardRuntime')) return;
    const style = document.createElement('style');
    style.id = 'codexFormalDashboardRuntime';
    style.textContent = `
      .dash-command-strip{min-height:74px!important;border:1px solid var(--border)!important;border-radius:8px!important;background:linear-gradient(180deg,#fff 0%,#f8fbfa 100%)!important;box-shadow:0 12px 30px rgba(15,61,56,.08)!important;padding:14px 16px!important;margin-bottom:12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important}
      .dash-command-kicker{color:var(--accent)!important;font-size:11px!important;font-weight:800!important;text-transform:uppercase!important}.dash-command-title{font-size:20px!important;line-height:1.2!important;font-weight:800!important;color:var(--text)!important;margin-top:2px!important}.dash-command-meta{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;justify-content:flex-end!important}.dash-command-meta span{min-height:28px!important;display:inline-flex!important;align-items:center!important;border:1px solid var(--border)!important;border-radius:8px!important;padding:0 10px!important;color:var(--text2)!important;background:#fff!important;font-size:11px!important;font-weight:700!important}
      .dash-kpi{min-height:92px!important;border:1px solid var(--border)!important;box-shadow:0 12px 30px rgba(15,61,56,.08)!important}.dash-kpi-total{background:linear-gradient(135deg,#06443f 0%,#0f766e 100%)!important}.dash-kpi-icon{font-size:13px!important;font-weight:800!important}.dash-kpi-label,.dash-kpi-rate{font-weight:800!important}.dash-card{border-color:var(--border)!important;box-shadow:0 12px 30px rgba(15,61,56,.08)!important}.dash-card-title{font-size:15px!important;font-weight:800!important}
      .dash-category-card{padding:14px!important;margin-bottom:12px!important}.dash-category-grid{display:grid!important;grid-template-columns:repeat(7,minmax(126px,1fr))!important;gap:10px!important}.dash-category-legend{display:flex;align-items:center;gap:10px;color:var(--text2);font-size:11px;font-weight:700;flex-wrap:wrap;justify-content:flex-end}.dash-category-legend span{display:inline-flex;align-items:center;gap:5px}.dash-status-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
      .category-status-card{min-height:87px;border-radius:8px;border:1px solid var(--border);background:linear-gradient(180deg,#fff 0%,#f8fbff 100%);padding:9px 10px;display:grid;align-content:center;gap:4px;cursor:pointer;font-family:var(--font);text-align:center;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}.category-status-card:hover{transform:translateY(-1px);border-color:var(--accent)!important;box-shadow:0 12px 24px rgba(15,118,110,.09)!important}.category-status-card.is-active{box-shadow:0 0 0 2px rgba(0,121,107,.18),0 12px 24px rgba(15,118,110,.09)!important}.category-status-name{color:var(--text);font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.category-status-num{font-size:22px;line-height:1;font-weight:800}.category-status-bar{height:3px;background:var(--surface2);border-radius:999px;margin:3px 2px 2px;display:flex;gap:1px;overflow:hidden}.category-status-bar i{display:block;height:100%}.category-status-tags{min-height:16px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;font-size:10px;font-weight:800}
      @media(max-width:1280px){.dash-category-grid{grid-template-columns:repeat(4,minmax(132px,1fr))!important}}@media(max-width:768px){.dash-command-strip{align-items:flex-start!important;flex-direction:column!important}.dash-command-meta{justify-content:flex-start!important}.dash-category-grid{grid-template-columns:repeat(2,minmax(120px,1fr))!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureFormalDashboardShell() {
    injectFormalDashboardStyles();
    const page = document.getElementById('pageDashboard');
    const stats = document.getElementById('statCardsGrid');
    const dashRow = document.getElementById('dashRow2');
    if (!page || !stats || !dashRow) return;

    if (!document.getElementById('dashCommandStrip')) {
      const strip = document.createElement('section');
      strip.id = 'dashCommandStrip';
      strip.className = 'dash-command-strip';
      strip.innerHTML = `<div><div class='dash-command-kicker'>Calibration Operations Dashboard</div><div class='dash-command-title'>ศูนย์ติดตามสถานะเครื่องมือสอบเทียบ</div></div><div class='dash-command-meta'><span>ข้อมูลจากทะเบียนเครื่องมือ</span><span>เรียงตามสถานะล่าสุด</span></div>`;
      page.insertBefore(strip, stats);
    }

    if (!document.getElementById('dashboardCategoryGrid')) {
      const section = document.createElement('section');
      section.className = 'dash-card dash-category-card';
      section.innerHTML = `<div class='dash-card-head'><div><div class='dash-card-title'>ประเภทเครื่องมือ — สถานะล่าสุด</div><div class='dash-card-sub'>กดการ์ดเพื่อกรองตามประเภท</div></div><div class='dash-category-legend'><span><i class='dash-status-dot' style='background:var(--red)'></i>เกินกำหนด</span><span><i class='dash-status-dot' style='background:var(--amber)'></i>ใกล้ครบ</span><span><i class='dash-status-dot' style='background:var(--green)'></i>ปกติ</span></div></div><div id='dashboardCategoryGrid' class='dash-category-grid'><div class='dash-card-sub' style='padding:12px 0'>กำลังโหลด...</div></div>`;
      page.insertBefore(section, dashRow);
    }

    const kpiIcons = [
      ['statTotal', 'ALL', ''],
      ['statOverdue', 'OD', 'var(--red)'],
      ['statWarning', '30D', 'var(--amber)'],
      ['statOk', 'OK', 'var(--green)'],
    ];
    kpiIcons.forEach(([id, label, color]) => {
      const icon = document.getElementById(id)?.closest('.dash-kpi')?.querySelector('.dash-kpi-icon');
      if (!icon) return;
      icon.textContent = label;
      if (color) icon.style.color = color;
    });
  }

  function buildCategoryStats() {
    const today = new Date();
    const stats = {};
    (allData || []).forEach(d => {
      const t = d.instrument_type || 'อื่นๆ (Others)';
      if (!stats[t]) stats[t] = { total: 0, overdue: 0, warning: 0, ok: 0 };
      stats[t].total++;
      let diff = typeof d.days_left === 'number' ? d.days_left : null;
      if (diff === null && d.due_date) diff = Math.ceil((new Date(d.due_date) - today) / 86400000);
      if (diff === null) stats[t].ok++;
      else if (diff < 0) stats[t].overdue++;
      else if (diff <= 30) stats[t].warning++;
      else stats[t].ok++;
    });
    return stats;
  }

  window.renderCategoryCards = function renderCategoryCards() {
    ensureFormalDashboardShell();
    const grids = ['categoryGrid', 'dashboardCategoryGrid'].map(id => document.getElementById(id)).filter(Boolean);
    if (!grids.length) return;
    grids.forEach(grid => { grid.innerHTML = ''; });
    const stats = buildCategoryStats();

    function makeCategoryCard(fullName, s, targetGrid) {
      const cnt = s.total;
      const thName = fullName.split(' (')[0];
      const isActive = activeCategory === fullName;
      const numClass = s.overdue > 0 ? 'danger' : s.warning > 0 ? 'warn' : cnt > 0 ? 'ok' : '';
      const mainColor = s.overdue > 0 ? 'var(--red)' : s.warning > 0 ? 'var(--amber)' : 'var(--green)';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'category-status-card' + (isActive ? ' is-active' : '');
      card.style.borderColor = isActive ? mainColor : 'var(--border)';
      card.style.cursor = cnt ? 'pointer' : 'default';
      card.innerHTML = `<div class='category-status-name' title='${thName}'>${thName}</div><div class='category-status-num ${numClass}'>${cnt || '–'}</div><div class='category-status-bar'>${s.overdue > 0 ? `<i style='flex:${s.overdue};background:var(--red)'></i>` : ''}${s.warning > 0 ? `<i style='flex:${s.warning};background:var(--amber)'></i>` : ''}${s.ok > 0 ? `<i style='flex:${s.ok};background:var(--green)'></i>` : ''}</div><div class='category-status-tags'>${s.overdue > 0 ? `<span class='danger'>● ${s.overdue}</span>` : ''}${s.warning > 0 ? `<span class='warn'>● ${s.warning}</span>` : ''}${s.ok > 0 && cnt > 0 ? `<span class='ok'>● ${s.ok}</span>` : ''}${cnt === 0 ? `<span style='color:var(--text3)'>–</span>` : ''}</div>`;
      if (cnt) {
        card.addEventListener('click', () => {
          activeCategory = (activeCategory === fullName) ? 'all' : fullName;
          currentPage = 1;
          renderCategoryCards();
          filterData();
          if (targetGrid.id === 'dashboardCategoryGrid') showPage('list');
        });
      } else {
        card.disabled = true;
      }
      return card;
    }

    CAT_14.forEach(([fullName]) => {
      const s = stats[fullName] || { total: 0, overdue: 0, warning: 0, ok: 0 };
      grids.forEach(grid => grid.appendChild(makeCategoryCard(fullName, s, grid)));
    });
  };

  const originalShowPage = showPage;
  window.showPage = function(page) {
    const result = originalShowPage.apply(this, arguments);
    if (page === 'dashboard') {
      ensureFormalDashboardShell();
      renderCategoryCards();
    }
    return result;
  };

  setTimeout(() => {
    ensureFormalDashboardShell();
    if (typeof renderCategoryCards === 'function') renderCategoryCards();
  }, 0);
})();
