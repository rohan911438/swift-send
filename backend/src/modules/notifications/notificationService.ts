import { getSession } from '../../auth/sessionStore';
import type { EventBus } from '../../core/eventBus';
import { deviceTokenService } from './deviceTokenService';
import { sendMulticastPushNotification } from '../../utils/fcmMessaging';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationChannel = 'email' | 'sms' | 'in_app';
export type NotificationStatus = 'sent' | 'skipped' | 'failed';

export interface NotificationDelivery {
  channel: NotificationChannel;
  status: NotificationStatus;
  target?: string;
  sentAt?: string;
  reason?: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  transferId?: string;
  metadata?: Record<string, unknown>;
  deliveries: NotificationDelivery[];
}

export class NotificationService {
  private readonly store = new Map<string, UserNotification[]>();

  constructor(
    private readonly eventBus: EventBus,
    initialNotifications: UserNotification[] = [],
  ) {
    initialNotifications.forEach((notification) => {
      const list = this.store.get(notification.userId) || [];
      list.push(notification);
      this.store.set(notification.userId, this.sortNotifications(list));
    });
  }

  listByUserId(userId: string, limit = 10) {
    const items = (this.store.get(userId) || []).slice(0, Math.max(0, limit));
    return {
      items,
      unreadCount: (this.store.get(userId) || []).filter((item) => !item.readAt).length,
    };
  }

  markAsRead(userId: string, notificationId: string) {
    const notifications = this.store.get(userId) || [];
    const nextItems = notifications.map((item) =>
      item.id === notificationId && !item.readAt
        ? { ...item, readAt: new Date().toISOString() }
        : item,
    );
    this.store.set(userId, nextItems);
    void this.eventBus.publish({
      type: 'notification.read',
      timestamp: new Date().toISOString(),
      payload: { userId, notificationId },
    });
    return nextItems.find((item) => item.id === notificationId) || null;
  }

  async notifyTransferSettled(payload: {
    userId: string;
    transferId: string;
    amount: number;
    recipientName: string;
  }) {
    return this.createForUser(payload.userId, {
      transferId: payload.transferId,
      type: 'success',
      title: 'Transfer confirmed',
      message: `$${payload.amount.toFixed(2)} to ${payload.recipientName} completed successfully.`,
      metadata: { kind: 'transfer_settled' },
    });
  }

  async notifyTransferFailed(payload: {
    userId: string;
    transferId: string;
    amount: number;
    recipientName: string;
    error?: string;
  }) {
    return this.createForUser(payload.userId, {
      transferId: payload.transferId,
      type: 'error',
      title: 'Transfer failed',
      message: `We could not deliver $${payload.amount.toFixed(2)} to ${payload.recipientName}. ${payload.error || 'Your funds were returned to your wallet.'}`,
      metadata: { kind: 'transfer_failed' },
    });
  }

  async notifyFraudFlagged(payload: {
    userId: string;
    transferId: string;
    score: number;
    flags: string[];
  }) {
    return this.createForUser(payload.userId, {
      transferId: payload.transferId,
      type: 'warning',
      title: 'Transfer flagged for review',
      message: `We detected unusual activity on a recent transfer. Risk score ${payload.score}/100. ${payload.flags.join(', ')}`,
      metadata: { kind: 'fraud_flagged', flags: payload.flags, score: payload.score },
    });
  }

  private async createForUser(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      message: string;
      transferId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const createdAt = new Date().toISOString();
    const notification: UserNotification = {
      id: `notification_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      createdAt,
      transferId: input.transferId,
      metadata: input.metadata,
      deliveries: this.buildDeliveries(userId, createdAt),
    };

    const items = this.store.get(userId) || [];
    this.store.set(userId, this.sortNotifications([notification, ...items]));

    void this.eventBus.publish({
      type: 'notification.created',
      timestamp: createdAt,
      payload: {
        userId,
        notificationId: notification.id,
        type: notification.type,
      },
    });

    await this.sendPushNotification(notification);
    return notification;
  }

  private async sendPushNotification(notification: UserNotification) {
    try {
      const tokens = await deviceTokenService.getActiveTokenStrings(notification.userId);
      if (tokens.length === 0) {
        return;
      }

      const pushData = {
        type: String(notification.metadata?.kind || notification.type),
        transferId: notification.transferId || '',
        notificationId: notification.id,
      };

      const result = await sendMulticastPushNotification(
        tokens,
        notification.title,
        notification.message,
        pushData,
      );

      if (result.failedTokens.length > 0) {
        await Promise.all(
          result.failedTokens.map((token) => deviceTokenService.deactivateDeviceToken(token)),
        );
      }
    } catch (error) {
      console.error('failed to send push notification', error);
    }
  }

  private buildDeliveries(userId: string, timestamp: string): NotificationDelivery[] {
    const session = getSession(userId);
    const deliveries: NotificationDelivery[] = [
      { channel: 'in_app', status: 'sent', sentAt: timestamp },
    ];

    if (session?.email) {
      deliveries.push({
        channel: 'email',
        status: 'sent',
        sentAt: timestamp,
        target: session.email,
      });
    } else {
      deliveries.push({
        channel: 'email',
        status: 'skipped',
        reason: 'No email on file',
      });
    }

    if (session?.phone) {
      deliveries.push({
        channel: 'sms',
        status: 'sent',
        sentAt: timestamp,
        target: session.phone,
      });
    } else {
      deliveries.push({
        channel: 'sms',
        status: 'skipped',
        reason: 'No phone number on file',
      });
    }

    return deliveries;
  }

  private sortNotifications(items: UserNotification[]) {
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
