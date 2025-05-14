// sw.js – Basic service worker
self.addEventListener('install', (event) => {
    console.log("sw.js: Service Worker installed.");
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    console.log("sw.js: Service Worker activated.");
  });
  
  self.addEventListener('fetch', (event) => {
    // Optional: can cache responses here
  });
  