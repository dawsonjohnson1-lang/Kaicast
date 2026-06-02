// HazardStrip — the bar across the top of the charter home screen
// that summarizes everything actively dangerous today. Each chip is
// pressable; tapping expands a detail panel with the full text /
// alert metadata. The list is composed from the data sources we have
// real access to:
//
//   ✓ Box jelly window — deterministic moon-phase calc, no network
//   ✓ NWS marine alerts — api.weather.gov JSON, public + CORS-friendly
//   ◇ DOH brown-water advisory — needs server-side scrape; placeholder
//   ◇ Shark report — no public real-time feed; user-reported in future
//   ◇ Vog index — USGS HVO publishes a daily PDF; placeholder
//
// The three "◇" placeholders are intentionally absent from the strip
// when there's no data — better to show nothing than fake data. When
// the Phase 7 server-side hazard ingestion lands they'll plug in here.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { boxJellyState } from './moonPhase';
import { useNwsAlerts, type NwsAlert } from './useNwsAlerts';

type Severity = 'info' | 'warn' | 'danger';

const SEV_COLOR: Record<Severity, string> = {
  info:   '#09A1FB',
  warn:   '#F5A623',
  danger: '#F73726',
};

const SEV_TINT: Record<Severity, string> = {
  info:   'rgba(9,161,251,0.10)',
  warn:   'rgba(245,166,35,0.12)',
  danger: 'rgba(247,55,38,0.12)',
};

export function HazardStrip() {
  const { alerts: nwsAlerts, loading: nwsLoading, error: nwsError, lastFetched } = useNwsAlerts();
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const box = boxJellyState(new Date());

  const chips: Array<{
    id: string;
    label: string;
    detail: string;
    severity: Severity;
    expandedBody?: string;
  }> = [];

  // Box-jelly chip — only when the window is open OR within 2 days.
  if (box.open) {
    chips.push({
      id: 'box-jelly-open',
      label: `Box jelly day ${box.dayOfWindow} of 3`,
      detail: 'South-shore Oahu beaches',
      severity: 'danger',
      expandedBody:
        'Hawaiian box jellies (Carybdea alata) appear on south-shore Oahu beaches 8–10 days after every full moon. ' +
        'Stings are painful but usually not life-threatening; rinse with vinegar, not fresh water. ' +
        'Window stays open through the next two nights.',
    });
  } else if (box.daysUntil <= 2) {
    chips.push({
      id: 'box-jelly-soon',
      label: `Box jelly window opens in ${box.daysUntil} ${box.daysUntil === 1 ? 'day' : 'days'}`,
      detail: 'Plan south-shore Oahu trips before the window opens',
      severity: 'warn',
    });
  }

  // NWS marine alerts — one chip per active alert.
  for (const a of nwsAlerts) {
    chips.push({
      id: `nws-${a.id}`,
      label: a.event,
      detail: shortenHeadline(a.headline, a),
      severity: nwsSeverityToTone(a.severity),
      expandedBody: a.description,
    });
  }

  if (chips.length === 0) {
    return (
      <View style={styles.stripQuiet}>
        <Text style={styles.stripLabel}>ACTIVE HAZARDS</Text>
        <Text style={styles.quietText}>
          {nwsLoading
            ? 'Reading current alerts…'
            : nwsError
              ? `NWS feed unavailable: ${nwsError}.`
              : 'No active marine alerts, no box-jelly window. Conditions are clear.'}
        </Text>
        {lastFetched ? (
          <Text style={styles.quietMeta}>Last checked {timeAgo(lastFetched)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.strip}>
      <View style={styles.stripHeader}>
        <Text style={styles.stripLabel}>ACTIVE HAZARDS · {chips.length}</Text>
        {lastFetched ? (
          <Text style={styles.stripLastFetched}>Updated {timeAgo(lastFetched)}</Text>
        ) : null}
      </View>
      <View style={styles.chipsRow}>
        {chips.map((chip) => {
          const isOpen = expanded === chip.id;
          return (
            <Pressable
              key={chip.id}
              onPress={() => setExpanded(isOpen ? null : chip.id)}
              style={[
                styles.chip,
                { borderColor: SEV_COLOR[chip.severity], backgroundColor: SEV_TINT[chip.severity] },
              ]}
            >
              <View style={[styles.chipDot, { backgroundColor: SEV_COLOR[chip.severity] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.chipLabel}>{chip.label}</Text>
                <Text style={styles.chipDetail}>{chip.detail}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Expanded detail — single panel below the row, sourced from
          whichever chip is currently open. Keeps the layout calm. */}
      {expanded ? (
        <View style={styles.expandPanel}>
          {(() => {
            const chip = chips.find((c) => c.id === expanded);
            if (!chip?.expandedBody) return (
              <Text style={styles.expandBody}>No additional detail.</Text>
            );
            return <Text style={styles.expandBody}>{chip.expandedBody}</Text>;
          })()}
        </View>
      ) : null}
    </View>
  );
}

function nwsSeverityToTone(s: string): Severity {
  const v = s.toLowerCase();
  if (v.includes('extreme') || v.includes('severe')) return 'danger';
  if (v.includes('moderate')) return 'warn';
  return 'info';
}

/** Take a long NWS headline like "Small Craft Advisory issued April 1
 *  at 7:32AM HST until April 1 at 6:00PM HST by NWS Honolulu HI"
 *  and reduce to "until 6:00PM HST" for the chip detail. */
function shortenHeadline(headline: string, alert: NwsAlert): string {
  const m = headline.match(/until\s+([^.]+)/i);
  if (m) return `until ${m[1].trim()}`;
  if (alert.expires) {
    const exp = new Date(alert.expires);
    if (!Number.isNaN(exp.getTime())) {
      return `until ${exp.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' })} HST`;
    }
  }
  return headline.length > 80 ? headline.slice(0, 80) + '…' : headline;
}

function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const styles = StyleSheet.create({
  strip: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 10,
  },
  stripQuiet: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 4,
  },
  stripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stripLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: colors.text3,
  },
  stripLastFetched: { fontFamily: fonts.mono, fontSize: 10, color: colors.text4 },
  quietText: { fontFamily: fonts.body, fontSize: 13, color: colors.text2 },
  quietMeta: { fontFamily: fonts.mono, fontSize: 10, color: colors.text4, marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    maxWidth: 380,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text1 },
  chipDetail: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 2, letterSpacing: 0.3 },
  expandPanel: {
    padding: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  expandBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, lineHeight: 19 },
});
