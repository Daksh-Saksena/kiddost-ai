self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'New message', body: event.data.text() }; }

  const title = data.title || 'New message';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.phone || 'kiddost-msg',
    renotify: true,
    data: { phone: data.phone }
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
