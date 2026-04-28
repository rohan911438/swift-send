import { Transaction } from '@/types';

export const COMMON_TAGS = [
  'food',
  'rent',
  'utilities',
  'transport',
  'healthcare',
  'entertainment',
  'shopping',
  'education',
  'salary',
  'investment',
  'transfer',
  'other',
];

export function addTagToTransaction(transaction: Transaction, tag: string): Transaction {
  const tags = new Set(transaction.tags || []);
  tags.add(tag.toLowerCase());
  return {
    ...transaction,
    tags: Array.from(tags),
  };
}

export function removeTagFromTransaction(transaction: Transaction, tag: string): Transaction {
  const tags = new Set(transaction.tags || []);
  tags.delete(tag.toLowerCase());
  return {
    ...transaction,
    tags: Array.from(tags),
  };
}

export function filterTransactionsByTags(
  transactions: Transaction[],
  selectedTags: string[]
): Transaction[] {
  if (selectedTags.length === 0) {
    return transactions;
  }

  return transactions.filter((tx) => {
    const txTags = tx.tags || [];
    return selectedTags.some((tag) => txTags.includes(tag.toLowerCase()));
  });
}

export function getTagsFromTransactions(transactions: Transaction[]): string[] {
  const tagsSet = new Set<string>();
  transactions.forEach((tx) => {
    tx.tags?.forEach((tag) => {
      tagsSet.add(tag);
    });
  });
  return Array.from(tagsSet).sort();
}

export function getTagColorClass(tag: string): string {
  const colorMap: Record<string, string> = {
    food: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    rent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    utilities: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
    transport: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    healthcare: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    entertainment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    shopping: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
    education: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    salary: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
    investment: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
    transfer: 'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-400',
  };
  return colorMap[tag.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
}
