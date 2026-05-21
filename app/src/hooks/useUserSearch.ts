// Debounced user search hook. Re-fires the Firestore query 250ms
// after the user stops typing so we're not hammering the API on
// every keystroke.

import { useEffect, useState } from 'react';

import { searchUsersByHandle, type UserSearchResult } from '@/api/searchUsers';

const DEBOUNCE_MS = 250;

type State = {
  results: UserSearchResult[];
  loading: boolean;
  query: string;
};

export function useUserSearch(query: string): State {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const trimmed = debounced.trim().replace(/^@+/, '');
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchUsersByHandle(trimmed)
      .then((rows) => {
        if (cancelled) return;
        setResults(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debounced]);

  return { results, loading, query: debounced };
}
