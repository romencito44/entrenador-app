/* Service worker: que la app abra sin cobertura (gimnasios en sótano).
   · Archivos de la app (mismo origen): red primero y copia en caché; sin red, la caché.
   · SDK de Firebase (gstatic, versión fija e inmutable): caché primero.
   · Todo lo demás (Firestore, Google Auth…) no se toca: Firestore tiene su propia
     caché offline y sus conexiones no deben acabar en esta caché.
   Sube CACHE cuando cambies la lista de archivos o la versión del SDK. */
const CACHE = 'entrenador-v5';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const APP = ['./', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/config.js', './js/util.js', './js/datos.js', './js/biblioteca.js',
  './js/programa.js', './js/progresion.js', './js/andrea.js',
  './js/vistas/comunes.js', './js/vistas/cliente.js', './js/vistas/entrenador.js', './js/vistas/editor.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
const FIREBASE = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => SDK + f);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(APP);
    // El SDK se intenta precachear, pero si falla no impide instalar la app.
    await Promise.all(FIREBASE.map(u => c.add(u).catch(() => {})));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.url.startsWith(SDK)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    })));
    return;
  }

  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(fetch(req).then(res => {
    // Se clona antes de devolverla: después el navegador ya habrá consumido el cuerpo.
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
