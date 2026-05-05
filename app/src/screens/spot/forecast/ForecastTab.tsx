import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { buildMockForecast, defaultHourFor } from '@/api/forecast-mock';

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
 * Data flow today: `buildMockForecast()` returns 10 days of synthetic
 * hourly data shaped like the future Firebase response. When the real
 * endpoint lands, replace that call with a `useForecast(spotId)` hook
 * that returns the same `ForecastDay[]` shape — every card is a pure
 * function of `(day, scrubberHour)`, so they don't need to change.
 */
export function ForecastTab() {
  const days = useMemo(() => buildMockForecast(), []);
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

  return (
    <View style={styles.root}>
      <DayStrip days={days} selectedId={selectedId} onSelect={setSelectedId} />

      <View style={{ height: 16 }} />
      <ConditionBanner rating={day.rating} ratingLabel={day.ratingLabel} showLive={day.isToday} />

      <View style={{ height: 16 }} />
      <RatingBar segments={day.ratingSegments} indicatorHour={scrubberHour} />

      <View style={{ height: 16 }} />
      <View style={{ gap: 12 }}>
        <VisibilityCard day={day} scrubberHour={scrubberHour} />
        <WindCard day={day} scrubberHour={scrubberHour} />
        <CurrentCard day={day} scrubberHour={scrubberHour} />
        <TideCard day={day} scrubberHour={scrubberHour} />
        <EnergyCard day={day} scrubberHour={scrubberHour} />
        <ConsistencyCard day={day} scrubberHour={scrubberHour} />
        <WeatherStrip day={day} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
});
