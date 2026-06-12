// Live conditions-alert feed.
//
// Derives a list of `ConditionAlert` rows from the spot's BackendReport
// — specifically the analysis fields the server already emits
// (`runoff`, `jellyfish`, plus a few thresholds on the metrics
// snapshot). Falls back to a neutral "checking…" row when no live
// report is available so the dashboard never goes blank.
//
// Once a notification pipeline is wired (FCM + Firestore), this same
// derivation can run server-side and push the highest-severity alert
// to a user's device. Until then, it's purely client-side and only
// shows for spots the user is actively viewing.

import { useMemo } from 'react';

import type { BackendReport } from '@/api/kaicast';
import type { ConditionAlert } from '@/types';

export function useAlerts(spotName: string | undefined, report: BackendReport | null): ConditionAlert[] {
  return useMemo(() => {
    if (!report) {
      // No live report yet (initial mount or fetch failure). Never show
      // mock alerts here — a fabricated hazard for a real spot reads as
      // live data. A single neutral row keeps the section non-blank.
      return [
        {
          id: 'alerts_loading',
          spotName: spotName ?? '',
          severity: 'info',
          message: 'Checking live conditions…',
        },
      ];
    }
    const alerts: ConditionAlert[] = [];
    const now = report.now;
    const runoff = now?.analysis?.runoff;
    const jelly = now?.analysis?.jellyfish;
    const metrics = now?.metrics;

    if (jelly?.jellyfishWarning) {
      alerts.push({
        id: `${report.spot}_jelly`,
        spotName: spotName ?? report.spotName,
        severity: 'hazard',
        message: jelly.jellyfishNote || 'Box jellyfish warning in effect.',
      });
    }

    if (runoff) {
      if (runoff.severity === 'extreme' || runoff.severity === 'high') {
        alerts.push({
          id: `${report.spot}_runoff_high`,
          spotName: spotName ?? report.spotName,
          severity: 'hazard',
          message:
            runoff.drivers[0] ||
            'Heavy runoff — water quality is poor. Consider another spot today.',
        });
      } else if (runoff.severity === 'moderate') {
        alerts.push({
          id: `${report.spot}_runoff_mod`,
          spotName: spotName ?? report.spotName,
          severity: 'warn',
          message: runoff.drivers[0] || 'Some runoff in the area — proceed with care.',
        });
      }
    }

    // Wind-driven hazard: 25+ kts gusts ≈ 28+ mph.
    const gustKts = metrics?.windGustKts ?? null;
    if (gustKts != null && gustKts >= 25) {
      alerts.push({
        id: `${report.spot}_gust`,
        spotName: spotName ?? report.spotName,
        severity: 'warn',
        message: `Strong wind gusts (${Math.round(gustKts * 1.151)} mph) — surface chop will be rough.`,
      });
    }

    // Big-swell signal.
    const waveM = metrics?.waveHeightM ?? null;
    if (waveM != null && waveM >= 2.5) {
      alerts.push({
        id: `${report.spot}_swell`,
        spotName: spotName ?? report.spotName,
        severity: 'warn',
        message: `Large swell incoming (${(waveM * 3.28).toFixed(1)} ft) — entry/exit will be tricky.`,
      });
    }

    if (alerts.length === 0) {
      // Show a friendly "all clear" row instead of an empty list — the
      // dashboard's Condition Alerts section looks broken when empty.
      alerts.push({
        id: `${report.spot}_clear`,
        spotName: spotName ?? report.spotName,
        severity: 'info',
        message: 'All clear — no major hazards detected right now.',
      });
    }
    return alerts;
  }, [report, spotName]);
}
