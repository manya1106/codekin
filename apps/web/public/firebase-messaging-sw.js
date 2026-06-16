importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

let messagingInitialized = false;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !messagingInitialized) {
    try {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || 'Codekin';
        const options = {
          body: payload.notification?.body || 'You have a new notification',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        };
        self.registration.showNotification(title, options);
      });

      messagingInitialized = true;
    } catch (err) {
      console.error('[firebase-messaging-sw] Init error:', err);
    }
  }
});
