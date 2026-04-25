import { config } from '../../config';
import type { NotificationService } from '../notifications/notificationService';
import type { TransferRecord } from '../transfers/domain';
import type { TransferRepository } from '../transfers/repository';

export interface ActivityTransactionDto {
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
}

export interface TransactionSearchParams {
  q?: string;
  status?: 'pending' | 'completed' | 'failed';
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  limit?: number;
  offset?: number;
}

export interface SpendingInsightsDto {
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
  monthlyTransferData: Array<{
    month: string;
    sent: number;
    successful: number;
    failed: number;
    count: number;
  }>;
  categoryData: Array<{
    category: string;
    value: number;
    count: number;
  }>;
  topExpenses: Array<{
    id: string;
    recipientName: string;
    amount: number;
    category: string;
    timestamp: string;
    status: 'pending' | 'completed' | 'failed';
  }>;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export class ActivityService {
  private readonly transactionCache = new Map<string, CacheEntry<ActivityTransactionDto[]>>();
  private readonly insightsCache = new Map<string, CacheEntry<SpendingInsightsDto>>();

  constructor(
    private readonly repository: TransferRepository,
    private readonly notifications: NotificationService,
  ) {}

  async listTransactions(userId: string, limit = 50): Promise<ActivityTransactionDto[]> {
    const cacheKey = `${userId}:${limit}`;
    const cached = this.transactionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const records = await this.repository.listRecentByUserId(userId, limit);
    const transactions = records.map((record) => this.toTransactionDto(record));
    this.transactionCache.set(cacheKey, {
      expiresAt: Date.now() + config.performance.activityCacheTtlMs,
      value: transactions,
    });
    return transactions;
  }

  async getSpendingInsights(userId: string): Promise<SpendingInsightsDto> {
    const cached = this.insightsCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const records = await this.repository.listByUserId(userId);
    const transactions = records.map((record) => this.toTransactionDto(record));
    const successfulOrPending = transactions.filter((transaction) => transaction.status !== 'failed');
    const successfulOnly = transactions.filter((transaction) => transaction.status === 'completed');
    const now = new Date();

    const summary = {
      totalSent: round2(successfulOrPending.reduce((sum, transaction) => sum + transaction.amount, 0)),
      totalFees: round2(successfulOrPending.reduce((sum, transaction) => sum + transaction.fee, 0)),
      completedTransfers: transactions.filter((transaction) => transaction.status === 'completed').length,
      pendingTransfers: transactions.filter((transaction) => transaction.status === 'pending').length,
      failedTransfers: transactions.filter((transaction) => transaction.status === 'failed').length,
      flaggedTransfers: transactions.filter(
        (transaction) => transaction.risk && (transaction.risk.requiresReview || transaction.risk.level !== 'low'),
      ).length,
      thisMonthCount: successfulOrPending.filter((transaction) => {
        const transactionDate = new Date(transaction.timestamp);
        return (
          transactionDate.getUTCFullYear() === now.getUTCFullYear() &&
          transactionDate.getUTCMonth() === now.getUTCMonth()
        );
      }).length,
      thisMonthSent: round2(
        successfulOrPending
          .filter((transaction) => {
            const transactionDate = new Date(transaction.timestamp);
            return (
              transactionDate.getUTCFullYear() === now.getUTCFullYear() &&
              transactionDate.getUTCMonth() === now.getUTCMonth()
            );
          })
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      ),
      averageTransfer: round2(
        successfulOnly.length
          ? successfulOnly.reduce((sum, transaction) => sum + transaction.amount, 0) / successfulOnly.length
          : 0,
      ),
      topCategory: undefined as string | undefined,
    };

    const monthlyMap = new Map<string, { month: string; sent: number; successful: number; failed: number; count: number }>();
    transactions.forEach((transaction) => {
      const date = new Date(transaction.timestamp);
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(monthKey) || {
        month: date.toLocaleString('en-US', { month: 'short' }),
        sent: 0,
        successful: 0,
        failed: 0,
        count: 0,
      };

      if (transaction.status !== 'failed') {
        existing.sent += transaction.amount;
      }
      if (transaction.status === 'completed') {
        existing.successful += transaction.amount;
      }
      if (transaction.status === 'failed') {
        existing.failed += transaction.amount;
      }
      existing.count += 1;
      monthlyMap.set(monthKey, existing);
    });

    const categoryMap = new Map<string, { category: string; value: number; count: number }>();
    successfulOrPending.forEach((transaction) => {
      const category = transaction.category || 'General transfers';
      const existing = categoryMap.get(category) || { category, value: 0, count: 0 };
      existing.value += transaction.amount;
      existing.count += 1;
      categoryMap.set(category, existing);
    });

    const categoryData = Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .map((entry) => ({
        ...entry,
        value: round2(entry.value),
      }));

    summary.topCategory = categoryData[0]?.category;

    const insights: SpendingInsightsDto = {
      summary,
      monthlyTransferData: Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([, value]) => ({
          ...value,
          sent: round2(value.sent),
          successful: round2(value.successful),
          failed: round2(value.failed),
        })),
      categoryData,
      topExpenses: successfulOnly
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map((transaction) => ({
          id: transaction.id,
          recipientName: transaction.recipientName,
          amount: transaction.amount,
          category: transaction.category || 'General transfers',
          timestamp: transaction.timestamp,
          status: transaction.status,
        })),
    };

    this.insightsCache.set(userId, {
      expiresAt: Date.now() + config.performance.activityCacheTtlMs,
      value: insights,
    });

    return insights;
  }

  async searchTransactions(
    userId: string,
    params: TransactionSearchParams,
  ): Promise<{ items: ActivityTransactionDto[]; total: number }> {
    const all = await this.repository.listByUserId(userId);
    let results = all.map((r) => this.toTransactionDto(r));

    const q = params.q?.trim().toLowerCase();
    if (q) {
      results = results.filter(
        (t) =>
          t.recipientName.toLowerCase().includes(q) ||
          t.recipientPhone.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q),
      );
    }

    if (params.status) {
      results = results.filter((t) => t.status === params.status);
    }

    if (params.dateFrom) {
      const from = new Date(params.dateFrom).getTime();
      results = results.filter((t) => new Date(t.timestamp).getTime() >= from);
    }

    if (params.dateTo) {
      const to = new Date(params.dateTo).getTime();
      results = results.filter((t) => new Date(t.timestamp).getTime() <= to);
    }

    if (params.amountMin !== undefined) {
      results = results.filter((t) => t.amount >= params.amountMin!);
    }

    if (params.amountMax !== undefined) {
      results = results.filter((t) => t.amount <= params.amountMax!);
    }

    const total = results.length;
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const items = results.slice(offset, offset + limit);

    return { items, total };
  }

  listNotifications(userId: string, limit = 5) {
    return this.notifications.listByUserId(userId, limit);
  }

  invalidateUser(userId: string) {
    this.insightsCache.delete(userId);
    Array.from(this.transactionCache.keys())
      .filter((key) => key.startsWith(`${userId}:`))
      .forEach((key) => this.transactionCache.delete(key));
  }

  private toTransactionDto(record: TransferRecord): ActivityTransactionDto {
    const status =
      record.state === 'settled'
        ? 'completed'
        : record.state === 'failed'
          ? 'failed'
          : 'pending';
    const fees = getFees(record.metadata);
    const identifier = String(record.recipient.metadata?.identifier || '');
    const recipientName = String(record.recipient.metadata?.name || identifier || 'Recipient');
    const destinationCurrency = getDestinationCurrency(record);
    return {
      id: record.id,
      type: 'send',
      amount: round2(record.amount),
      fee: fees.totalFee,
      recipientAmount: round2(Math.max(0, record.amount - fees.totalFee)),
      recipientName,
      recipientPhone: identifier,
      status,
      timestamp: record.createdAt,
      exchangeRate: typeof record.metadata?.exchange_rate === 'number' ? Number(record.metadata.exchange_rate) : undefined,
      destinationCurrency,
      category: getCategory(record, destinationCurrency),
      notes: record.lastError || record.statusHistory[record.statusHistory.length - 1]?.notes,
      risk: record.fraud
        ? {
            score: record.fraud.score,
            level: record.fraud.level,
            flags: record.fraud.flags,
            requiresReview: record.fraud.requiresReview,
            loggedAt: record.fraud.loggedAt,
          }
        : undefined,
    };
  }
}

function getFees(metadata?: Record<string, unknown>) {
  const networkFee = numberFromUnknown(metadata?.network_fee);
  const serviceFee = numberFromUnknown(metadata?.service_fee);
  return {
    networkFee,
    serviceFee,
    totalFee: round2(networkFee + serviceFee),
  };
}

function getDestinationCurrency(record: TransferRecord) {
  const explicitCurrency = typeof record.recipient.metadata?.destination_currency === 'string'
    ? record.recipient.metadata.destination_currency
    : undefined;

  if (explicitCurrency) {
    return explicitCurrency;
  }

  const country = record.recipient.country?.toUpperCase();
  const byCountry: Record<string, string> = {
    MX: 'MXN',
    PH: 'PHP',
    GT: 'GTQ',
    SV: 'USD',
    US: 'USD',
  };

  return country ? byCountry[country] : undefined;
}

function getCategory(record: TransferRecord, destinationCurrency?: string) {
  if (record.recipient.type === 'cash_pickup') {
    return `${destinationCurrency || record.recipient.country || 'Cash'} cash pickup`;
  }
  if (record.recipient.type === 'bank') {
    return `${destinationCurrency || record.recipient.country || 'Bank'} bank transfer`;
  }
  return `${destinationCurrency || 'Wallet'} wallet transfer`;
}

function numberFromUnknown(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
