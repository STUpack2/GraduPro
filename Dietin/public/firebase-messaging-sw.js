/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

// IMPORTANT: Keep in sync with src/lib/firebase.ts
firebase.initializeApp({
  apiKey: "AIzaSyDnGBI6E-unDQ4zDMfHf9qgwMoci6p9e3Q",
  authDomain: "dietin-web.firebaseapp.com",
  projectId: "dietin-web",
  storageBucket: "dietin-web.firebasestorage.app",
  messagingSenderId: "139206279964",
  appId: "1:139206279964:web:60f018e3ede4c0abaeb0d9"
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Dietin'
  const options = {
    body: payload.notification?.body,
    icon: '/11.png',
    data: payload.data || {},
    badge: '/11.png',
  }
  self.registration.showNotification(title, options)
})
