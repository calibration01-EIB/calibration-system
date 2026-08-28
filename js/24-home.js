/* ============================================================
   24-home.js — หน้าแรก (Home) + header ใหม่ ตามดีไซน์ Calibration App
   ต้องโหลด "หลัง" 10-router.js เพราะห่อ showPage()
   ============================================================ */

/* ---------- ภาพสำรอง (ใช้เมื่อไฟล์ assets/tiles/*.png ยังไม่มี) ---------- */
const AX_ART = {
  dashboard: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#e4eefb"/><rect x="16" y="36" width="12" height="18" rx="3" fill="#2f7de1"/><rect x="34" y="22" width="12" height="32" rx="3" fill="#2f7de1"/><rect x="52" y="30" width="12" height="24" rx="3" fill="#5fa3ee"/><rect x="70" y="16" width="12" height="38" rx="3" fill="#1d5fb4"/></svg>',
  list: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#dff2e8"/><rect x="20" y="6" width="56" height="60" rx="7" fill="#1f9d6b"/><rect x="30" y="20" width="36" height="6" rx="3" fill="#fff"/><rect x="30" y="33" width="36" height="6" rx="3" fill="#fff"/><rect x="30" y="46" width="22" height="6" rx="3" fill="#fff"/></svg>',
  calrecs: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#e4eefb"/><rect x="26" y="10" width="44" height="52" rx="7" fill="#2f7de1"/><rect x="38" y="4" width="20" height="12" rx="5" fill="#1d5fb4"/><path d="M36 34l6 6 14-14" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cert: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#e0f3e4"/><rect x="24" y="12" width="48" height="40" rx="6" fill="#3aa564"/><rect x="34" y="24" width="28" height="5" rx="2.5" fill="#fff"/><rect x="34" y="35" width="18" height="5" rx="2.5" fill="#fff"/><circle cx="48" cy="58" r="9" fill="#f0a417"/></svg>',
  weights: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#dcf0f2"/><rect x="20" y="14" width="56" height="44" rx="7" fill="#1a8b9c"/><rect x="28" y="24" width="16" height="16" rx="3" fill="#fff"/><rect x="50" y="24" width="18" height="5" rx="2.5" fill="#fff"/><rect x="50" y="35" width="18" height="5" rx="2.5" fill="#fff"/><rect x="28" y="46" width="40" height="5" rx="2.5" fill="#fff"/></svg>',
  plan: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#ece6fb"/><rect x="18" y="14" width="60" height="46" rx="7" fill="#7c5cd6"/><rect x="28" y="8" width="7" height="14" rx="3.5" fill="#5b3fae"/><rect x="61" y="8" width="7" height="14" rx="3.5" fill="#5b3fae"/><rect x="18" y="27" width="60" height="4" fill="#fff"/><circle cx="32" cy="41" r="4" fill="#fff"/><circle cx="48" cy="41" r="4" fill="#fff"/><circle cx="64" cy="41" r="4" fill="#fff"/><circle cx="32" cy="52" r="4" fill="#fff"/></svg>',
  dailylog: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#fdeed6"/><rect x="24" y="12" width="48" height="48" rx="6" fill="#e0942a"/><rect x="34" y="24" width="28" height="5" rx="2.5" fill="#fff"/><rect x="34" y="35" width="28" height="5" rx="2.5" fill="#fff"/><rect x="34" y="46" width="16" height="5" rx="2.5" fill="#fff"/></svg>',
  repairs: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#fce3e6"/><path d="M62 16a14 14 0 0 0-12.7 19.9L28 56.4a5.4 5.4 0 0 0 7.6 7.6l20.5-20.4A14 14 0 0 0 74 26.6l-7.4 7.4-7.2-1.8-1.8-7.2z" fill="#e0475b"/></svg>',
  gate: '<svg viewBox="0 0 96 72" fill="none"><rect x="4" y="8" width="88" height="56" rx="8" fill="#e3ecfb"/><rect x="16" y="26" width="34" height="28" rx="5" fill="#3f6fb5"/><path d="M56 40h22M70 32l8 8-8 8" stroke="#1b4f91" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ---------- นิยามการ์ดหน้าแรก (ลำดับตามดีไซน์) ---------- */
const AX_TILES = [
  { k:'dashboard', img:'01_dashboard',            page:'dashboard', t:'Dashboard',                    d:'ภาพรวมข้อมูลและสถิติการสอบเทียบ' },
  { k:'list',      img:'02_instrument_list',      page:'list',      t:'รายการเครื่องมือ',              d:'จัดการข้อมูลเครื่องมือวัดและรายละเอียด' },
  { k:'calrecs',   img:'03_calibration_tracking', page:'calrecs',   t:'ติดตามผลสอบเทียบ',              d:'ติดตามสถานะและผลการสอบเทียบของเครื่องมือวัด', badge:'navCalrecsBadge', tone:'warn' },
  { k:'cert',      img:'04_cert_number',          page:'cert',      t:'ลำดับเลข Cert',                 d:'ทะเบียนหมายเลขลำดับใบรับรองผลสอบเทียบ' },
  { k:'weights',   img:'05_cert_reference',       page:'weights',   t:'ใบ Cert Reference',             d:'ค้นหาและอ้างอิงใบรับรองการสอบเทียบ' },
  { k:'plan',      img:'06_calibration_planning', page:'plan',      t:'วางแผนสอบเทียบ',                d:'วางแผนและกำหนดรอบการสอบเทียบ', badge:'navPlanBadge', tone:'warn' },
  { k:'dailylog',  img:'07_daily_scale_record',   page:'soon',      t:'ใบบันทึกประจำวันเครื่องชั่ง',   d:'จัดเก็บและเพิ่มเอกสารแนบตามหน่วยงาน' },
  { k:'repairs',   img:'08_repair',               page:'repairs',   t:'งานซ่อม',                      d:'จัดการข้อมูลการซ่อมแซมเครื่องมือวัด', badge:'navRepairBadge', tone:'danger' },
  { k:'gate',      img:'09_offsite_equipment',    page:'gate',      t:'นำของออกนอกสถานที่',            d:'บันทึกใบขออนุญาต ติดตามการรับกลับ และประวัติย้อนหลัง' },
];

const AX_ARROW = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16394f" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15"></path><path d="M13 6l6 6-6 6"></path></svg>';

function axEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function renderAxTiles() {
  const host = document.getElementById('axTiles');
  if (!host) return;
  host.innerHTML = AX_TILES.map(x => {
    const art = x.img
      ? `<img src="assets/tiles/${x.img}.png" alt="" onerror="this.parentNode.innerHTML=${JSON.stringify(AX_ART[x.k] || '').replace(/"/g,'&quot;')}">`
      : (AX_ART[x.k] || '');
    const badge = x.badge
      ? `<span class="ax-tile-badge ${x.tone || 'warn'}" data-src="${x.badge}"></span>`
      : '';
    return `<button type="button" class="ax-tile" onclick="showPage('${x.page}')">
      ${badge}
      <span class="ax-tile-art">${art}</span>
      <span class="ax-tile-txt"><h3>${axEsc(x.t)}</h3><p>${axEsc(x.d)}</p></span>
      <span class="ax-tile-go">${AX_ARROW}</span>
    </button>`;
  }).join('');
  syncAxTileBadges();
}

/* คัดตัวเลขจาก badge เดิมของ sidebar (JS เดิมยังอัปเดต element พวกนั้นอยู่) */
function syncAxTileBadges() {
  document.querySelectorAll('.ax-tile-badge[data-src]').forEach(el => {
    const src = document.getElementById(el.getAttribute('data-src'));
    const n = src ? parseInt(String(src.textContent).replace(/\D/g, ''), 10) : 0;
    if (n > 0) { el.textContent = n; el.classList.add('on'); }
    else { el.textContent = ''; el.classList.remove('on'); }
  });
}

/* ---------- header: ผู้ใช้ + เมนู ---------- */
function axSyncUser() {
  const name = (document.getElementById('sidebarName') || {}).textContent || 'ผู้ใช้';
  const role = (document.getElementById('sidebarRole') || {}).textContent || '';
  const n = document.getElementById('axUserName');
  const r = document.getElementById('axUserRole');
  const i = document.getElementById('axUserInitial');
  if (n) n.textContent = name;
  if (r) r.textContent = role;
  if (i) i.textContent = (name.trim()[0] || 'A').toUpperCase();

  // เมนูตามสิทธิ์ — อิงจากปุ่ม/เมนูเดิมที่ enterApp() เปิดให้ตามบทบาท
  const mirror = (menuId, srcId) => {
    const m = document.getElementById(menuId), v = document.getElementById(srcId);
    if (!m) return;
    const shown = !!v && v.style.display !== 'none' && v.style.display !== '';
    m.style.display = shown ? 'flex' : 'none';
  };
  mirror('axMenuAdmin', 'sidebarAdminBtn');
  mirror('axMenuAudit', 'nav-audit');
  mirror('axMobileMoreAdmin', 'sidebarAdminBtn');
  mirror('axMobileMoreAudit', 'nav-audit');
}

function toggleAxUserMenu(ev) {
  if (ev) ev.stopPropagation();
  const m = document.getElementById('axUserMenu');
  if (!m) return;
  const open = m.classList.toggle('open');
  const trigger = document.getElementById('axUser');
  if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    axSyncUser();
    setTimeout(() => document.addEventListener('click', axCloseUserMenu, { once: true }), 0);
  }
}
function axCloseUserMenu() {
  const m = document.getElementById('axUserMenu');
  if (m) m.classList.remove('open');
  const trigger = document.getElementById('axUser');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}
function axGo(ev, page) {
  if (ev) ev.stopPropagation();
  axCloseUserMenu();
  showPage(page);
}
function axLogout(ev) {
  if (ev) ev.stopPropagation();
  axCloseUserMenu();
  if (typeof doLogout === 'function') doLogout();
}

/* ---------- mobile: bottom navigation + เมนูเพิ่มเติม ---------- */
function toggleAxMobileMore(ev) {
  if (ev) ev.stopPropagation();
  const menu = document.getElementById('axMobileMore');
  const button = document.getElementById('axMobileMoreBtn');
  if (!menu || !button) return;
  const open = menu.classList.toggle('open');
  menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) axSyncUser();
}

function closeAxMobileMore() {
  const menu = document.getElementById('axMobileMore');
  const button = document.getElementById('axMobileMoreBtn');
  if (menu) {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
  }
  if (button) button.setAttribute('aria-expanded', 'false');
}

function axMobileGo(page) {
  closeAxMobileMore();
  showPage(page);
}

function syncAxMobileNav(page) {
  document.querySelectorAll('.bottom-nav .mobile-nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-page') === page);
  });
  const more = document.getElementById('axMobileMoreBtn');
  if (more) more.classList.toggle('active', ['dashboard', 'cert', 'repairs', 'weights', 'admin', 'audit'].indexOf(page) !== -1);
}

/* ---------- หน้า placeholder (ตามดีไซน์ isSoon) ---------- */
function axEnsureSoonPage() {
  if (document.getElementById('pageSoon')) return;
  const home = document.getElementById('pageHome');
  if (!home || !home.parentNode) return;
  const el = document.createElement('div');
  el.id = 'pageSoon';
  el.className = 'page-content';
  el.style.display = 'none';
  el.innerHTML =
    '<div style="background:#fff;border:1px solid #e6edf3;border-radius:16px;padding:96px 24px;display:flex;flex-direction:column;align-items:center;gap:14px">' +
      '<span style="font-size:52px" id="axSoonEmoji">🚧</span>' +
      '<span style="font-size:24px;font-weight:700;color:#16394f" id="axSoonTitle">อยู่ระหว่างพัฒนา</span>' +
      '<span style="font-size:16.5px;color:#5b7186">หน้านี้ยังไม่ได้ทำในระบบจริง</span>' +
      '<button type="button" onclick="showPage(\'home\')" style="margin-top:10px;padding:13px 24px;border-radius:12px;border:none;background:#0f8f7d;color:#fff;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer">กลับหน้าแรก</button>' +
    '</div>';
  home.parentNode.insertBefore(el, home.nextSibling);
}

/* ---------- ห่อ showPage ให้รู้จัก home / soon ---------- */
(function () {
  const prev = window.showPage;
  if (typeof prev !== 'function') return;

  window.showPage = function (page) {
    axEnsureSoonPage();

    const extra = ['home', 'soon'];
    if (extra.indexOf(page) === -1) {
      // หน้าปกติ — ให้ router เดิมทำงาน แล้วปิดหน้าเสริม
      prev.apply(this, arguments);
      extra.forEach(p => {
        const el = document.getElementById('page' + p.charAt(0).toUpperCase() + p.slice(1));
        if (el) el.style.display = 'none';
      });
    } else {
      // หน้าเสริม — ซ่อนหน้าปกติทั้งหมดผ่าน router เดิม (ส่งชื่อที่ไม่ตรงกับหน้าไหน)
      prev.call(this, '__none__');
      extra.forEach(p => {
        const el = document.getElementById('page' + p.charAt(0).toUpperCase() + p.slice(1));
        if (el) el.style.display = (p === page) ? 'block' : 'none';
      });
      if (page === 'home') renderAxTiles();
    }

    const hb = document.getElementById('axHomeBtn');
    if (hb) hb.classList.toggle('is-on', page === 'home');
    closeAxMobileMore();
    syncAxMobileNav(page);
    axSyncUser();
    window.scrollTo(0, 0);
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  axEnsureSoonPage();
  axSyncUser();
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') closeAxMobileMore();
  });
  // badge ของการ์ดตามค่าล่าสุด
  setInterval(syncAxTileBadges, 4000);
});
