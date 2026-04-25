export type RecurringPaymentFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface RecurringPaymentSchedule {
  id: string;
  userId: string;
  senderWallet: string;
  recipientWallet: string;
  amount: number;
  currency: string;
  frequency: RecurringPaymentFrequency;
  frequencySeconds: number;
  nextRunAt: string;
  lastRunAt?: string;
  endDate: string;
  status: 'active' | 'cancelled' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringPaymentCommand {
  userId: string;
  fromWalletId: string;
  recipientWallet: string;
  amount: number;
  currency: string;
  frequency: RecurringPaymentFrequency;
  customFrequencySeconds?: number;
  endDate: string;
  metadata?: Record<string, any>;
}

export function frequencyToSeconds(frequency: RecurringPaymentFrequency, custom?: number): number {
  switch (frequency) {
    case 'daily':
      return 24 * 60 * 60;
    case 'weekly':
      return 7 * 24 * 60 * 60;
    case 'monthly':
      return 30 * 24 * 60 * 60; // Approximation
    case 'custom':
      return custom || 0;
    default:
      return 0;
  }
}
