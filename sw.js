const CACHE='ares-english-v69';
const BASE='/ares-english/';

const CORE=[
  BASE,
  BASE+'index.html',
  BASE+'speaking.html',
  BASE+'manifest.webmanifest',
  BASE+'apple-touch-icon.png',
  BASE+'icon-192.png',
  BASE+'icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const req = event.request;
  const isPage =
    req.mode === 'navigate' ||
    /\.(?:html?)$/i.test(new URL(req.url).pathname);

  if (isPage) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            r => r || caches.match(BASE + 'index.html')
          )
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      cached =>
        cached ||
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
    )
  );
});
