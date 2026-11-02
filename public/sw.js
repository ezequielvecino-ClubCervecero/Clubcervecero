// Service worker minimo: hace que la app sea instalable. No guarda nada en cache,
// asi cada publicacion nueva se ve apenas se recarga.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
