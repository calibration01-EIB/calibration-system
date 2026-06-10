const CACHE_NAME = 'calibration-app-v23';
const THEME_STYLESHEET = './theme-midnight-lab.css';
const IMPORT_TEMPLATE_SELECTION_SCRIPT = './js/11-import-template-selection.js';
const LIST_HEIGHT_STYLE = `<style id="codex-list-height-fix">
@media (min-width: 769px) {
  body.app-mode #app #pageList .table-wrap,
  body.app-mode #pageList .table-wrap {
    height: clamp(390px, calc(100vh - 378px), 620px) !important;
    min-height: clamp(390px, calc(100vh - 378px), 620px) !important;
    max-height: clamp(390px, calc(100vh - 378px), 620px) !important;
    overflow: auto !important;
  }
}
</style>`;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  THEME_STYLESHEET,
  './assets/ilc-logo-full.png',
  './assets/ilc-logo-symbol.png',
  './assets/nac-thailand.png',
  './assets/calibration-lab-hero.png',
  './js/01-core.js',
  './js/02-dashboard.js',
  './js/03-instruments.js',
  './js/04-reports.js',
  './js/05-audit.js',
  './js/06-plan.js',
  './js/07-notifications.js',
  './js/08-weights.js',
  './js/09-cert.js',
  './js/10-router.js',
  IMPORT_TEMPLATE_SELECTION_SCRIPT
];

async function withMidnightLabTheme(response) {
  const html = await response.text();
  const hasTheme = html.includes('theme-midnight-lab.css');
  const withTheme = hasTheme
    ? html
    : html
        .replace(/<meta name="theme-color" content="#[^"]*">/i, '<meta name="theme-color" content="#102337">')
        .replace(/<\/head>/i, '<link rel="stylesheet" href="./theme-midnight-lab.css">\n</head>');
  const withListHeight = withTheme.includes('codex-list-height-fix')
    ? withTheme
    : withTheme.replace(/<\/head>/i, `${LIST_HEIGHT_STYLE}\n</head>`);
  const withImportTemplateSelection = withListHeight.includes('11-import-template-selection.js')
    ? withListHeight
    : withListHeight.replace(/<\/body>/i, `<script src="${IMPORT_TEMPLATE_SELECTION_SCRIPT}"></script>\n</body>`);
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
        .then(response => response ? withMidnightLabTheme(response) : Response.error())
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
