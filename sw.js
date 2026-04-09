const CACHE_NAME = 'calcdivisas-v2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Instalar y guardar en el caché
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting()) // Forzar a activar
    );
});

// Limpiar cachés antiguos al actualizar
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Tomar el control de la app
    );
});

// Estrategia Network-First (Intenta red, si falla usa caché)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
