import { useEffect, useState } from 'react';
import { subscribeToAlerts } from '@/services/conditions';
import type { ConditionAlertDoc } from '@/types/report';

export function useAlerts(spotId: string | null = null) {
  const [alerts, setAlerts] = useState<ConditionAlertDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAlerts(spotId, (a) => {
      setAlerts(a);
      setLoading(false);
    });
    return unsub;
  }, [spotId]);

  return { alerts, loading };
}
