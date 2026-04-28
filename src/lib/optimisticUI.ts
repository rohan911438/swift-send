import { Transaction } from '@/types';

export function createOptimisticTransaction(baseTransaction: Partial<Transaction>): Transaction {
  return {
    id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: baseTransaction.type || 'send',
    amount: baseTransaction.amount || 0,
    fee: baseTransaction.fee || 0,
    recipientAmount: baseTransaction.recipientAmount || 0,
    recipientName: baseTransaction.recipientName || 'Unknown',
    recipientPhone: baseTransaction.recipientPhone || '',
    status: 'processing',
    timestamp: new Date(),
    isOptimistic: true,
    ...baseTransaction,
  };
}

export function promoteOptimisticTransaction(
  optimisticTx: Transaction,
  realId: string,
  status: 'completed' | 'failed' = 'completed'
): Transaction {
  return {
    ...optimisticTx,
    id: realId,
    isOptimistic: false,
    status: status === 'completed' ? 'completed' : 'failed',
  };
}

export function rollbackOptimisticTransaction(
  transactions: Transaction[],
  optimisticId: string
): Transaction[] {
  return transactions.filter((tx) => tx.id !== optimisticId);
}

export function updateOptimisticTransactionStatus(
  transaction: Transaction,
  status: 'pending' | 'processing' | 'completed' | 'failed'
): Transaction {
  if (!transaction.isOptimistic) {
    return transaction;
  }
  return {
    ...transaction,
    status,
  };
}
