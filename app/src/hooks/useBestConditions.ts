import { useEffect, useState } from 'react';
import { subscribeToBestConditions, BestConditionsDoc } from '@/services/conditions';

export function useBestConditions() {
  const [doc, setDoc] = useState<BestConditionsDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToBestConditions((d) => {
      setDoc(d);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { best: doc, loading };
}
