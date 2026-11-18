// Service Worker：オフラインでも起動できるようにする
// アプリのファイルを変えたら VERSION を上げると、古いキャッシュが消える
const VERSION = 'v3';
const CACHE = 'netguard-' + VERSION;
const FONT_CACHE = 'netguard-fonts';
const APP_SHELL = [
  '/',
  '/static/css/style.css',
  '/static/js/data.js',
  '/static/js/art.js',
  '/static/js/typing.js',
  '/static/js/core.js',
  '/static/js/music.js',
  '/static/js/story.js',
  '/static/js/tutorial.js',
  '/static/js/hub.js',
  '/static/js/map.js',
  '/static/js/battle.js',
  '/static/js/modes.js',
  '/static/js/app.js',
  '/static/manifest.webmanifest',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts：一度読んだらキャッシュから使う
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (url.origin !== location.origin) return;
  // セーブAPIはキャッシュしない（失敗時はゲーム側が localStorage を使う）
  if (url.pathname.startsWith('/api/')) return;

  // アプリ本体：ネット優先（更新がすぐ反映される）、つながらない時はキャッシュ
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error())))
  );
});
