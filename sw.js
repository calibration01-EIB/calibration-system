const CACHE_NAME = 'calibration-app-v162';
const IMPORT_TEMPLATE_SELECTION_SCRIPT = './js/11-import-template-selection.js?v=20260611-balance-mass-split';
const RETIRED_ASSET_PATHS = Object.freeze([
  'js/06-plan.js', 'js/15-plan-export.js', 'js/17-frm-cross-month.js', 'assets/frm-eib04-template.xlsx'
]);
const APP_SHELL = [
  './',
  './index.html',
  './index.html?v=20260905-date1',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './theme-aqua.css?v=20260905-date1',
  './assets/ilc-logo-full.png',
  './assets/ilc-logo-symbol.png',
  './assets/nac-thailand.png',
  './assets/calibration-lab-hero.png',
  './assets/home-hero-calibration-lab-wide.webp',
  './assets/home-hero-calibration-lab-v2.webp',
  './assets/tiles/01_dashboard.png',
  './assets/tiles/02_instrument_list.png',
  './assets/tiles/03_calibration_tracking.png',
  './assets/tiles/04_cert_number.png',
  './assets/tiles/05_cert_reference.png',
  './assets/tiles/06_calibration_planning.png',
  './assets/tiles/07_daily_scale_record.png',
  './assets/tiles/08_repair.png',
  './assets/tiles/09_offsite_equipment.png',
  './js/00-config.js?v=20260626-config',
  './js/01-core.js?v=20260722-plan-approval',
  './js/02-dashboard.js?v=20260905-date1',
  './js/03-instruments.js?v=20260803-split',
  './js/04-reports.js?v=20260903-plan2',
  './js/05-audit.js?v=20260622-audit-fit',
  './js/06b-import-register.js?v=20260803-split',
  './js/07-notifications.js?v=20260610-notif-cancel-fix',
  './js/08-weights.js?v=20260803-deadcode',
  './js/09-cert.js?v=20260803-deadcode',
  './js/10-router.js?v=20260905-date1',
  './js/12-standard-certs.js?v=20260803-deadcode',
  './js/13-cmc.js?v=20260618-cmc',
  './js/14-cal-presets.js?v=20260630-presetsetup2',
  './js/16-repairs.js?v=20260905-date1',
  './js/18-asset-out.js?v=20260903-plan2',
  './js/22-users.js?v=20260905-date1',
  './js/23-cal-records.js?v=20260905-date1',
  './js/24-home.js?v=20260905-date1',
  './js/25-dashboard-ui.js?v=20260905-date1',
  './js/26-list-ui.js?v=20260905-date1',
  './js/27-asset-out-page.js?v=20260818-gate',
  './js/28-kpi.js?v=20260903-plan2',
  './js/29-calibration-work.js?v=20260905-date1',
  // หน้าสอบเทียบเครื่องชั่ง = งานหลัก เปิดเป็นแท็บใหม่จาก openBalanceCal()
  // จึงต้อง precache เพื่อให้ช่างหน้างานใช้งานได้แม้เครือข่ายไม่พร้อม
  './balance-cal.html',
  './js/balance-cal.js',
  './assets/frm-asset-out-template.xlsx',
  IMPORT_TEMPLATE_SELECTION_SCRIPT
];

async function evictRetiredAssets(cache) {
  const requests = await cache.keys();
  const retired = requests.filter(request => {
    const path = new URL(request.url).pathname;
    return RETIRED_ASSET_PATHS.some(asset => path.endsWith('/' + asset));
  });
  await Promise.all(retired.map(request => cache.delete(request)));
}

/* ธีมมาจาก theme-aqua.css ที่ index.html ลิงก์เองแล้ว (ดีไซน์ Calibration App)
   เดิม SW แทรก theme-midnight-lab.css + ความสูงตายตัวของตาราง list ต่อท้าย </head>
   ซึ่งทับธีมใหม่ จึงถอดออก เหลือแค่แทรกสคริปต์ import template */
async function withAppInjections(response) {
  const html = await response.text();
  const withImportTemplateSelection = html.includes('11-import-template-selection.js')
    ? html
    : html.replace(/<\/body>/i, `<script src="${IMPORT_TEMPLATE_SELECTION_SCRIPT}"></script>\n</body>`);
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(withImportTemplateSelection, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    caches.open(CACHE_NAME).then(evictRetiredAssets)
  ]).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const isFreshAsset = ['script', 'style'].includes(event.request.destination) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .catch(async () => (await caches.match(event.request)) || caches.match('./index.html'))
        .then(response => response ? withAppInjections(response) : Response.error())
    );
    return;
  }
  if (isFreshAsset) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => undefined);
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  // cache-first + เก็บลง cache เมื่อโหลดสำเร็จ
  // เดิมเป็น `cached || fetch(...)` เฉย ๆ คือถ้าไม่ได้อยู่ใน APP_SHELL จะไม่ถูกเก็บเลยตลอดกาล
  // ทำให้ไฟล์หนัก ๆ ต้องยัดใส่ APP_SHELL อย่างเดียวถึงจะใช้ออฟไลน์ได้
  // เก็บเฉพาะ same-origin ที่สำเร็จ — คำขอไปที่ Supabase เป็นคนละ origin จึงไม่ถูกแตะ
  event.respondWith(caches.match(event.request).then(cached => {
    if (cached) return cached;
    return fetch(event.request).then(response => {
      if (url.origin === self.location.origin && response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => undefined);
      }
      return response;
    });
  }));
});
