import { useEffect, useState } from 'react';
import { subscribeToSpot } from '@/services/conditions';
import type { SpotDoc } from '@/types/report';

export function useSpot(spotId: string | null | undefined) {
  const [spot, setSpot] = useState<SpotDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spotId) {
      setSpot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToSpot(spotId, (s) => {
      setSpot(s);
      setLoading(false);
    });
    return unsub;
  }, [spotId]);

  return { spot, loading };
}
