const CACHE_NAME = 'suanpiji-v10';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  // 强制新的 Service Worker 立即接管，跳过等待状态
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  // 立即接管所有客户端页面
  event.waitUntil(self.clients.claim());
  
  // 清理旧版本的缓存
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // 只处理 GET 请求的缓存
  if (event.request.method !== 'GET') return;

  // 采用网络优先 (Network First) 策略，失败则回退到缓存
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 检查是否是有效的响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // 网络请求成功，将新数据克隆一份放到缓存里，然后返回新数据
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // 网络请求失败（离线或网络极差），尝试从缓存中读取
        return caches.match(event.request);
      })
  );
});

// 监听后台推送点击事件，唤醒应用
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 如果应用已经打开，就聚焦它
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url && client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // 如果没打开，就打开新窗口
      if (clients.openWindow) {
        // 使用相对路径确保基于 PWA 的 start_url 打开
        return clients.openWindow('./');
      }
    })
  );
});
