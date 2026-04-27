import admin from 'firebase-admin';
import { logger } from '@/logger';
import { config } from '@/config';

interface FirebaseInitOptions {
  projectId: string;
  serviceAccountKey: string;
}

let app: admin.app.App | null = null;
let messaging: admin.messaging.Messaging | null = null;

/**
 * Initialize Firebase Admin SDK.
 * Call this once during app startup if Firebase is configured.
 */
export function initializeFirebase(options?: FirebaseInitOptions): admin.app.App | null {
  try {
    const projectId = options?.projectId || config.firebase.projectId;
    const serviceAccountKeyStr = options?.serviceAccountKey || config.firebase.serviceAccountKey;

    if (!projectId || !serviceAccountKeyStr) {
      logger.warn('[FCM] Firebase config missing (PROJECT_ID or SERVICE_ACCOUNT_KEY). Push notifications disabled.');
      return null;
    }

    // Parse service account key
    let serviceAccountKey: Record<string, unknown>;
    try {
      serviceAccountKey = JSON.parse(serviceAccountKeyStr);
    } catch {
      logger.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON');
      return null;
    }

    // Initialize Firebase Admin SDK if not already done
    if (!app) {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey as admin.ServiceAccount),
        projectId,
      });
      logger.info(`[FCM] Firebase Admin SDK initialized for project: ${projectId}`);
    }

    messaging = admin.messaging(app);
    return app;
  } catch (error) {
    logger.error('[FCM] Failed to initialize Firebase:', error);
    return null;
  }
}

/**
 * Send a push notification via Firebase Cloud Messaging (FCM).
 * @param deviceToken The FCM device token
 * @param title Notification title
 * @param body Notification body
 * @param data Optional additional data to send with the notification
 * @returns FCM message ID on success, null on failure
 */
export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<string | null> {
  if (!messaging) {
    logger.warn('[FCM] Messaging not initialized. Initialize Firebase first.');
    return null;
  }

  try {
    const message: admin.messaging.Message = {
      token: deviceToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      webpush: {
        notification: {
          title,
          body,
          icon: '/app-icon-192x192.png',
          badge: '/app-badge-72x72.png',
          tag: 'notification', // Group notifications
          requireInteraction: false,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    };

    const messageId = await messaging.send(message);
    logger.debug(`[FCM] Message sent successfully: ${messageId}`);
    return messageId;
  } catch (error) {
    logger.error('[FCM] Failed to send message to device token:', error);
    return null;
  }
}

/**
 * Send a multi-cast push notification to multiple device tokens.
 * @param deviceTokens Array of FCM device tokens
 * @param title Notification title
 * @param body Notification body
 * @param data Optional additional data
 * @returns Object with success count and failed tokens
 */
export async function sendMulticastPushNotification(
  deviceTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ successCount: number; failedTokens: string[] }> {
  if (!messaging) {
    logger.warn('[FCM] Messaging not initialized');
    return { successCount: 0, failedTokens: deviceTokens };
  }

  if (deviceTokens.length === 0) {
    return { successCount: 0, failedTokens: [] };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: deviceTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      webpush: {
        notification: {
          title,
          body,
          icon: '/app-icon-192x192.png',
          badge: '/app-badge-72x72.png',
          tag: 'notification',
          requireInteraction: false,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          title,
          body,
        },
      },
    };

    const response = await messaging.sendMulticast(message);
    const failedTokens: string[] = [];

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        failedTokens.push(deviceTokens[idx]);
      }
    });

    logger.debug(
      `[FCM] Multicast sent: ${response.successCount} succeeded, ${failedTokens.length} failed`,
    );
    return { successCount: response.successCount, failedTokens };
  } catch (error) {
    logger.error('[FCM] Failed to send multicast message:', error);
    return { successCount: 0, failedTokens: deviceTokens };
  }
}

/**
 * Gracefully shut down Firebase connection.
 */
export async function closeFirebase(): Promise<void> {
  if (app) {
    await app.delete();
    app = null;
    messaging = null;
    logger.info('[FCM] Firebase connection closed');
  }
}
