self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    data = { body: event.data ? event.data.text() : 'Yeni erişim talebi var.' };
  }
  const title = data.title || 'Ares English';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Yeni erişim talebi var.',
    tag: 'ares-access-request',
    renotify: true,
    data: { url: data.url || './ares-admin.html' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './ares-admin.html', self.location.href).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({type:'window', includeUncontrolled:true});
    for (const c of all) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) await c.navigate(target);
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
