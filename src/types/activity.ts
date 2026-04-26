export interface TransactionRiskFlag {
  code: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TransactionRiskSummary {
  score: number;
  level: 'low' | 'medium' | 'high';
  flags: TransactionRiskFlag[];
  requiresReview: boolean;
  loggedAt?: Date;
}

export interface NotificationDelivery {
  channel: 'email' | 'sms' | 'in_app';
  status: 'sent' | 'skipped' | 'failed';
  target?: string;
  sentAt?: Date;
  reason?: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
  transferId?: string;
  metadata?: Record<string, unknown>;
  deliveries: NotificationDelivery[];
}

export interface SpendingCategory {
  category: string;
  value: number;
  count: number;
}

export interface SpendingMonth {
  month: string;
  sent: number;
  successful: number;
  failed: number;
  count: number;
}

export interface TopExpense {
  id: string;
  recipientName: string;
  amount: number;
  category: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface SpendingInsights {
  summary: {
    totalSent: number;
    totalFees: number;
    completedTransfers: number;
    pendingTransfers: number;
    failedTransfers: number;
    flaggedTransfers: number;
    thisMonthCount: number;
    thisMonthSent: number;
    averageTransfer: number;
    topCategory?: string;
  };
  monthlyTransferData: SpendingMonth[];
  categoryData: SpendingCategory[];
  topExpenses: TopExpense[];
}

export interface NotificationsResponse {
  items: UserNotification[];
  unreadCount: number;
}
export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface RefundRecord {
  id: string;
  transferId: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  initiatedAt: Date;
  completedAt?: Date;
  recipientName?: string;
}

export interface RefundsResponse {
  items: RefundRecord[];
  total: number;
}

