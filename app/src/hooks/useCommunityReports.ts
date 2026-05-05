import { useEffect, useState } from 'react';
import { subscribeToCommunityReports } from '@/services/conditions';
import type { CommunityReport } from '@/types/report';

export function useCommunityReports(spotId: string | null = null) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCommunityReports(spotId, (r) => {
      setReports(r);
      setLoading(false);
    });
    return unsub;
  }, [spotId]);

  return { reports, loading };
}
