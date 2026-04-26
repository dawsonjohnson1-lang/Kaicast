import { useCallback, useEffect, useState } from 'react';
import { triggerFetchNow, FetchNowResponse } from '@/api/kaicast';

export function useReports() {
  const [data, setData] = useState<FetchNowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await triggerFetchNow(false);
      setData(r);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return { data, loading, error, refresh };
}
