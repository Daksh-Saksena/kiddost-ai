const SERVER = 'https://kiddost-ai.onrender.com';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'New message', body: event.data.text() }; }

  const title = data.title || 'New message';
  // Use a unique tag per notification so iOS Safari / PWA never silently overwrites
  // an existing unread notification in Notification Center without a banner/sound.
  const uniqueTag = `${data.phone || 'kiddost-msg'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: uniqueTag,
    renotify: true,
    data: { phone: data.phone }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const options = event.oldSubscription?.options || { userVisibleOnly: true };
        const newSub = event.newSubscription || await self.registration.pushManager.subscribe(options);
        await fetch(`${SERVER}/push-subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSub, agent: null })
        });
      } catch (e) {
        console.warn('[sw] pushsubscriptionchange re-subscribe failed:', e);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const phone = event.notification.data?.phone;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((wins) => {
      const url = phone ? `/?phone=${encodeURIComponent(phone)}` : '/';
      for (const win of wins) {
        if (win.url.includes(self.location.origin) && 'focus' in win) {
          win.postMessage({ type: 'OPEN_CHAT', phone });
          return win.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
