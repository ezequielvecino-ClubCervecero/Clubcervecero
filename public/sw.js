// Service worker: hace que la app sea instalable y muestra los avisos (push).
// No guarda nada en cache, asi cada publicacion nueva se ve apenas se recarga.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { titulo: 'Club Cervecero', cuerpo: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(d.titulo || 'Club Cervecero', {
    body: d.cuerpo || '',
    icon: d.icono || '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
    for (const c of lista) { if ('focus' in c) return c.focus() }
    return self.clients.openWindow(url)
  }))
})
