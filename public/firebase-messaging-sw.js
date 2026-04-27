// Firebase service worker for handling push notifications
/* eslint-disable no-undef */
/* global self, firebase */

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');

// Initialize Firebase in the service worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notifications when app is in background
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const notificationTitle = data.notification?.title || 'Swift Send';
    const notificationOptions = {
      body: data.notification?.body || 'You have a new notification',
      icon: '/app-icon-192x192.png',
      badge: '/app-badge-72x72.png',
      data: data.data || {},
      tag: 'swift-send-notification',
      requireInteraction: false,
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions),
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let urlToOpen = '/';

  // Route based on notification type
  if (data.type === 'transfer_settled' || data.type === 'transfer_failed') {
    if (data.transferId) {
      urlToOpen = `/history?transferId=${data.transferId}`;
    } else {
      urlToOpen = '/history';
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    }),
  );
});
