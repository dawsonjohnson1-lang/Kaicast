// TripDetailDelta — the side-by-side that makes the captain's log
// pay back for the time it took to file. Renders three columns per
// row: what KaiCast forecast, what the captain logged, and the
// computed delta. The delta is what feeds back into the abyss
// calibration layer (Phase 7 work).
//
// `conditionsSnapshot` is captured at trip-creation time by
// CreateTripWizard. For trips created before this lands the snapshot
// is null/sparse — we show "no forecast snapshot" on those rows.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import type { Trip } from './types';

interface DeltaRow {
  label: string;
  forecast: string | number | null;
  actual: string | number | null;
  /** Optional pre-computed delta string ("+5 ft", "matched", "−10°"). */
  delta: string | null;
  /** Color hint for the delta. */
  tone?: 'better' | 'matched' | 'worse';
}

export function TripDetailDelta({ trip }: { trip: Trip }) {
  const log = trip.captainsLog;
  if (!log) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No captain's log on file yet.</Text>
        <Text style={styles.emptyBody}>File one from the "File a log" tab to see the forecast-vs-reality comparison here.</Text>
      </View>
    );
  }
  const forecast = (trip.conditionsSnapshot ?? {}) as Record<string, unknown>;

  // The conditionsSnapshot shape is intentionally loose — it's a
  // captured BackendReport (or a stub from Phase 3's wizard). We
  // pull out the fields we care about defensively.
  const fSwellFt    = pickNum(forecast, 'swellHeightFt', 'swellHtFt', 'swell.heightFt');
  const fWindDesc   = pickStr(forecast, 'windDescription', 'wind.description');
  const fVisFt      = pickNum(forecast, 'visibilityFt', 'visibility.estimatedVisibilityFeet');
  const fWaterTempF = pickNum(forecast, 'waterTempF', 'temperature.waterF');
  const fRating     = pickStr(forecast, 'rating.label', 'rating', 'now.rating.label');

  const rows: DeltaRow[] = [
    {
      label: 'Swell height',
      forecast: fmtNum(fSwellFt, 'ft'),
      actual:   fmtNum(log.surfaceConditions.swellHtActual, 'ft'),
      ...computeNumDelta(fSwellFt, log.surfaceConditions.swellHtActual, 'ft'),
    },
    {
      label: 'Wind',
      forecast: fWindDesc ?? '—',
      actual:   log.surfaceConditions.windActual || '—',
      delta: null,
    },
    {
      label: 'Underwater visibility',
      forecast: fmtNum(fVisFt, 'ft'),
      actual:   fmtNum(log.underwaterConditions.visFt, 'ft'),
      ...computeNumDelta(fVisFt, log.underwaterConditions.visFt, 'ft'),
    },
    {
      label: 'Water temp',
      forecast: fmtNum(fWaterTempF, '°F'),
      actual:   fmtNum(log.underwaterConditions.tempAtDepthF, '°F'),
      ...computeNumDelta(fWaterTempF, log.underwaterConditions.tempAtDepthF, '°F'),
    },
    {
      label: 'Forecast rating',
      forecast: fRating ?? '—',
      actual:   log.forecastAccuracy === 'matched' ? 'as predicted' :
                log.forecastAccuracy === 'better'  ? 'BETTER than predicted' :
                log.forecastAccuracy === 'worse'   ? 'WORSE than predicted' : '—',
      delta: null,
      tone: log.forecastAccuracy === 'matched' ? 'matched'
          : log.forecastAccuracy === 'better'  ? 'better'
          : log.forecastAccuracy === 'worse'   ? 'worse' : undefined,
    },
  ];

  return (
    <View style={styles.frame}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { flex: 1.2 }]}>FIELD</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>FORECAST</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>CAPTAIN LOGGED</Text>
        <Text style={[styles.headerCell, { flex: 0.8 }]}>DELTA</Text>
      </View>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.dataRow, i === rows.length - 1 && styles.dataRowLast]}>
          <Text style={[styles.cell, styles.labelCell, { flex: 1.2 }]}>{row.label}</Text>
          <Text style={[styles.cell, { flex: 1 }]}>{row.forecast == null ? '—' : String(row.forecast)}</Text>
          <Text style={[styles.cell, styles.actualCell, { flex: 1 }]}>{row.actual == null ? '—' : String(row.actual)}</Text>
          <Text style={[styles.cell, styles.deltaCell, { flex: 0.8, color: deltaColor(row.tone) }]}>
            {row.delta ?? (row.tone ?? '—')}
          </Text>
        </View>
      ))}

      {/* Free text + incident */}
      {log.freeText ? (
        <View style={styles.notesBlock}>
          <Text style={styles.notesLabel}>CAPTAIN'S NOTES</Text>
          <Text style={styles.notesBody}>{log.freeText}</Text>
        </View>
      ) : null}
      {log.incidentFlag !== 'none' ? (
        <View style={[styles.notesBlock, { borderColor: log.incidentFlag === 'serious' ? '#F73726' : '#F5A623', backgroundColor: log.incidentFlag === 'serious' ? 'rgba(247,55,38,0.08)' : 'rgba(245,166,35,0.08)' }]}>
          <Text style={[styles.notesLabel, { color: log.incidentFlag === 'serious' ? '#F73726' : '#F5A623' }]}>
            {log.incidentFlag.toUpperCase()} INCIDENT FLAGGED
          </Text>
          <Text style={styles.notesBody}>The captain flagged this trip with a {log.incidentFlag} incident. Details — if any — are in the notes block above.</Text>
        </View>
      ) : null}

      {/* Customer satisfaction */}
      {log.customerSatisfaction != null ? (
        <View style={styles.satRow}>
          <Text style={styles.satLabel}>Customer satisfaction</Text>
          <Text style={styles.satStars}>{'★'.repeat(log.customerSatisfaction) + '☆'.repeat(5 - log.customerSatisfaction)}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function pickNum(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = dig(obj, k);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = dig(obj, k);
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function dig(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, p) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[p];
  }, obj);
}

function fmtNum(n: number | null | undefined, unit: string): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${Math.round(n * 10) / 10} ${unit}`;
}

function computeNumDelta(forecast: number | null, actual: number | null, unit: string): { delta: string | null; tone?: 'better' | 'matched' | 'worse' } {
  if (forecast == null || actual == null) return { delta: null };
  const diff = actual - forecast;
  if (Math.abs(diff) < 0.5) return { delta: 'matched', tone: 'matched' };
  // For visibility/temp: positive delta is "better", negative is "worse".
  // For swell/wind: positive delta is "worse" (rougher than predicted).
  // We use the unit string as a crude axis flip so callers don't have
  // to remember which side is good for each field.
  const isHigherBetter = unit === 'ft' || unit === '°F'
    ? true   // viz + temp larger = better
    : false;
  const sign = diff > 0 ? '+' : '−';
  const txt = `${sign}${Math.abs(Math.round(diff * 10) / 10)} ${unit}`;
  const tone: 'better' | 'worse' = (diff > 0) === isHigherBetter ? 'better' : 'worse';
  return { delta: txt, tone };
}

function deltaColor(tone?: 'better' | 'matched' | 'worse'): string {
  switch (tone) {
    case 'better':  return '#3DDC84';
    case 'matched': return colors.text2;
    case 'worse':   return '#F73726';
    default:        return colors.text3;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  empty: { padding: 18, borderRadius: radius.md, backgroundColor: colors.surface0, borderWidth: 1, borderColor: colors.hairline },
  emptyTitle: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text1 },
  emptyBody: { fontFamily: fonts.body, fontSize: 13, color: colors.text3, lineHeight: 20, marginTop: 6 },
  frame: { backgroundColor: colors.surface0, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairlineStrong, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', backgroundColor: colors.surface1, borderBottomWidth: 1, borderBottomColor: colors.hairlineStrong, paddingHorizontal: 14, paddingVertical: 10 },
  headerCell: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  dataRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  dataRowLast: { borderBottomWidth: 0 },
  cell: { fontFamily: fonts.body, fontSize: 13, color: colors.text2 },
  labelCell: { fontFamily: fonts.body, fontWeight: '600', color: colors.text1 },
  actualCell: { fontFamily: fonts.mono, color: colors.text1 },
  deltaCell: { fontFamily: fonts.mono, fontWeight: '700', textAlign: 'right' },
  notesBlock: { padding: 14, marginHorizontal: 14, marginBottom: 14, borderRadius: radius.sm, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairline },
  notesLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, fontWeight: '700', letterSpacing: 1 },
  notesBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 6, lineHeight: 18 },
  satRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: colors.hairline },
  satLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },
  satStars: { fontFamily: fonts.display, fontSize: 16, color: colors.accent, letterSpacing: 2 },
});
