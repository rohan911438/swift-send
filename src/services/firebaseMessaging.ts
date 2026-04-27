import { initializeApp, FirebaseApp } from 'firebase/app';
import { getMessaging, Messaging, onMessage, getToken } from 'firebase/messaging';

// Your Firebase configuration (will be set at runtime)
let firebaseConfig: Record<string, unknown> | null = null;
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/**
 * Initialize Firebase with the provided config.
 * This should be called once during app startup.
 */
export function initializeFirebaseMessaging(config: Record<string, unknown>): void {
  try {
    if (app) {
      console.warn('[Firebase] Firebase already initialized');
      return;
    }

    firebaseConfig = config;
    app = initializeApp(config);
    messaging = getMessaging(app);
    console.log('[Firebase] Messaging initialized');
  } catch (error) {
    console.error('[Firebase] Failed to initialize messaging:', error);
  }
}

/**
 * Get the Firebase messaging instance.
 */
export function getFirebaseMessaging(): Messaging | null {
  return messaging;
}

/**
 * Request notification permission and get the FCM token.
 * @returns The FCM device token, or null if permission denied or unavailable
 */
export async function requestNotificationPermissionAndGetToken(): Promise<string | null> {
  if (!messaging) {
    console.warn('[Firebase] Messaging not initialized');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Firebase] Notification permission denied');
      return null;
    }

    console.log('[Firebase] Notification permission granted');

    // Get the token for this device
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (token) {
      console.log('[Firebase] FCM token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.log('[Firebase] Failed to obtain FCM token');
      return null;
    }
  } catch (error) {
    console.error('[Firebase] Failed to request permission or get token:', error);
    return null;
  }
}

/**
 * Handle incoming messages (notifications received while app is in foreground).
 * @param callback Function to call with the notification payload
 */
export function setupMessageListener(
  callback: (payload: Record<string, unknown>) => void,
): (() => void) | null {
  if (!messaging) {
    console.warn('[Firebase] Messaging not initialized');
    return null;
  }

  return onMessage(messaging, (payload) => {
    console.log('[Firebase] Message received in foreground:', payload);
    callback(payload);
  });
}

/**
 * Unsubscribe from message listener.
 */
export function removeMessageListener(unsubscribe: (() => void) | null): void {
  if (unsubscribe) {
    unsubscribe();
  }
}
