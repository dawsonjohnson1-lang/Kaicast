/**
 * Live spot-alerts feed.
 *
 * Reads /spot_alerts filtered by the user's saved spots + currently-
 * selected spot, with live `endMs > now` filtering so expired alerts
 * never reach the UI. Pure read path — alert writers all live in
 * functions/notifications/.
 *
 * Shape mirrors functions/notifications/schema.js. Keep in sync.
 */

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, type Firestore } from 'firebase/firestore';
import { db } from '../firebase';

export type AlertCategory =
  | 'vis_spike' | 'wind_drop' | 'window_open' | 'streak_start' | 'streak_end'
  | 'tide_alignment' | 'spot_of_day'
  | 'brown_water' | 'high_surf' | 'small_craft' | 'box_jelly'
  | 'tsunami' | 'shark_incident' | 'vog';

export type AlertSeverity = 'info' | 'advisory' | 'warning' | 'urgent';

export interface SpotAlert {
  alertId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  affectedSpotIds: string[];
  affectedIslands: string[];
  title: string;
  body: string;
  startMs: number;
  endMs: number;
  source: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

const COLLECTION = 'spot_alerts';

/**
 * Subscribe to live alerts for a list of spot ids. Server-side filter
 * uses array-contains-any (capped at 30 ids by Firestore). Client-side
 * filter drops expired and severity-ranks. Returns the alerts in
 * priority order: tsunami > urgent > warning > advisory > info, then
 * by recency.
 */
export function useSpotAlerts(spotIds: string[]): SpotAlert[] {
  const [alerts, setAlerts] = useState<SpotAlert[]>([]);

  useEffect(() => {
    if (!db || spotIds.length === 0) {
      setAlerts([]);
      return undefined;
    }
    // Firestore array-contains-any cap = 30. We expect <30 saved spots
    // per user in v1; slice if it ever exceeds.
    const ids = spotIds.slice(0, 30);
    const q = query(
      collection(db as Firestore, COLLECTION),
      where('affectedSpotIds', 'array-contains-any', ids),
    );
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const out: SpotAlert[] = [];
      for (const d of snap.docs) {
        const a = d.data() as SpotAlert;
        if (!a || a.endMs <= now) continue;
        out.push({ ...a, alertId: d.id });
      }
      out.sort(byPriority);
      setAlerts(out);
    }, (err) => {
      // eslint-disable-next-line no-console
      console.warn('[spotAlerts] subscription error', err);
      setAlerts([]);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotIds.join(',')]);

  return alerts;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  urgent:   0,
  warning:  1,
  advisory: 2,
  info:     3,
};

const CATEGORY_RANK: Record<AlertCategory, number> = {
  tsunami:        -10, // always first
  shark_incident: -9,
  box_jelly:      -8,
  high_surf:      -7,
  brown_water:    -6,
  vog:            -5,
  small_craft:    -4,
  window_open:    0,
  streak_end:     1,
  vis_spike:      2,
  wind_drop:      3,
  streak_start:   4,
  tide_alignment: 5,
  spot_of_day:    6,
};

function byPriority(a: SpotAlert, b: SpotAlert): number {
  const c = (CATEGORY_RANK[a.category] ?? 99) - (CATEGORY_RANK[b.category] ?? 99);
  if (c !== 0) return c;
  const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (s !== 0) return s;
  return b.startMs - a.startMs; // newer first
}
