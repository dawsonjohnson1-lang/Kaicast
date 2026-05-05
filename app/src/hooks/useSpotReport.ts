import { useEffect, useState } from 'react';
import { subscribeToSpotReport } from '@/services/conditions';
import type { SpotReportDoc } from '@/types/report';

export function useSpotReport(spotId: string | null | undefined) {
  const [report, setReport] = useState<SpotReportDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spotId) {
      setReport(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToSpotReport(spotId, (r) => {
      setReport(r);
      setLoading(false);
    });
    return unsub;
  }, [spotId]);

  return { report, loading };
}
