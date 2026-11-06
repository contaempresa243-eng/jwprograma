const CACHE_NAME = 'jw-programa-v4';
const assets = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './192.png',
  './512.png'
];

// O Cloudflare Pages redireciona /index.html para /. Uma resposta "redirecionada" guardada
// em cache não pode ser usada numa navegação (dá ERR_FAILED), por isso guarda-se uma cópia limpa.
async function limpa(response) {
  if (!response.redirected) return response;
  const corpo = await response.blob();
  return new Response(corpo, { status: 200, statusText: 'OK', headers: response.headers });
}

async function guardar(cache, url) {
  try {
    const r = await fetch(url, { cache: 'reload' });
    if (r && r.ok) await cache.put(url, await limpa(r));
  } catch (e) { /* ficheiro em falta: os outros ficam em cache na mesma */ }
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(assets.map(url => guardar(cache, url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (para receber atualizações), cache como alternativa offline
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const navegacao = req.mode === 'navigate';

  e.respondWith((async () => {
    try {
      const resp = await fetch(req);
      if (resp && resp.ok && resp.type === 'basic') {
        const copia = await limpa(resp.clone());
        const cache = await caches.open(CACHE_NAME);
        // as navegações (/ ou /index.html) guardam-se sempre como a página principal
        await cache.put(navegacao ? './index.html' : req, copia.clone());
        if (navegacao) await cache.put('./', copia);
      }
      return resp;
    } catch (err) {
      const cache = await caches.open(CACHE_NAME);
      if (navegacao) {
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
               new Response('Sem ligação e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      return (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});
