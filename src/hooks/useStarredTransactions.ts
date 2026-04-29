import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'swift_send_starred_transactions';

export function useStarredTransactions() {
  const [starredIds, setStarredIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const persisted = window.localStorage.getItem(STORAGE_KEY);
      if (persisted) {
        const parsed = JSON.parse(persisted) as string[];
        if (Array.isArray(parsed)) {
          setStarredIds(parsed);
        }
      }
    } catch {
      // Ignore invalid local storage state
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(starredIds));
    } catch {
      // Ignore storage failures silently
    }
  }, [starredIds]);

  const toggleStar = useCallback((transactionId: string) => {
    setStarredIds((current) => {
      if (current.includes(transactionId)) {
        return current.filter((id) => id !== transactionId);
      }
      return [...current, transactionId];
    });
  }, []);

  const isStarred = useCallback(
    (transactionId: string) => starredIds.includes(transactionId),
    [starredIds],
  );

  const starredCount = useMemo(() => starredIds.length, [starredIds]);

  return {
    starredIds,
    starredCount,
    toggleStar,
    isStarred,
  };
}
