import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';
import {
  ForecastDay,
  HourlyPoint,
  formatHourLabel,
  SHORT_AXIS_LABELS,
} from '@/api/forecast-mock';

import {
  DataCard,
  HourlyBars,
  TimeScrubber,
  CompassThumbnail,
  ScrubTrack,
  FORECAST_TOKENS,
} from './components';

const { HEADER_COLOR, SUB_COLOR, AXIS_COLOR, SCRUBBER_COLOR } = FORECAST_TOKENS;

const CARD_INNER_WIDTH = 360 - 32; // approx — rendered cards size to parent

type CardProps = {
  day: ForecastDay;
  scrubberHour: number;
  onScrub?: (hour: number) => void;
  spotCoords?: { lat: number; lon: number };
};

// ─── VisibilityCard ─────────────────────────────────────────────────
export function VisibilityCard({ day, scrubberHour, onScrub }: CardProps) {
  const point = day.hourly[scrubberHour];
  return (
    <DataCard header="VISIBILITY">
      <View style={cardStyles.headerRow}>
        <Text style={cardStyles.bigValue}>{point.visibilityFt}</Text>
        <Text style={cardStyles.unit}>ft</Text>
      </View>
      <Text style={cardStyles.scrubberLabel}>{formatHourLabel(scrubberHour)}</Text>
      <HourlyBars
        hourly={day.hourly}
        pickValue={(h) => h.visibilityFt}
        scrubberHour={scrubberHour}
        onScrub={onScrub}
        height={70}
      />
    </DataCard>
  );
}

// ─── WindCard ───────────────────────────────────────────────────────
export function WindCard({ day, scrubberHour, onScrub, spotCoords }: CardProps) {
  const point = day.hourly[scrubberHour];
  return (
    <DataCard header="WIND">
      <View style={cardStyles.headerRowSplit}>
        <View>
          <View style={cardStyles.headerRow}>
            <Text style={cardStyles.bigValue}>{point.windMph}</Text>
            <Text style={cardStyles.unit}>mph</Text>
          </View>
          <Text style={cardStyles.subtle}>gusts {point.windGustMph} mph</Text>
        </View>
        <CompassThumbnail bearing={point.windDeg} spotCoords={spotCoords} />
      </View>
      <Text style={cardStyles.scrubberLabel}>{formatHourLabel(scrubberHour)}</Text>
      <HourlyBars
        hourly={day.hourly}
        pickValue={(h) => h.windMph}
        scrubberHour={scrubberHour}
        onScrub={onScrub}
        height={70}
        barColor="rgba(26,184,255,0.85)"
        fadedColor="rgba(26,184,255,0.32)"
      />
      <View style={cardStyles.directionRow}>
        {[0, 4, 8, 12, 16, 20].map((h) => {
          const pt = day.hourly[h];
          return (
            <Text key={h} style={cardStyles.directionLabel}>
              {bearingToCardinal(pt.windDeg)}
            </Text>
          );
        })}
      </View>
    </DataCard>
  );
}

// ─── CurrentCard ────────────────────────────────────────────────────
export function CurrentCard({ day, scrubberHour, spotCoords }: CardProps) {
  const point = day.hourly[scrubberHour];
  return (
    <DataCard header="CURRENT">
      <View style={cardStyles.headerRowSplit}>
        <View>
          <View style={cardStyles.headerRow}>
            <Text style={cardStyles.bigValue}>{point.currentMph.toFixed(1)}</Text>
            <Text style={cardStyles.unit}>mph</Text>
          </View>
          <Text style={cardStyles.subtle}>{bearingToCardinal(point.currentDeg)} flow</Text>
        </View>
        <CompassThumbnail bearing={point.currentDeg} spotCoords={spotCoords} />
      </View>
      <View style={cardStyles.currentGrid}>
        {[3, 6, 9, 12, 15, 18, 21].map((h) => {
          const pt = day.hourly[h];
          const isNear = Math.abs(h - scrubberHour) <= 1;
          return (
            <View key={h} style={cardStyles.currentCol}>
              <Text style={[cardStyles.currentArrow, isNear && { color: colors.accent }]}>
                {arrowFor(pt.currentDeg)}
              </Text>
              <Text style={[cardStyles.currentVal, isNear && { color: '#fff' }]}>
                {pt.currentMph.toFixed(1)}
              </Text>
              <Text style={cardStyles.currentGust}>
                {pt.windGustMph}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={cardStyles.axisRow}>
        {SHORT_AXIS_LABELS.filter((_, i) => i % 3 === 0).map((lbl, i) => (
          <Text key={i} style={cardStyles.axisLabel}>
            {lbl}
          </Text>
        ))}
      </View>
    </DataCard>
  );
}

// ─── TideCard ───────────────────────────────────────────────────────
export function TideCard({ day, scrubberHour, onScrub }: CardProps) {
  const W = CARD_INNER_WIDTH;
  const H = 110;
  const pad = 8;
  const minTide = Math.min(...day.hourly.map((h) => h.tideFt)) - 0.2;
  const maxTide = Math.max(...day.hourly.map((h) => h.tideFt)) + 0.2;
  const tideRange = Math.max(0.1, maxTide - minTide);
  const xFor = (h: number) => pad + ((W - pad * 2) * h) / 23;
  const yFor = (ft: number) => H - pad - ((H - pad * 2) * (ft - minTide)) / tideRange;

  // Smooth cubic-bezier path — control points at the midpoint between
  // each hour, with the previous y for the leading control and the
  // current y for the trailing control. Same trick as TideChart.tsx
  // on the Overview tab.
  let pathD = '';
  day.hourly.forEach((p, i) => {
    const x = xFor(p.hour24);
    const y = yFor(p.tideFt);
    if (i === 0) {
      pathD = `M ${x} ${y}`;
      return;
    }
    const prev = day.hourly[i - 1];
    const px = xFor(prev.hour24);
    const py = yFor(prev.tideFt);
    const cx = (px + x) / 2;
    pathD += ` C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  });
  const fillD = `${pathD} L ${xFor(23)} ${H - pad} L ${xFor(0)} ${H - pad} Z`;

  const nowPoint = day.hourly[scrubberHour];
  const nowX = xFor(scrubberHour);
  const nowY = yFor(nowPoint.tideFt);

  // Minimal axis: 6 AM, 12 PM, NOW, 6 PM, 12 AM. NOW reads from the
  // scrubber so the label tracks user drags.
  const axis = [
    { hour: 6, label: '6 AM' },
    { hour: 12, label: '12 PM' },
    { hour: scrubberHour, label: 'NOW', isNow: true },
    { hour: 18, label: '6 PM' },
    { hour: 23, label: '12 AM' },
  ];

  return (
    <DataCard header="TIDE">
      <View style={cardStyles.headerRowSplit}>
        <View>
          <View style={cardStyles.headerRow}>
            <Text style={cardStyles.bigValue}>{nowPoint.tideFt > 0 ? '+' : ''}{nowPoint.tideFt.toFixed(1)}</Text>
            <Text style={cardStyles.unit}>ft</Text>
          </View>
          <Text style={cardStyles.subtle}>{day.tideTrend === 'rising' ? '▲ RISING' : '▼ FALLING'}</Text>
        </View>
      </View>

      <ScrubTrack onScrub={onScrub} style={{ marginTop: 12 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <SvgLinearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0C9BFA" stopOpacity={0.32} />
              <Stop offset="1" stopColor="#0C9BFA" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Path d={fillD} fill="url(#tideFill)" />
          <Path d={pathD} stroke="#0C9BFA" strokeWidth={1.8} fill="none" />
          <Line
            x1={nowX}
            y1={pad}
            x2={nowX}
            y2={H - pad}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1}
            strokeDasharray="3,4"
          />
          <Circle cx={nowX} cy={nowY} r={4.5} fill="#0C9BFA" stroke="#ffffff" strokeWidth={1.2} />
        </Svg>
      </ScrubTrack>

      <View style={cardStyles.tideAxisRow}>
        {axis.map((a, i) => (
          <Text
            key={`${a.label}-${i}`}
            style={[cardStyles.tideAxisLabel, a.isNow && { color: '#0C9BFA', fontWeight: '700' }]}
          >
            {a.label}
          </Text>
        ))}
      </View>

      <View style={cardStyles.tideEventsRow}>
        {day.tideEvents.map((evt, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <View style={cardStyles.tideEventDivider} /> : null}
            <View style={cardStyles.tideEventCol}>
              <Text style={cardStyles.tideEventKind}>{evt.type === 'high' ? 'HIGH' : 'LOW'}</Text>
              <Text style={cardStyles.tideEventValueLg}>
                {evt.heightFt > 0 ? '+' : ''}{evt.heightFt.toFixed(1)} ft
              </Text>
              <Text style={cardStyles.tideEventTime}>{evt.timeLabel}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </DataCard>
  );
}

// ─── EnergyCard (Nearshore + Offshore) ──────────────────────────────
export function EnergyCard({ day, scrubberHour, onScrub }: CardProps) {
  const point = day.hourly[scrubberHour];
  return (
    <DataCard>
      <View style={cardStyles.energyRow}>
        <View style={cardStyles.energyCol}>
          <Text style={cardStyles.smallHeader}>NEARSHORE ENERGY</Text>
          <View style={cardStyles.headerRow}>
            <Text style={cardStyles.energyValue}>{point.nearshoreEnergyKj}</Text>
            <Text style={cardStyles.energyUnit}>kJ</Text>
          </View>
          <Text style={cardStyles.subtle}>99% Swell · 1% Windsea</Text>
        </View>
        <View style={cardStyles.energyCol}>
          <Text style={cardStyles.smallHeader}>OFFSHORE ENERGY</Text>
          <View style={cardStyles.headerRow}>
            <Text style={cardStyles.energyValue}>{point.offshoreEnergyKj}</Text>
            <Text style={cardStyles.energyUnit}>kJ</Text>
          </View>
        </View>
      </View>
      <Text style={cardStyles.scrubberLabel}>{formatHourLabel(scrubberHour)}</Text>
      <HourlyBars
        hourly={day.hourly}
        pickValue={(h) => h.nearshoreEnergyKj + h.offshoreEnergyKj}
        scrubberHour={scrubberHour}
        onScrub={onScrub}
        height={60}
        barColor={colors.accent}
        fadedColor="rgba(26,184,255,0.25)"
      />
    </DataCard>
  );
}

// ─── ConsistencyCard ────────────────────────────────────────────────
export function ConsistencyCard({ day, scrubberHour, onScrub }: CardProps) {
  const point = day.hourly[scrubberHour];
  const W = CARD_INNER_WIDTH;
  const H = 70;
  const max = 100;
  let pathD = '';
  day.hourly.forEach((p, i) => {
    const x = (W * i) / 23;
    const y = H - (H * p.consistency) / max;
    pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  return (
    <DataCard header="CONSISTENCY">
      <View style={cardStyles.headerRow}>
        <Text style={cardStyles.bigValue}>{point.consistency}</Text>
        <Text style={cardStyles.consistencyUnit}>/100</Text>
      </View>
      <View style={cardStyles.consistencyBarTrack}>
        <View style={[cardStyles.consistencyBarFill, { width: `${point.consistency}%` }]} />
      </View>
      <ScrubTrack onScrub={onScrub} style={{ marginTop: 8 }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Path
            d={`${pathD} L ${W} ${H} L 0 ${H} Z`}
            fill="rgba(34,197,94,0.18)"
          />
          <Path d={pathD} stroke="#22c55e" strokeWidth={1.6} fill="none" />
        </Svg>
      </ScrubTrack>
      <View style={cardStyles.lowHighRow}>
        <Text style={cardStyles.axisLabel}>Low</Text>
        <Text style={cardStyles.axisLabel}>High</Text>
      </View>
    </DataCard>
  );
}

// ─── WeatherStrip ───────────────────────────────────────────────────
export function WeatherStrip({ day }: { day: ForecastDay }) {
  const samples = [3, 6, 9, 12, 15, 18, 21];
  return (
    <DataCard header="WEATHER">
      <View style={cardStyles.weatherRow}>
        {samples.map((h) => {
          const pt = day.hourly[h];
          return (
            <View key={h} style={cardStyles.weatherCol}>
              <Text style={cardStyles.weatherIcon}>{pt.weatherIcon}</Text>
              <Text style={cardStyles.weatherTemp}>{pt.airTempF}°</Text>
              <Text style={cardStyles.weatherTime}>{labelFor(h)}</Text>
            </View>
          );
        })}
      </View>
    </DataCard>
  );
}

// ─── helpers ────────────────────────────────────────────────────────
function bearingToCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function arrowFor(deg: number): string {
  // 8-way arrow pointing FROM the bearing
  const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
  return arrows[Math.round(deg / 45) % 8];
}

function labelFor(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return 'Noon';
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

const cardStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  headerRowSplit: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  bigValue: { fontSize: 60, fontWeight: '800', color: '#fff', lineHeight: 64, letterSpacing: -2 },
  unit: { fontSize: 15, color: SUB_COLOR, fontWeight: '500' },
  subtle: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 2 },
  scrubberLabel: { fontSize: 11, color: SCRUBBER_COLOR, fontWeight: '500', textAlign: 'center', marginTop: 4 },
  smallHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: HEADER_COLOR,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { fontSize: 9, color: AXIS_COLOR, fontWeight: '500' },
  // Wind direction grid
  directionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  directionLabel: { fontSize: 9, color: AXIS_COLOR, fontWeight: '600' },
  // Current grid
  currentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  currentCol: { alignItems: 'center', gap: 2 },
  currentArrow: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  currentVal: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
  currentGust: { fontSize: 8, color: 'rgba(255,255,255,0.4)' },
  // Tide
  tideAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  tideAxisLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 0.5 },
  tideEventsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  tideEventCol: { flex: 1, alignItems: 'center', gap: 2 },
  tideEventDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  tideEventKind: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700', letterSpacing: 0.8 },
  tideEventValueLg: { fontSize: 14, color: '#fff', fontWeight: '700' },
  tideEventTime: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  // Energy
  energyRow: { flexDirection: 'row', gap: 16 },
  energyCol: { flex: 1 },
  energyValue: { fontSize: 26, color: '#fff', fontWeight: '700' },
  energyUnit: { fontSize: 14, color: SUB_COLOR, fontWeight: '500' },
  // Consistency
  consistencyUnit: { fontSize: 18, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  consistencyBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  consistencyBarFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 2 },
  lowHighRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  // Weather
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  weatherCol: { alignItems: 'center', gap: 4, flex: 1 },
  weatherIcon: { fontSize: 22 },
  weatherTemp: { fontSize: 13, color: '#fff', fontWeight: '600' },
  weatherTime: { fontSize: 10, color: AXIS_COLOR, fontWeight: '500' },
});
