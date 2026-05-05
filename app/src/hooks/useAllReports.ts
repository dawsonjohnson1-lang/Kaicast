import { useEffect, useState } from 'react';
import { subscribeToAllSpotReports } from '@/services/conditions';
import type { SpotReportDoc } from '@/types/report';

export function useAllReports() {
  const [reports, setReports] = useState<SpotReportDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAllSpotReports((r) => {
      setReports(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { reports, loading };
}
