import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging'
import { app } from './firebase'

let messaging: Messaging | null = null

export const ensureMessaging = async () => {
  if (!(await isSupported())) return null
  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

export const requestPushPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied'
  return await Notification.requestPermission()
}

export const subscribePush = async (): Promise<string | null> => {
  try {
    const msg = await ensureMessaging()
    if (!msg) return null
    const vapid = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
    if (!vapid) {
      console.warn('VITE_FIREBASE_VAPID_KEY is not set — web push will be disabled')
      return null
    }
    const token = await getToken(msg, { vapidKey: vapid, serviceWorkerRegistration: await navigator.serviceWorker.ready })
    return token
  } catch (e) {
    console.error('subscribePush error', e)
    return null
  }
}

export const listenForegroundMessages = async (cb: (payload: any) => void) => {
  const msg = await ensureMessaging()
  if (!msg) return () => {}
  return onMessage(msg, cb)
}
