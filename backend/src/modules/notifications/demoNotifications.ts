import type { UserNotification } from './notificationService';

export function createDemoNotifications(): UserNotification[] {
  const now = Date.now();

  return [
    {
      id: 'notification_demo_success',
      userId: '1',
      type: 'success',
      title: 'Transfer confirmed',
      message: '$500.00 to Rosa Martinez completed successfully.',
      transferId: 'demo_transfer_ph_003',
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
      deliveries: [
        { channel: 'in_app', status: 'sent', sentAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString() },
        { channel: 'email', status: 'sent', sentAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(), target: 'maria.santos@email.com' },
        { channel: 'sms', status: 'sent', sentAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(), target: '+1 (555) 123-4567' },
      ],
      readAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000).toISOString(),
      metadata: { kind: 'transfer_settled' },
    },
    {
      id: 'notification_demo_warning',
      userId: '1',
      type: 'warning',
      title: 'Transfer flagged for review',
      message: 'We detected unusual activity on a recent transfer. Risk score 82/100. High-risk destination corridor, Multiple transfers in 24 hours',
      transferId: 'demo_transfer_review_005',
      createdAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      deliveries: [
        { channel: 'in_app', status: 'sent', sentAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
        { channel: 'email', status: 'sent', sentAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(), target: 'maria.santos@email.com' },
        { channel: 'sms', status: 'sent', sentAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(), target: '+1 (555) 123-4567' },
      ],
      metadata: { kind: 'fraud_flagged', score: 82 },
    },
    {
      id: 'notification_demo_error',
      userId: '1',
      type: 'error',
      title: 'Transfer failed',
      message: 'We could not deliver $780.00 to Security Review. Your funds were returned to your wallet.',
      transferId: 'demo_transfer_review_005',
      createdAt: new Date(now - 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      deliveries: [
        { channel: 'in_app', status: 'sent', sentAt: new Date(now - 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString() },
        { channel: 'email', status: 'sent', sentAt: new Date(now - 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), target: 'maria.santos@email.com' },
        { channel: 'sms', status: 'sent', sentAt: new Date(now - 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), target: '+1 (555) 123-4567' },
      ],
      metadata: { kind: 'transfer_failed' },
    },
  ];
}
