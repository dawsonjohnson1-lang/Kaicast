import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { defaultHourFor } from '@/api/forecast-mock';
import { useForecast } from '@/hooks/useForecast';
import { colors, typography } from '@/theme';
import type { Spot } from '@/types';

import { DayStrip, RatingBar, ConditionBanner } from './components';
import {
  VisibilityCard,
  WindCard,
  CurrentCard,
  TideCard,
  EnergyCard,
  ConsistencyCard,
  WeatherStrip,
} from './cards';

/**
 * Forecast tab on Spot Detail. Self-contained module — drop this in
 * place of the inline Forecast component in SpotDetailScreen.
 *
 * Time scrubbing: a single `scrubberHour` state lives here; every chart
 * receives it as a prop alongside an `onScrub` callback that writes
 * back to this state. Dragging on any chart's track updates the marker
 * across all of them and the per-card numeric readouts.
 *
 * Data flow today: `buildMockForecast()` returns 10 days of synthetic
 * hourly data shaped like the future Firebase response. When the real
 * endpoint lands, replace that call with a `useForecast(spotId)` hook
 * that returns the same `ForecastDay[]` shape — every card is a pure
 * function of `(day, scrubberHour)`, so they don't need to change.
 */
type ForecastTabProps = {
  spot?: Spot;
  spotCoords?: { lat: number; lon: number };
};

export function ForecastTab({ spot, spotCoords }: ForecastTabProps = {}) {
  // Hook returns 10 days of ForecastDay[]. Day 0 is the live
  // BackendReport when the backend has a SPOTS entry for this spot;
  // otherwise day 0 is the mock baseline (source === 'mock').
  // Days 1–9 are always mock until a multi-day endpoint lands.
  const { days, source } = useForecast(spot);
  const [selectedId, setSelectedId] = useState<string>(days[0].id);

  const day = days.find((d) => d.id === selectedId) ?? days[0];
  // Reset scrubber to the day's default whenever the selected day flips.
  const [scrubberHour, setScrubberHour] = useState<number>(defaultHourFor(day));
  const [scrubberOwnerId, setScrubberOwnerId] = useState<string>(day.id);
  if (scrubberOwnerId !== day.id) {
    // Day changed — re-default the scrubber. (useState lazy-init won't
    // re-run on prop change, so we sync via this guard.)
    setScrubberHour(defaultHourFor(day));
    setScrubberOwnerId(day.id);
  }

  const defaultHour = defaultHourFor(day);
  const isAtDefault = scrubberHour === defaultHour;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <DayStrip days={days} selectedId={selectedId} onSelect={setSelectedId} />
        <View style={styles.headerActions}>
          {source === 'mock' ? (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO</Text>
            </View>
          ) : null}
          {!isAtDefault ? (
            <Pressable
              hitSlop={8}
              onPress={() => setScrubberHour(defaultHour)}
              style={styles.nowBtn}
            >
              <Text style={styles.nowBtnText}>NOW</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ height: 16 }} />
      <ConditionBanner rating={day.rating} ratingLabel={day.ratingLabel} showLive={day.isToday} />

      <View style={{ height: 16 }} />
      <RatingBar segments={day.ratingSegments} indicatorHour={scrubberHour} onScrub={setScrubberHour} />

      <View style={{ height: 16 }} />
      <View style={{ gap: 12 }}>
        <VisibilityCard day={day} scrubberHour={scrubberHour} onScrub={setScrubberHour} />
        <WindCard day={day} scrubberHour={scrubberHour} onScrub={setScrubberHour} spotCoords={spotCoords} />
        <CurrentCard day={day} scrubberHour={scrubberHour} onScrub={setScrubberHour} spotCoords={spotCoords} />
        <TideCard day={day} scrubberHour={scrubberHour} onScrub={setScrubberHour} />
        <EnergyCard day={day} scrubberHour={scrubberHour} onScrub={setScrubberHour} />
        <ConsistencyCard day={day} scrubberHour={scrubberHour} onScrub={setScrubberHour} />
        <WeatherStrip day={day} />
      </View>

      <Text style={styles.attribution}>abyss forecast</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  nowBtnText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: 'rgba(245,176,65,0.35)',
  },
  demoBadgeText: { ...typography.caption, color: colors.warn, fontWeight: '700', fontSize: 9, letterSpacing: 0.8 },
  attribution: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});
