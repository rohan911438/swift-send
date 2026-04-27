import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

/**
 * Component that initializes push notifications when user is authenticated.
 * Should be placed inside AuthProvider and after auth is initialized.
 */
export function NotificationInitializer() {
  const { user } = useAuth();

  // Firebase configuration from environment variables
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const isFirebaseConfigured = Object.values(firebaseConfig).every(
    (value) => value && typeof value === 'string',
  );

  // Initialize notifications
  useNotifications({
    firebaseConfig: isFirebaseConfigured ? firebaseConfig : undefined,
    onNotificationReceived: (payload) => {
      // Handle incoming notifications in foreground
      console.log('Notification received:', payload);
    },
  });

  // Log Firebase config status
  useEffect(() => {
    if (!isFirebaseConfigured) {
      console.warn('[Notifications] Firebase is not configured. Push notifications disabled.');
    }
  }, [isFirebaseConfigured]);

  return null;
}
