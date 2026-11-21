// Pilana ERP Service Worker — Pozadinske Push Notifikacije (Desktop & Mobile)

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let data = {
        title: 'Pilana ERP Obavještenje',
        body: 'Imate novo obavještenje ili zahtjev za odobrenje.',
        tag: 'pilana-erp-notif',
        url: '/',
        notifId: null,
        urgent: false,
    };

    try {
        if (event.data) {
            const parsed = event.data.json();
            data = { ...data, ...parsed };
        }
    } catch (e) {
        try {
            data.body = event.data ? event.data.text() : data.body;
        } catch (err) {}
    }

    const options = {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.tag || 'pilana-erp-notif',
        renotify: true,
        requireInteraction: Boolean(data.urgent),
        vibrate: data.urgent ? [250, 100, 250, 100, 250] : [180, 90, 180],
        data: {
            url: data.url || '/',
            notifId: data.notifId || null,
        },
        actions: [
            { action: 'open', title: 'Otvori u ERP-u' },
        ],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetNotifId = event.notification?.data?.notifId || null;
    const baseUrl = self.location.origin;
    const targetUrl = targetNotifId
        ? `${baseUrl}/?notif=${encodeURIComponent(targetNotifId)}`
        : `${baseUrl}/`;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.startsWith(baseUrl) && 'focus' in client) {
                    if (targetNotifId) {
                        client.postMessage({ type: 'OPEN_NOTIFICATION', notifId: targetNotifId });
                    }
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
