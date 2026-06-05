/**
 * SpotAlerts — per-spot live alert list.
 *
 * Replaces the static "Condition alerts" placeholder that used to
 * ship hardcoded "Runoff advisory: Turtle Canyon and Hanauma Bay"
 * style copy. Reads /spot_alerts via useSpotAlerts, filters to the
 * one spot we're rendering, and hides the whole section (title and
 * card frame) when there's nothing active. No alerts → no panel.
 *
 * Severity drives the icon tint; category drives the glyph. Order
 * comes from useSpotAlerts's priority sort (tsunami > urgent >
 * warning > advisory > info, then recency), so the loudest alert is
 * always on top. Confidence pills surface for box_jelly today and
 * any other future category that ships with a metadata.confidence
 * value.
 */

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../tokens';
import { useSpotAlerts, type SpotAlert, type AlertCategory, type AlertSeverity } from '../data/spotAlerts';

type Props = {
  spotId: string;
  /** Optional override styles so callers can match a specific panel theme. */
  containerStyle?: object;
};

export function SpotAlerts({ spotId, containerStyle }: Props) {
  const alerts = useSpotAlerts(React.useMemo(() => [spotId], [spotId]));
  if (alerts.length === 0) return null;
  return (
    <View style={[styles.section, containerStyle]}>
      <Text style={styles.sectionTitle}>Condition alerts</Text>
      <View style={styles.list}>
        {alerts.map((a) => (
          <AlertRow key={a.alertId} alert={a} />
        ))}
      </View>
    </View>
  );
}

function AlertRow({ alert }: { alert: SpotAlert }) {
  const { glyph, tint } = visualFor(alert);
  const confidence =
    typeof alert.metadata?.confidence === 'string'
      ? String(alert.metadata.confidence)
      : null;

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: tint }]}>
        <Text style={styles.iconText}>{glyph}</Text>
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{alert.title}</Text>
          {confidence ? <ConfidencePill level={confidence} /> : null}
        </View>
        <Text style={styles.bodyText}>{alert.body}</Text>
        {alert.sourceUrl ? (
          <Pressable onPress={() => Linking.openURL(alert.sourceUrl!).catch(() => {})}>
            <Text style={styles.link}>Source ↗</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ConfidencePill({ level }: { level: string }) {
  const tone =
    level === 'high'   ? { bg: 'rgba(255,157,37,0.18)', fg: colors.fair }
    : level === 'medium' ? { bg: 'rgba(255,157,37,0.10)', fg: colors.fair }
    : { bg: 'rgba(160,166,184,0.16)', fg: colors.text3 };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{level.toUpperCase()}</Text>
    </View>
  );
}

// Category → glyph + base tint. Severity then upgrades the tint for
// the loud categories (urgent → red).
const CATEGORY_GLYPH: Record<AlertCategory, string> = {
  vis_spike: '👁',
  wind_drop: '💨',
  window_open: '⏰',
  streak_start: '⭐',
  streak_end: '⌛',
  tide_alignment: '🌙',
  spot_of_day: '🏆',
  brown_water: '⚠',
  high_surf: '🌊',
  small_craft: '⛵',
  box_jelly: '🪼',
  tsunami: '🚨',
  shark_incident: '🦈',
  vog: '🌫',
};

function visualFor(a: SpotAlert): { glyph: string; tint: string } {
  const glyph = CATEGORY_GLYPH[a.category] ?? '•';
  const tint = tintFor(a.severity, a.category);
  return { glyph, tint };
}

function tintFor(sev: AlertSeverity, cat: AlertCategory): string {
  if (cat === 'tsunami' || sev === 'urgent') return 'rgba(255,89,89,0.18)';
  if (sev === 'warning') return 'rgba(255,157,37,0.18)';
  if (sev === 'advisory') return 'rgba(255,157,37,0.10)';
  return colors.accentDim;
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  list: {
    gap: 14,
  },
  bodyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 14 },
  textWrap: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  link: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
});

export default SpotAlerts;
