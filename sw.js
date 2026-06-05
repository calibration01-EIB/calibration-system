const CACHE_NAME = 'calibration-app-v5';
const THEME_STYLESHEET = './theme-midnight-lab.css';
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
  './assets/calibration-lab-hero.png'
];

async function withMidnightLabTheme(response) {
  const html = await response.text();
  const hasTheme = html.includes('theme-midnight-lab.css');
  const nextHtml = hasTheme
    ? html
    : html
        .replace(/<meta name="theme-color" content="#[^"]*">/i, '<meta name="theme-color" content="#102337">')
        .replace(/<\/head>/i, '<link rel="stylesheet" href="./theme-midnight-lab.css">\n</head>');
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(nextHtml, {
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
  if (isHtml) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
        .then(response => withMidnightLabTheme(response))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
