/**
 * MapLayerControl — toggle panel that lives on top of KaiCastMap.
 *
 * Two sections:
 *   WEATHER (mutex)  — wind / precipitation / cloud cover. Only one can
 *                      be active at a time because they all overlay raster
 *                      on the same z-plane; stacking them is illegible.
 *   DATA    (multi)  — visibility heatmap, swell. Stack independently
 *                      on top of any weather layer.
 *
 * Controlled component — state lives in the parent (KaiCastMap or the
 * page) so layer state can drive real map sources in later phases.
 *
 * Phase 3.1 ships the shell only — toggling layers updates state but
 * does not yet add/remove map sources. The wiring follows in 3.2+.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, TIER_COLORS } from '../../tokens';

export type WeatherLayerId = 'wind' | 'precipitation' | 'cloud';
export type DataLayerId = 'visibility' | 'swell' | 'currents';

export interface LayerState {
  /** Active weather raster. `null` means no weather overlay. */
  weather: WeatherLayerId | null;
  /** Per-data-layer toggle. Stack on top of weather. */
  visibility: boolean;
  swell: boolean;
  currents: boolean;
}

export const INITIAL_LAYER_STATE: LayerState = {
  weather: null,
  visibility: false,
  swell: false,
  currents: false,
};

interface WeatherDef { id: WeatherLayerId; label: string; swatch: string; }
interface DataDef    { id: DataLayerId;    label: string; swatch: string; }

const WEATHER_LAYERS: WeatherDef[] = [
  { id: 'wind',          label: 'Wind',          swatch: colors.accent },
  { id: 'precipitation', label: 'Precipitation', swatch: TIER_COLORS.good },
  { id: 'cloud',         label: 'Cloud cover',   swatch: 'rgba(255,255,255,0.6)' },
];

const DATA_LAYERS: DataDef[] = [
  { id: 'visibility', label: 'Visibility',    swatch: TIER_COLORS.excellent },
  { id: 'swell',      label: 'Swell',         swatch: TIER_COLORS.fair },
  { id: 'currents',   label: 'Currents',      swatch: TIER_COLORS.great },
];

export interface MapLayerControlProps {
  state: LayerState;
  onChange: (next: LayerState) => void;
  /** Expanded by default? Smaller maps (Dashboard, Spot Detail) collapse. */
  defaultOpen?: boolean;
}

export function MapLayerControl({ state, onChange, defaultOpen = false }: MapLayerControlProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  const setWeather = (id: WeatherLayerId) => {
    // Tap the same row again to turn the weather layer off entirely.
    onChange({ ...state, weather: state.weather === id ? null : id });
  };
  const toggleData = (id: DataLayerId) => {
    onChange({ ...state, [id]: !state[id] });
  };

  const activeCount =
    (state.weather ? 1 : 0) +
    (state.visibility ? 1 : 0) +
    (state.swell ? 1 : 0) +
    (state.currents ? 1 : 0);

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.header}>
        <Text style={styles.headerTitle}>MAP LAYERS</Text>
        <View style={styles.headerSpacer} />
        {activeCount > 0 ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{activeCount}</Text>
          </View>
        ) : null}
        <Text style={styles.headerChevron}>{open ? '−' : '+'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>WEATHER</Text>
          {WEATHER_LAYERS.map((l) => {
            const active = state.weather === l.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => setWeather(l.id)}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={[styles.swatch, { backgroundColor: l.swatch }]} />
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{l.label}</Text>
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>DATA</Text>
          {DATA_LAYERS.map((l) => {
            const active = state[l.id];
            return (
              <Pressable
                key={l.id}
                onPress={() => toggleData(l.id)}
                style={[styles.row, active && styles.rowActive]}
              >
                <View style={[styles.check, active && styles.checkActive]}>
                  {active ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <View style={[styles.swatch, { backgroundColor: l.swatch }]} />
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{l.label}</Text>
              </Pressable>
            );
          })}

          {state.currents ? <CurrentsLegend /> : null}
        </View>
      ) : null}
    </View>
  );
}

// Currents legend — explains the vector arrow encoding for the
// PacIOOS ROMS surface-current overlay (vector/rdylbu style).
// Renders inline below the data toggles when currents is active.
function CurrentsLegend() {
  // Colors match the ncWMS "rdylbu" palette: blue at low, red at high.
  // ROMS Hawaii surface speeds typically range 0 – 1 m/s (~0 – 2 kt).
  const stops = [
    { color: '#3b82d4', label: 'Calm' },     // ~0.0 kt
    { color: '#86c4eb', label: '0.5' },      // ~0.5 kt
    { color: '#ffffbf', label: '1.0' },      // ~1.0 kt
    { color: '#fdae61', label: '1.5' },      // ~1.5 kt
    { color: '#d73027', label: '2.0+' },     // ~2.0+ kt — strong
  ];
  return (
    <View style={legendStyles.wrap}>
      <Text style={legendStyles.title}>CURRENT (KT)</Text>
      <View style={legendStyles.bar}>
        {stops.map((s) => (
          <View key={s.label} style={[legendStyles.bucket, { backgroundColor: s.color }]} />
        ))}
      </View>
      <View style={legendStyles.labelsRow}>
        {stops.map((s) => (
          <Text key={s.label} style={legendStyles.label}>{s.label}</Text>
        ))}
      </View>
      <Text style={legendStyles.note}>Arrows point in the direction the current is flowing.</Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    gap: 4,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
    paddingHorizontal: 4,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: 4,
    marginTop: 2,
  },
  bucket: {
    flex: 1,
  },
  labelsRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  label: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
    textAlign: 'center',
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.text3,
    paddingHorizontal: 4,
    marginTop: 4,
    lineHeight: 14,
  },
});

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 220,
    backgroundColor: 'rgba(12,16,21,0.85)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    // Subtle backdrop so map labels under the panel don't bleed through.
    // (No CSS backdrop-filter — react-native-web web target doesn't
    // ship it cleanly. The opaque tint is the practical alternative.)
  },

  // Header (always visible — collapse/expand)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  headerTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text2,
  },
  headerSpacer: { flex: 1 },
  headerChevron: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.accent,
    width: 14,
    textAlign: 'center',
  },
  activeBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: '#04070d',
    fontWeight: '700',
  },

  // Body (expanded sections)
  body: {
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 2,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text3,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  rowActive: {
    backgroundColor: colors.accentDim,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  rowLabelActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 6,
    marginHorizontal: 4,
  },

  // Radio (weather mutex)
  radio: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },

  // Checkbox (data multi)
  check: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkMark: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: '#04070d',
    fontWeight: '700',
    lineHeight: 12,
  },
});
