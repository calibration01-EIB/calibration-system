import fs from 'node:fs';

const indexPath = 'index.html';
const reportsPath = 'js/04-reports.js';
const swPath = 'sw.js';
const scriptPath = '.github/scripts/apply-formal-dashboard-20260606.mjs';
const workflowPath = '.github/workflows/apply-formal-dashboard-20260606.yml';

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`);
  return source.replace(search, replacement);
}

let html = fs.readFileSync(indexPath, 'utf8');

const formalCss = `/* Compact dashboard */
#pageDashboard.dashboard-page { display: block; }
.dash-command-strip {
  min-height: 74px !important;
  border: 1px solid var(--border) !important;
  border-radius: 8px !important;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbfa 100%) !important;
  box-shadow: 0 12px 30px rgba(15,61,56,.08) !important;
  padding: 14px 16px !important;
  margin-bottom: 12px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
}
.dash-command-kicker { color: var(--accent) !important; font-size: 11px !important; font-weight: 800 !important; text-transform: uppercase !important; }
.dash-command-title { font-size: 20px !important; line-height: 1.2 !important; font-weight: 800 !important; color: var(--text) !important; margin-top: 2px !important; }
.dash-command-meta { display: flex !important; align-items: center !important; gap: 8px !important; flex-wrap: wrap !important; justify-content: flex-end !important; }
.dash-command-meta span { min-height: 28px !important; display: inline-flex !important; align-items: center !important; border: 1px solid var(--border) !important; border-radius: 8px !important; padding: 0 10px !important; color: var(--text2) !important; background: #fff !important; font-size: 11px !important; font-weight: 700 !important; }
.dash-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
.dash-kpi { min-height:92px !important; border-radius:8px !important; padding:12px 14px !important; border:1px solid var(--border) !important; background:#fff !important; box-shadow:0 12px 30px rgba(15,61,56,.08) !important; cursor:pointer; display:grid; grid-template-rows:auto 1fr auto; gap:4px; transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease; }
.dash-kpi:hover { transform:translateY(-1px) !important; border-color:rgba(0,121,107,.32) !important; box-shadow:0 16px 34px rgba(15,61,56,.11) !important; }
.dash-kpi-total { background:linear-gradient(135deg,#06443f 0%,#0f766e 100%) !important; color:white; border-color:transparent !important; }
.dash-kpi-head { display:flex; align-items:center; justify-content:space-between; gap:10px; min-width:0; }
.dash-kpi-icon { width:30px; height:30px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; background:var(--accent-light); }
.dash-kpi-total .dash-kpi-icon { background:rgba(255,255,255,.16); box-shadow:inset 0 0 0 1px rgba(255,255,255,.22); }
.dash-kpi-label { font-size:11px; font-weight:800; color:var(--text3); letter-spacing:0; text-align:right; }
.dash-kpi-total .dash-kpi-label,.dash-kpi-total .dash-kpi-sub,.dash-kpi-total .dash-kpi-rate { color:rgba(255,255,255,.78); }
#statTotal,#statOk,#statOverdue,#statWarning { font-size:30px !important; line-height:1 !important; font-weight:800 !important; letter-spacing:0 !important; }
.dash-kpi-value.ok { color:var(--green); } .dash-kpi-value.danger { color:var(--red); } .dash-kpi-value.warn { color:var(--amber); }
.dash-kpi-foot { display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:11px; }
.dash-kpi-sub { color:var(--text3); } .dash-kpi-rate { color:var(--text2); font-weight:800; }
.dash-category-card { padding:14px !important; margin-bottom:12px !important; }
.dash-category-grid { display:grid !important; grid-template-columns:repeat(7,minmax(126px,1fr)) !important; gap:10px !important; }
.dash-category-legend { display:flex; align-items:center; gap:10px; color:var(--text2); font-size:11px; font-weight:700; flex-wrap:wrap; justify-content:flex-end; }
.dash-category-legend span { display:inline-flex; align-items:center; gap:5px; }
.dash-status-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
.category-status-card { min-height:87px; border-radius:8px; border:1px solid var(--border); background:linear-gradient(180deg,#fff 0%,#f8fbff 100%); padding:9px 10px; display:grid; align-content:center; gap:4px; cursor:pointer; font-family:var(--font); text-align:center; transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease; }
.category-status-card:hover { transform:translateY(-1px); border-color:var(--accent) !important; box-shadow:0 12px 24px rgba(15,118,110,.09) !important; }
.category-status-card.is-active { box-shadow:0 0 0 2px rgba(0,121,107,.18), 0 12px 24px rgba(15,118,110,.09) !important; }
.category-status-name { color:var(--text); font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.category-status-num { font-size:22px; line-height:1; font-weight:800; }
.category-status-bar { height:3px; background:var(--surface2); border-radius:999px; margin:3px 2px 2px; display:flex; gap:1px; overflow:hidden; }
.category-status-bar i { display:block; height:100%; }
.category-status-tags { min-height:16px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap; font-size:10px; font-weight:800; }
.dash-work-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(320px,.85fr); gap:12px; margin-bottom:12px; }
.dash-card { background:rgba(255,255,255,.98) !important; border:1px solid var(--border) !important; border-radius:8px !important; box-shadow:0 12px 30px rgba(15,61,56,.08) !important; }
.dash-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px; }
.dash-card-title { font-size:15px; font-weight:800; color:var(--text); }
.dash-card-sub { font-size:11px; color:var(--text3); margin-top:2px; }
.dash-count-pill { padding:3px 9px; border-radius:999px; background:var(--red-light); color:var(--red); font-size:11px; font-weight:800; white-space:nowrap; }
.dash-action-card,.dash-health-card,.dash-month-card { padding:14px !important; }
.dash-action-list { display:grid !important; gap:6px !important; max-height:280px !important; overflow-y:auto; padding-right:3px; }
.dash-action-item { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; padding:8px 9px !important; border-radius:8px !important; border:1px solid transparent; background:#fbfdfc; margin:0 !important; }
.dash-action-item.danger { background:#fff5f5 !important; border-color:#f7c8c8 !important; }
.dash-action-item.warn { background:#fffaf0 !important; border-color:#f5dfab !important; }
.dash-action-item.info { background:#effaf8 !important; border-color:#bfe8df !important; }
.dash-action-main { min-width:0; } .dash-action-name { font-size:12px; font-weight:800; color:var(--text); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dash-action-meta { font-size:10px; color:var(--text3); margin-top:2px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.dash-action-side { display:flex; align-items:flex-end; flex-direction:column; gap:4px; white-space:nowrap; }
.dash-action-status { font-size:10px; font-weight:800; }
.dash-action-btn { border:none; border-radius:6px; padding:3px 8px; font-size:10px; font-family:var(--font); font-weight:800; color:#fff; cursor:pointer; }
.dash-health-meters { display:grid; gap:10px; margin-bottom:12px; }
.dash-meter-row { display:grid; gap:4px; } .dash-meter-label { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; color:var(--text2); }
.dash-meter-label strong { color:var(--text); } .dash-meter { height:7px; background:#edf4f6; border-radius:999px; overflow:hidden; } .dash-meter>div { height:100%; border-radius:999px; transition:width .45s ease; }
.dash-risk-list { display:grid; gap:5px; border-top:1px solid var(--border); padding-top:10px; }
.dash-risk-item { display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid #eef4f4; cursor:pointer; }
.dash-risk-item:last-child { border-bottom:0; } .dash-risk-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--text); font-weight:700; } .dash-risk-status { font-size:11px; white-space:nowrap; font-weight:800; }
.dash-month-card { margin-bottom:12px; } #monthGrid { display:grid !important; grid-template-columns:repeat(12,minmax(72px,1fr)) !important; gap:6px !important; }
#monthGrid>div { min-height:64px !important; padding:8px 5px !important; border-radius:8px !important; } #monthGrid>div div:nth-child(2) { font-size:18px !important; }
.dash-muted-link { border:1px solid var(--border); background:var(--surface2); color:var(--text2); border-radius:7px; padding:4px 9px; font-family:var(--font); font-size:11px; font-weight:800; cursor:pointer; }
@media (max-width:1280px){ .dash-category-grid{grid-template-columns:repeat(4,minmax(132px,1fr)) !important;} }
@media (max-width:1200px){ .dash-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .dash-work-grid{grid-template-columns:1fr;} #monthGrid{grid-template-columns:repeat(6,minmax(72px,1fr)) !important;} }
@media (max-width:768px){ .dash-command-strip{align-items:flex-start !important; flex-direction:column !important;} .dash-command-meta{justify-content:flex-start !important;} .dash-kpi-grid{grid-template-columns:1fr 1fr;} .dash-kpi{min-height:86px !important;padding:10px !important;} #statTotal,#statOk,#statOverdue,#statWarning{font-size:24px !important;} .dash-category-grid{grid-template-columns:repeat(2,minmax(120px,1fr)) !important;} #monthGrid{grid-template-columns:repeat(3,minmax(72px,1fr)) !important;} .dash-action-item{grid-template-columns:1fr;} .dash-action-side{align-items:flex-start;flex-direction:row;justify-content:space-between;} }`;

const compactCssRegex = /\/\* Compact dashboard \*\/[\s\S]*?@media \(max-width:768px\)\{[\s\S]*?\.dash-action-side\{align-items:flex-start;flex-direction:row;justify-content:space-between;\} \}/;
if (!compactCssRegex.test(html)) throw new Error('Could not find compact dashboard CSS block');
html = html.replace(compactCssRegex, formalCss);

if (!html.includes('dash-command-strip')) {
  html = replaceRequired(
    html,
    '      <div id="pageDashboard" class="page-content dashboard-page">\n\n        <div id="statCardsGrid" class="dash-kpi-grid">',
    `      <div id="pageDashboard" class="page-content dashboard-page">\n\n        <section class="dash-command-strip">\n          <div>\n            <div class="dash-command-kicker">Calibration Operations Dashboard</div>\n            <div class="dash-command-title">ศูนย์ติดตามสถานะเครื่องมือสอบเทียบ</div>\n          </div>\n          <div class="dash-command-meta">\n            <span>ข้อมูลจากทะเบียนเครื่องมือ</span>\n            <span>เรียงตามสถานะล่าสุด</span>\n          </div>\n        </section>\n\n        <div id="statCardsGrid" class="dash-kpi-grid">`,
    'dashboard command strip insertion point'
  );
}

if (!html.includes('dashboardCategoryGrid')) {
  html = replaceRequired(
    html,
    '        </div>\n\n        <div id="dashRow2" class="dash-work-grid">',
    `        </div>\n\n        <section class="dash-card dash-category-card">\n          <div class="dash-card-head">\n            <div>\n              <div class="dash-card-title">ประเภทเครื่องมือ — สถานะล่าสุด</div>\n              <div class="dash-card-sub">กดการ์ดเพื่อกรองตามประเภท</div>\n            </div>\n            <div class="dash-category-legend">\n              <span><i class="dash-status-dot" style="background:var(--red)"></i>เกินกำหนด</span>\n              <span><i class="dash-status-dot" style="background:var(--amber)"></i>ใกล้ครบ</span>\n              <span><i class="dash-status-dot" style="background:var(--green)"></i>ปกติ</span>\n            </div>\n          </div>\n          <div id="dashboardCategoryGrid" class="dash-category-grid">\n            <div class="dash-card-sub" style="padding:12px 0">กำลังโหลด...</div>\n          </div>\n        </section>\n\n        <div id="dashRow2" class="dash-work-grid">`,
    'dashboard category insertion point'
  );
}

html = html.replace(/<div class="dash-kpi-icon">🔧<\/div>/, '<div class="dash-kpi-icon">ALL</div>');
html = html.replace(/<div class="dash-kpi-icon" style="background:var\(--red-light\)">🔴<\/div>/, '<div class="dash-kpi-icon" style="background:var(--red-light);color:var(--red)">OD</div>');
html = html.replace(/<div class="dash-kpi-icon" style="background:var\(--amber-light\)">🟡<\/div>/, '<div class="dash-kpi-icon" style="background:var(--amber-light);color:var(--amber)">30D</div>');
html = html.replace(/<div class="dash-kpi-icon" style="background:var\(--green-light\)">✅<\/div>/, '<div class="dash-kpi-icon" style="background:var(--green-light);color:var(--green)">OK</div>');

fs.writeFileSync(indexPath, html, 'utf8');

let reports = fs.readFileSync(reportsPath, 'utf8');
const newRenderCategoryCards = `function renderCategoryCards() {
  const grids = ['categoryGrid', 'dashboardCategoryGrid']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!grids.length) return;
  grids.forEach(grid => { grid.innerHTML = ''; });

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

  const today = new Date();
  const stats = {};
  allData.forEach(d => {
    const t = d.instrument_type || 'อื่นๆ (Others)';
    if (!stats[t]) stats[t] = { total: 0, overdue: 0, warning: 0, ok: 0 };
    stats[t].total++;

    let diff = typeof d.days_left === 'number' ? d.days_left : null;
    if (diff === null && d.due_date) {
      diff = Math.ceil((new Date(d.due_date) - today) / 86400000);
    }

    if (diff === null) stats[t].ok++;
    else if (diff < 0) stats[t].overdue++;
    else if (diff <= 30) stats[t].warning++;
    else stats[t].ok++;
  });

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
    card.innerHTML = `
      <div class="category-status-name" title="${thName}">${thName}</div>
      <div class="category-status-num ${numClass}">${cnt || '–'}</div>
      <div class="category-status-bar">
        ${s.overdue > 0 ? `<i style="flex:${s.overdue};background:var(--red)"></i>` : ''}
        ${s.warning > 0 ? `<i style="flex:${s.warning};background:var(--amber)"></i>` : ''}
        ${s.ok > 0 ? `<i style="flex:${s.ok};background:var(--green)"></i>` : ''}
      </div>
      <div class="category-status-tags">
        ${s.overdue > 0 ? `<span class="danger">● ${s.overdue}</span>` : ''}
        ${s.warning > 0 ? `<span class="warn">● ${s.warning}</span>` : ''}
        ${s.ok > 0 && cnt > 0 ? `<span class="ok">● ${s.ok}</span>` : ''}
        ${cnt === 0 ? `<span style="color:var(--text3)">–</span>` : ''}
      </div>`;

    if (cnt) {
      card.addEventListener('click', () => {
        activeCategory = (activeCategory === fullName) ? 'all' : fullName;
        currentPage = 1;
        renderCategoryCards();
        filterData();
        if (targetGrid.id === 'dashboardCategoryGrid' && typeof showPage === 'function') {
          showPage('list');
        }
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
}`;

const categoryRegex = /function renderCategoryCards\(\) \{[\s\S]*?\n\}\n\n\nfunction selectCategory/;
if (!categoryRegex.test(reports)) throw new Error('Could not find renderCategoryCards function');
reports = reports.replace(categoryRegex, `${newRenderCategoryCards}\n\n\nfunction selectCategory`);
fs.writeFileSync(reportsPath, reports, 'utf8');

let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/calibration-app-v\d+/g, 'calibration-app-v8');
fs.writeFileSync(swPath, sw, 'utf8');

for (const path of [scriptPath, workflowPath]) {
  fs.rmSync(path, { force: true });
}
