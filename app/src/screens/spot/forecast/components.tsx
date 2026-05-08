import React from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, RATING_FILL_RGBA, RATING_RING_RGBA } from '@/theme';
import {
  ForecastDay,
  ForecastRating,
  HourlyPoint,
  FORECAST_COLOR,
  formatHourLabel,
  SHORT_AXIS_LABELS,
} from '@/api/forecast-mock';

// ─── tokens (matching Figma 180:14394) ──────────────────────────────
const BORDER = 'rgba(255,255,255,0.08)';
const HEADER_COLOR = 'rgba(255,255,255,0.3)';
const SUB_COLOR = 'rgba(255,255,255,0.55)';
const AXIS_COLOR = 'rgba(255,255,255,0.28)';
const SCRUBBER_COLOR = 'rgba(255,255,255,0.45)';

// ─── DayStrip ───────────────────────────────────────────────────────
type DayStripProps = {
  days: ForecastDay[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function DayStrip({ days, selectedId, onSelect }: DayStripProps) {
  return (
    <View>
      <Text style={styles.sectionLabel}>10-DAY FORECAST</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={dayStyles.row}
      >
        {days.map((d) => {
          const active = d.id === selectedId;
          return (
            <Pressable
              key={d.id}
              onPress={() => onSelect(d.id)}
              style={[dayStyles.cell, active && dayStyles.cellActive]}
            >
              <Text style={[dayStyles.label, active && dayStyles.labelActive]}>{d.label}</Text>
              <Text style={[dayStyles.date, active && dayStyles.dateActive]}>{d.date}</Text>
              <Text style={dayStyles.swell}>{d.swellRangeFt}</Text>
              <View style={dayStyles.dotRow}>
                <View style={[dayStyles.dot, { backgroundColor: FORECAST_COLOR[d.amRating] }]} />
                <View style={[dayStyles.dot, { backgroundColor: FORECAST_COLOR[d.midRating] }]} />
                <View style={[dayStyles.dot, { backgroundColor: FORECAST_COLOR[d.pmRating] }]} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── ConditionBanner ────────────────────────────────────────────────
type ConditionBannerProps = {
  rating: ForecastRating;
  ratingLabel: string;
  showLive: boolean;
};

export function ConditionBanner({ rating, ratingLabel, showLive }: ConditionBannerProps) {
  const fg = FORECAST_COLOR[rating];
  return (
    <View
      style={[
        bannerStyles.card,
        { backgroundColor: RATING_FILL_RGBA[rating], borderColor: RATING_RING_RGBA[rating] },
      ]}
    >
      <View style={bannerStyles.dotWrap}>
        <View style={[bannerStyles.dotOuter, { borderColor: fg }]}>
          <View style={[bannerStyles.dotInner, { backgroundColor: fg }]} />
        </View>
      </View>
      <Text style={bannerStyles.label}>{ratingLabel}</Text>
      {showLive ? (
        <View style={[bannerStyles.live, { backgroundColor: RATING_FILL_RGBA[rating], borderColor: RATING_RING_RGBA[rating] }]}>
          <View style={[bannerStyles.liveDot, { backgroundColor: fg }]} />
          <Text style={[bannerStyles.liveText, { color: fg }]}>LIVE</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── RatingBar ──────────────────────────────────────────────────────
type RatingBarProps = {
  segments: { startHour: number; endHour: number; color: string }[];
  indicatorHour: number; // 0–23
  onScrub?: (hour: number) => void;
};

export function RatingBar({ segments, indicatorHour, onScrub }: RatingBarProps) {
  const indicatorPct = (indicatorHour / 24) * 100;
  return (
    <View>
      <Text style={[styles.sectionLabel, { marginTop: 0 }]}>KAICAST RATING</Text>
      <ScrubTrack onScrub={onScrub} style={ratingStyles.trackOuter}>
        <View style={ratingStyles.track} pointerEvents="none">
          {segments.map((seg, i) => {
            const left = (seg.startHour / 24) * 100;
            const width = ((seg.endHour - seg.startHour) / 24) * 100;
            return (
              <View
                key={i}
                style={[
                  ratingStyles.segment,
                  { left: `${left}%`, width: `${width}%`, backgroundColor: seg.color },
                ]}
              />
            );
          })}
        </View>
        <View style={[ratingStyles.indicator, { left: `${indicatorPct}%` }]} pointerEvents="none" />
      </ScrubTrack>
      <View style={ratingStyles.tickRow}>
        {['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p', '12a'].map((t, i) => (
          <Text key={i} style={ratingStyles.tick}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── DataCard frame ─────────────────────────────────────────────────
type DataCardProps = {
  header?: string;
  style?: ViewStyle;
  children: React.ReactNode;
};

export function DataCard({ header, style, children }: DataCardProps) {
  return (
    <View style={[cardStyles.card, style]}>
      {header ? <Text style={styles.sectionLabel}>{header}</Text> : null}
      {children}
    </View>
  );
}

// ─── TimeScrubber (label + drop line) ───────────────────────────────
type TimeScrubberProps = {
  hour: number; // 0–23
  height: number; // height of the drop line in px
  width: number; // width of the chart row, used to position label/line
};

export function TimeScrubber({ hour, height, width }: TimeScrubberProps) {
  const x = (hour / 23) * width;
  return (
    <View style={[scrubberStyles.wrap, { width, height }]} pointerEvents="none">
      <Text style={[scrubberStyles.label, { left: x - 30 }]}>{formatHourLabel(hour)}</Text>
      <View style={[scrubberStyles.line, { left: x, height: height - 18 }]} />
    </View>
  );
}

// ─── ScrubTrack (RN responder wrapper that converts touch X → hour) ─
type ScrubTrackProps = {
  onScrub?: (hour: number) => void;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
};

export function ScrubTrack({ onScrub, style, children }: ScrubTrackProps) {
  const widthRef = React.useRef(0);
  if (!onScrub) {
    return <View style={style}>{children}</View>;
  }
  const handle = (locX: number) => {
    const w = widthRef.current;
    if (!w) return;
    const clamped = Math.max(0, Math.min(w, locX));
    onScrub(Math.round((clamped / w) * 23));
  };
  return (
    <View
      style={style}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => handle(e.nativeEvent.locationX)}
      onResponderMove={(e) => handle(e.nativeEvent.locationX)}
    >
      {children}
    </View>
  );
}

// ─── HourlyBars (24 bars, with axis labels and inline scrubber) ─────
type HourlyBarsProps = {
  hourly: HourlyPoint[];
  pickValue: (h: HourlyPoint) => number;
  scrubberHour: number;
  onScrub?: (hour: number) => void;
  height?: number;
  barColor?: string;
  fadedColor?: string;
};

export function HourlyBars({
  hourly,
  pickValue,
  scrubberHour,
  onScrub,
  height = 70,
  barColor = 'rgba(255,255,255,0.85)',
  fadedColor = 'rgba(255,255,255,0.32)',
}: HourlyBarsProps) {
  const max = Math.max(...hourly.map(pickValue), 1);
  const barAreaHeight = height - 18; // leave room for axis labels
  return (
    <View style={{ marginTop: 8 }}>
      <ScrubTrack onScrub={onScrub} style={[barsStyles.row, { height: barAreaHeight }]}>
        {hourly.map((h) => {
          const v = pickValue(h);
          const pct = Math.max(0.05, v / max);
          const isNear = Math.abs(h.hour24 - scrubberHour) <= 1;
          return (
            <View key={h.hour24} style={barsStyles.barCol} pointerEvents="none">
              <View
                style={[
                  barsStyles.bar,
                  {
                    height: `${pct * 100}%`,
                    backgroundColor: isNear ? barColor : fadedColor,
                  },
                ]}
              />
            </View>
          );
        })}
      </ScrubTrack>
      <View style={barsStyles.axisRow}>
        {SHORT_AXIS_LABELS.map((lbl, i) => (
          <Text key={i} style={[barsStyles.axisLabel, { opacity: lbl ? 1 : 0 }]}>
            {lbl}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── CompassThumbnail ───────────────────────────────────────────────
type CompassThumbnailProps = {
  bearing: number; // 0–360
  size?: number;
  spotCoords?: { lat: number; lon: number };
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

function compassTileUrl(lat: number, lon: number, px: number): string {
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},14,0/${px}x${px}@2x?access_token=${MAPBOX_TOKEN}`;
}

export function CompassThumbnail({ bearing, size = 78, spotCoords }: CompassThumbnailProps) {
  const hasTile = !!(spotCoords && MAPBOX_TOKEN);
  return (
    <View style={[compassStyles.wrap, { width: size, height: size }]}>
      {hasTile ? (
        <Image
          source={{ uri: compassTileUrl(spotCoords!.lat, spotCoords!.lon, Math.round(size)) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#0a3a4d', '#04111e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="38" stroke="rgba(255,255,255,0.55)" strokeWidth={1.4} fill="none" />
        <Circle cx="50" cy="50" r="22" stroke="rgba(255,255,255,0.30)" strokeWidth={1} fill="none" />
        {/* Cardinal labels (N E S W) */}
        {[
          { deg: 0,   label: 'N' },
          { deg: 90,  label: 'E' },
          { deg: 180, label: 'S' },
          { deg: 270, label: 'W' },
        ].map(({ deg, label }) => {
          const rad = (deg * Math.PI) / 180;
          const x = 50 + Math.sin(rad) * 44;
          const y = 50 - Math.cos(rad) * 44 + 3;
          return (
            <SvgText
              key={label}
              x={x}
              y={y}
              fill="#ffffff"
              fontSize={9}
              fontWeight="700"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
        {/* Direction arrow */}
        <Path
          d={`M 50 50 L ${50 + Math.sin(((bearing) * Math.PI) / 180) * 30} ${50 - Math.cos(((bearing) * Math.PI) / 180) * 30}`}
          stroke="#0C9BFA"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Circle cx="50" cy="50" r="3" fill="#0C9BFA" />
      </Svg>
    </View>
  );
}

// ─── shared text style ──────────────────────────────────────────────
const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: HEADER_COLOR,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 8,
  },
});

const dayStyles = StyleSheet.create({
  row: { gap: 10, paddingRight: 16 },
  cell: {
    width: 70,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 4,
  },
  cellActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(26,184,255,0.6)',
    backgroundColor: 'rgba(26,184,255,0.05)',
  },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  labelActive: { color: 'rgba(255,255,255,0.85)' },
  date: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  dateActive: { color: 'rgba(255,255,255,0.95)' },
  swell: { fontSize: 14, color: '#fff', fontWeight: '700', marginTop: 2 },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 999 },
});

const bannerStyles = StyleSheet.create({
  card: {
    height: 72,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dotWrap: { width: 22, height: 22, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  dotOuter: { width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 8, height: 8, borderRadius: 999 },
  label: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.6, flex: 1 },
  live: {
    position: 'absolute',
    right: 12,
    top: 12,
    height: 16,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: { width: 4, height: 4, borderRadius: 999 },
  liveText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
});

const ratingStyles = StyleSheet.create({
  trackOuter: { height: 14, justifyContent: 'center' },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#232323',
    overflow: 'hidden',
    position: 'relative',
  },
  segment: { position: 'absolute', top: 0, height: 8 },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 14,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  tickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tick: { fontSize: 8, color: 'rgba(166,166,166,0.6)' },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
});

const scrubberStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  label: {
    position: 'absolute',
    top: 0,
    width: 60,
    textAlign: 'center',
    fontSize: 11,
    color: SCRUBBER_COLOR,
    fontWeight: '500',
  },
  line: {
    position: 'absolute',
    top: 16,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});

const barsStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 1.5 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisLabel: { fontSize: 9, color: AXIS_COLOR, fontWeight: '500', flex: 1, textAlign: 'center' },
});

const compassStyles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const FORECAST_TOKENS = {
  BORDER,
  HEADER_COLOR,
  SUB_COLOR,
  AXIS_COLOR,
  SCRUBBER_COLOR,
};
