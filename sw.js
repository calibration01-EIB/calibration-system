const CACHE_NAME = 'calibration-app-v126';
const IMPORT_TEMPLATE_SELECTION_SCRIPT = './js/11-import-template-selection.js';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './theme-aqua.css',
  './assets/ilc-logo-full.png',
  './assets/ilc-logo-symbol.png',
  './assets/nac-thailand.png',
  './assets/calibration-lab-hero.png',
  './assets/hero-caliper.png',
  './assets/tiles/01_dashboard.png',
  './assets/tiles/02_instrument_list.png',
  './assets/tiles/03_calibration_tracking.png',
  './assets/tiles/04_cert_number.png',
  './assets/tiles/05_cert_reference.png',
  './assets/tiles/06_calibration_planning.png',
  './assets/tiles/07_daily_scale_record.png',
  './assets/tiles/08_repair.png',
  './assets/tiles/09_offsite_equipment.png',
  './js/00-config.js',
  './js/01-core.js',
  './js/02-dashboard.js',
  './js/03-instruments.js',
  './js/04-reports.js',
  './js/05-audit.js',
  './js/06-plan.js',
  './js/06b-import-register.js',
  './js/07-notifications.js',
  './js/08-weights.js',
  './js/09-cert.js',
  './js/10-router.js',
  './js/24-home.js',
  './js/25-dashboard-ui.js',
  './js/26-list-ui.js',
  './js/27-asset-out-page.js',
  './js/28-kpi.js',
  './js/12-standard-certs.js',
  './js/15-plan-export.js',
  './js/16-repairs.js',
  './js/17-frm-cross-month.js',
  './js/18-asset-out.js',
  './js/19-weight-jobs.js',
  './js/22-users.js',
  './js/23-cal-records.js',
  './weight-cal.html',
  './js/weight-cal.js',
  './js/20-weight-cert-xlsx.js',
  './assets/weight-cert-template.xlsx',
  './assets/frm-eib04-template.xlsx',
  './assets/frm-asset-out-template.xlsx',
  IMPORT_TEMPLATE_SELECTION_SCRIPT
];

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
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const isFreshAsset = ['script', 'style'].includes(event.request.destination) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
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
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
