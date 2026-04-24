import type { Transaction } from '@/types';
import type {
  NotificationsResponse,
  SpendingInsights,
  TransactionRiskSummary,
  UserNotification,
} from '@/types/activity';
import { apiFetch } from '@/lib/api';

interface TransactionsResponseDto {
  items: Array<{
    id: string;
    type: 'send';
    amount: number;
    fee: number;
    recipientAmount: number;
    recipientName: string;
    recipientPhone: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp: string;
    exchangeRate?: number;
    destinationCurrency?: string;
    category?: string;
    notes?: string;
    risk?: {
      score: number;
      level: 'low' | 'medium' | 'high';
      flags: Array<{ code: string; label: string; severity: 'low' | 'medium' | 'high' }>;
      requiresReview: boolean;
      loggedAt?: string;
    };
  }>;
}

interface SpendingInsightsDto {
  summary: SpendingInsights['summary'];
  monthlyTransferData: Array<{
    month: string;
    sent: number;
    successful: number;
    failed: number;
    count: number;
  }>;
  categoryData: SpendingInsights['categoryData'];
  topExpenses: Array<{
    id: string;
    recipientName: string;
    amount: number;
    category: string;
    timestamp: string;
    status: 'pending' | 'completed' | 'failed';
  }>;
}

interface NotificationsDto {
  items: Array<{
    id: string;
    userId: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    createdAt: string;
    readAt?: string;
    transferId?: string;
    metadata?: Record<string, unknown>;
    deliveries: Array<{
      channel: 'email' | 'sms' | 'in_app';
      status: 'sent' | 'skipped' | 'failed';
      target?: string;
      sentAt?: string;
      reason?: string;
    }>;
  }>;
  unreadCount: number;
}

async function requireJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error || fallbackMessage);
  }

  return body as T;
}

export async function fetchTransactions(limit = 50): Promise<Transaction[]> {
  const response = await apiFetch(`/activity/transactions?limit=${limit}`);
  const body = await requireJson<TransactionsResponseDto>(response, 'Could not load transactions');
  return body.items.map(parseTransactionDto);
}

export async function fetchSpendingInsights(): Promise<SpendingInsights> {
  const response = await apiFetch('/activity/spending-insights');
  const body = await requireJson<SpendingInsightsDto>(response, 'Could not load spending insights');
  return {
    summary: body.summary,
    monthlyTransferData: body.monthlyTransferData,
    categoryData: body.categoryData,
    topExpenses: body.topExpenses.map((expense) => ({
      ...expense,
      timestamp: new Date(expense.timestamp),
    })),
  };
}

export async function fetchNotifications(limit = 10): Promise<NotificationsResponse> {
  const response = await apiFetch(`/notifications?limit=${limit}`);
  const body = await requireJson<NotificationsDto>(response, 'Could not load notifications');
  return {
    unreadCount: body.unreadCount,
    items: body.items.map(parseNotificationDto),
  };
}

export async function markNotificationRead(notificationId: string): Promise<UserNotification> {
  const response = await apiFetch(`/notifications/${notificationId}/read`, { method: 'POST' });
  const body = await requireJson<NotificationsDto['items'][number]>(
    response,
    'Could not mark notification as read',
  );
  return parseNotificationDto(body);
}

function parseTransactionDto(dto: TransactionsResponseDto['items'][number]): Transaction {
  return {
    id: dto.id,
    type: 'send',
    amount: dto.amount,
    fee: dto.fee,
    recipientAmount: dto.recipientAmount,
    recipientName: dto.recipientName,
    recipientPhone: dto.recipientPhone,
    status: dto.status,
    timestamp: new Date(dto.timestamp),
    exchangeRate: dto.exchangeRate,
    destinationCurrency: dto.destinationCurrency,
    category: dto.category,
    notes: dto.notes,
    risk: dto.risk ? parseRiskSummary(dto.risk) : undefined,
  };
}

function parseRiskSummary(dto: NonNullable<TransactionsResponseDto['items'][number]['risk']>): TransactionRiskSummary {
  return {
    score: dto.score,
    level: dto.level,
    flags: dto.flags,
    requiresReview: dto.requiresReview,
    loggedAt: dto.loggedAt ? new Date(dto.loggedAt) : undefined,
  };
}

function parseNotificationDto(dto: NotificationsDto['items'][number]): UserNotification {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    readAt: dto.readAt ? new Date(dto.readAt) : undefined,
    deliveries: dto.deliveries.map((delivery) => ({
      ...delivery,
      sentAt: delivery.sentAt ? new Date(delivery.sentAt) : undefined,
    })),
  };
}
