import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  initializeFirebaseMessaging,
  requestNotificationPermissionAndGetToken,
  setupMessageListener,
  removeMessageListener,
} from '@/services/firebaseMessaging';
import { apiFetch } from '@/lib/api';

interface UseNotificationsOptions {
  firebaseConfig?: Record<string, unknown>;
  onNotificationReceived?: (payload: Record<string, unknown>) => void;
}

/**
 * Hook for managing push notifications.
 * Handles Firebase initialization, permission requests, and device token registration.
 */
export function useNotifications({
  firebaseConfig,
  onNotificationReceived,
}: UseNotificationsOptions = {}) {
  const { user } = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const initializeNotifications = async () => {
      try {
        // Initialize Firebase if config provided
        if (firebaseConfig) {
          initializeFirebaseMessaging(firebaseConfig);
        }

        // Check if browser supports notifications
        if (!('Notification' in window)) {
          console.log('[Notifications] Browser does not support notifications');
          return;
        }

        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) {
          console.log('[Notifications] Service workers not supported');
          return;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
          { scope: '/' },
        );
        console.log('[Notifications] Service worker registered');

        // Request permission and get token if not already granted
        if (Notification.permission === 'granted') {
          // Permission already granted, get the token
          const token = await requestNotificationPermissionAndGetToken();
          if (token) {
            await registerDeviceToken(token, 'web');
          }
        } else if (Notification.permission === 'default') {
          // Permission not yet determined, request it
          const token = await requestNotificationPermissionAndGetToken();
          if (token) {
            await registerDeviceToken(token, 'web');
          }
        } else {
          console.log('[Notifications] Notification permission denied');
        }

        // Setup message listener for foreground notifications
        const unsubscribe = setupMessageListener((payload) => {
          console.log('[Notifications] Notification received:', payload);
          if (onNotificationReceived) {
            onNotificationReceived(payload);
          }

          // Show in-app notification
          const notification = payload.notification as Record<string, string> | undefined;
          if (notification?.title && notification?.body) {
            showInAppNotification(notification.title, notification.body);
          }
        });

        cleanupRef.current = unsubscribe ? () => removeMessageListener(unsubscribe) : null;
      } catch (error) {
        console.error('[Notifications] Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [user, firebaseConfig, onNotificationReceived]);
}

/**
 * Register device token with backend.
 */
async function registerDeviceToken(
  token: string,
  platform: 'web' | 'ios' | 'android',
): Promise<void> {
  try {
    const response = await apiFetch('/device-tokens/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        platform,
        metadata: {
          model: getPlatformModel(),
          osVersion: getPlatformVersion(),
          appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
        },
      }),
    });

    if (response.ok) {
      console.log('[Notifications] Device token registered successfully');
    } else {
      console.error('[Notifications] Failed to register device token');
    }
  } catch (error) {
    console.error('[Notifications] Error registering device token:', error);
  }
}

/**
 * Show an in-app notification toast.
 */
function showInAppNotification(title: string, body: string): void {
  // This can be enhanced to show a toast or other in-app notification UI
  console.log(`[Notifications] In-app: ${title} - ${body}`);

  // If you have a toast library (like sonner), you can use it here:
  // toast.success(`${title}: ${body}`);
}

/**
 * Get platform model information.
 */
function getPlatformModel(): string {
  try {
    const ua = navigator.userAgent;
    if (ua.includes('iPhone')) {
      return 'iPhone';
    }
    if (ua.includes('iPad')) {
      return 'iPad';
    }
    if (ua.includes('Android')) {
      return 'Android';
    }
    return 'Web';
  } catch {
    return 'Unknown';
  }
}

/**
 * Get platform OS version.
 */
function getPlatformVersion(): string {
  try {
    const ua = navigator.userAgent;
    const match = ua.match(/OS (\d+[._]\d+([._]\d+)*)/);
    if (match) {
      return match[1].replace(/_/g, '.');
    }
    const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
    if (winMatch) {
      return `Windows ${winMatch[1]}`;
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}
