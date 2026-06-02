// useNwsAlerts — fetches active National Weather Service marine
// alerts for the Hawaiian coastal waters and the inland forecast
// zones a charter operator cares about. api.weather.gov is a public
// JSON API with permissive CORS (no key required) so we can hit it
// straight from the browser.
//
// We poll on a 10-minute interval — alerts don't change faster than
// that in practice and api.weather.gov asks clients to back off when
// hammering. The fetch is also rerun when the page becomes visible
// after being hidden (returning to the tab after coffee shouldn't
// show stale alerts).
//
// Returns a list of alert summaries safe to render in a single chip
// per alert; the user expands one to see the full description.

import React from 'react';

/** Hawaii marine + coastal zone codes. NWS Honolulu issues most of
 *  the marine product on these — the trade-wind belt, the leeward
 *  channels between islands, and the offshore high-seas zones a
 *  charter would never venture into but might pass through on a
 *  Molokini run. Adding more zones is a one-line change. */
const HAWAII_ZONES = [
  // Marine zones — coastal waters surrounding each main island
  'PHZ110', // Kauai Windward
  'PHZ111', // Kauai Leeward
  'PHZ112', // Oahu Windward
  'PHZ113', // Oahu Leeward
  'PHZ114', // Maui County Windward
  'PHZ115', // Maui County Leeward
  'PHZ116', // Big Island Windward
  'PHZ117', // Big Island Leeward
];

export interface NwsAlert {
  id: string;
  /** "Small Craft Advisory", "High Surf Warning", "Tsunami Watch", … */
  event: string;
  /** One-line headline. */
  headline: string;
  /** Full text. */
  description: string;
  /** ISO timestamp of when the alert was issued. */
  sent: string;
  /** ISO timestamp of when the alert expires. */
  expires: string;
  /** 'Minor' | 'Moderate' | 'Severe' | 'Extreme' — used to color the chip. */
  severity: string;
  /** Which zones the alert applies to (intersect of HAWAII_ZONES + alert's zones). */
  affectedZones: string[];
}

export type NwsAlertsState = {
  alerts: NwsAlert[];
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
};

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useNwsAlerts(): NwsAlertsState {
  const [state, setState] = React.useState<NwsAlertsState>({
    alerts: [],
    loading: true,
    error: null,
    lastFetched: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      if (cancelled) return;
      try {
        // api.weather.gov accepts a comma-separated zone list on the
        // `zone` query param. Fewer requests than one-per-zone.
        const url = `https://api.weather.gov/alerts/active?zone=${HAWAII_ZONES.join(',')}`;
        const res = await fetch(url, {
          headers: {
            // NWS asks for a UA identifying the client; without one
            // they sometimes 403. The convention is `app-name (contact)`.
            'User-Agent': 'KaiCast Charter (charter-support@kaicast.app)',
            'Accept': 'application/geo+json',
          },
        });
        if (!res.ok) throw new Error(`NWS ${res.status}`);
        const json = await res.json() as { features?: Array<Record<string, unknown>> };
        const alerts: NwsAlert[] = (json.features ?? [])
          .map((f) => parseAlertFeature(f))
          .filter((a): a is NwsAlert => a !== null)
          // De-dupe — NWS sometimes emits the same alert under multiple
          // zone-level entries; we collapse on `id` (the @id URI).
          .reduce<NwsAlert[]>((acc, cur) => {
            if (!acc.some((a) => a.id === cur.id)) acc.push(cur);
            return acc;
          }, []);
        if (!cancelled) {
          setState({ alerts, loading: false, error: null, lastFetched: new Date() });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: (err as Error).message || 'NWS fetch failed',
          }));
        }
      }
    };

    fetchAll();
    const t = setInterval(fetchAll, POLL_INTERVAL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') fetchAll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return state;
}

function parseAlertFeature(f: Record<string, unknown>): NwsAlert | null {
  const props = f.properties as Record<string, unknown> | undefined;
  if (!props) return null;
  const id = String(f.id ?? props.id ?? '');
  if (!id) return null;
  const affectedZonesRaw = props.affectedZones as string[] | undefined;
  const affectedZones = (affectedZonesRaw ?? [])
    .map((zUri) => zUri.split('/').pop() || '')
    .filter((code) => HAWAII_ZONES.includes(code));
  return {
    id,
    event:       String(props.event ?? 'Marine Alert'),
    headline:    String(props.headline ?? props.event ?? ''),
    description: String(props.description ?? ''),
    sent:        String(props.sent ?? ''),
    expires:     String(props.expires ?? ''),
    severity:    String(props.severity ?? 'Unknown'),
    affectedZones,
  };
}
