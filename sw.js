/* ============================================================
   Notepad26 — Service Worker
   戦略: Cache First（静的アセット） + Network First（HTML）
   ============================================================ */

const CACHE_NAME = 'notepad26-v1';

// キャッシュする静的アセット
const CACHE_BASE = self.registration.scope; // 例: https://...github.io/HTML-Browser-Notepad/

const STATIC_ASSETS = [
  CACHE_BASE,
  CACHE_BASE + 'index.html',
  CACHE_BASE + 'favicon.ico',
  CACHE_BASE + 'favicon-32.png',
  CACHE_BASE + 'favicon-192.png',
  CACHE_BASE + 'apple-touch-icon.png',
  CACHE_BASE + 'manifest.json',
];

// インストール: 静的アセットを事前キャッシュ
self.addEventListener('install', function(event) {
  console.log('[SW] install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', function(event) {
  console.log('[SW] activate');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// フェッチ戦略
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // 外部リクエスト（Google Fonts, Wikipedia など）はスルー
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML は Network First
  if (event.request.headers.get('accept') &&
      event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 静的アセットは Cache First
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      });
    })
  );
});
