import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, TIER_COLORS, type ConditionTier } from '../tokens';

/**
 * Rich single-dive card for Profile › Dive Reports.
 *
 * Layout (top → bottom):
 *   - Header row: date chip + spot + region + dive-type pill
 *   - Stats strip: Depth · Time · Visibility · Water · Air (5 cells)
 *   - Conditions strip: Current · Surface · Surge · Wildlife chips
 *   - Notes paragraph (truncates around 3 lines via maxNumberOfLines)
 *   - Photo strip placeholder
 *   - Footer: stars + share/edit affordances
 */

export interface DiveReportCardProps {
  date: string;            // 'APR 14, 2024'
  time?: string;           // '9:12 AM'
  spot: string;
  region: string;
  diveType: string;        // '🤿 Scuba' | '🧜 Freediving' | etc.
  rating: ConditionTier;
  depthFt: number;
  durationMin: number;
  vizFt: number;
  waterTempF: number;
  airTempF?: number;
  conditions: {
    current: string;
    surface: string;
    surge: string;
  };
  wildlife: string[];      // e.g. ['Green Turtle', 'Reef Shark']
  notes: string;
  photoCount?: number;
  stars: number;           // 0–5
  recommend?: 'Definitely' | 'Yes' | 'With caveats' | 'No';
  onPress?: () => void;

  // Community-mode props (used on SpotDetail › Reports):
  /** When set, header renders an avatar + author + relative time instead of date chip + spot. */
  author?: string;
  authorInitials?: string;
  whenAgo?: string;        // '2H AGO' | 'YESTERDAY' | '3D AGO'
  /** When false, the spot/region row in the header is suppressed (community reports
   * all at the same spot — redundant to show it on every card). Defaults to true. */
  showSpot?: boolean;
}

export function DiveReportCard(p: DiveReportCardProps) {
  const isCommunity = p.author != null;
  const showSpot = p.showSpot ?? true;

  return (
    <Pressable onPress={p.onPress} style={styles.root}>
      <View style={[styles.accent, { backgroundColor: TIER_COLORS[p.rating] }]} />

      <View style={styles.header}>
        {isCommunity ? (
          <View style={styles.authorChip}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorAvatarText}>{p.authorInitials ?? '?'}</Text>
            </View>
            <View style={styles.authorTextWrap}>
              <Text style={styles.authorName}>{p.author}</Text>
              <Text style={styles.authorMeta}>{p.whenAgo ?? p.date}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{p.date.toUpperCase()}</Text>
            {p.time ? <Text style={styles.dateChipTime}>{p.time}</Text> : null}
          </View>
        )}

        {showSpot ? (
          <View style={styles.headerSpotWrap}>
            <Text style={styles.spotName}>{p.spot}</Text>
            <Text style={styles.spotRegion}>{p.region}</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.diveTypePill}>
          <Text style={styles.diveTypeText}>{p.diveType}</Text>
        </View>
      </View>

      <View style={styles.statsStrip}>
        <Stat label="Depth"      value={fmtStat(p.depthFt)}     unit="ft" />
        <StatDivider />
        <Stat label="Time"       value={fmtStat(p.durationMin)} unit="min" />
        <StatDivider />
        <Stat label="Visibility" value={fmtStat(p.vizFt)}       unit="ft" />
        <StatDivider />
        <Stat label="Water"      value={fmtStat(p.waterTempF)}  unit="°F" />
        {p.airTempF != null ? (
          <>
            <StatDivider />
            <Stat label="Air"    value={fmtStat(p.airTempF)}    unit="°F" />
          </>
        ) : null}
      </View>

      <View style={styles.conditionsRow}>
        <ConditionChip label="Current"  value={p.conditions.current} />
        <ConditionChip label="Surface"  value={p.conditions.surface} />
        <ConditionChip label="Surge"    value={p.conditions.surge} />
        {p.wildlife.length > 0 ? (
          <ConditionChip label="Wildlife" value={p.wildlife.join(' · ')} />
        ) : null}
      </View>

      {p.notes ? <Text style={styles.notes} numberOfLines={3}>{p.notes}</Text> : null}

      {p.photoCount && p.photoCount > 0 ? (
        <View style={styles.photoStrip}>
          {Array.from({ length: Math.min(p.photoCount, 4) }).map((_, i) => (
            <View key={i} style={styles.photoThumb}>
              <Text style={styles.photoThumbIcon}>◇</Text>
            </View>
          ))}
          {p.photoCount > 4 ? (
            <View style={styles.photoMore}>
              <Text style={styles.photoMoreText}>+{p.photoCount - 4}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.stars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Text key={i} style={[styles.star, i < p.stars && styles.starFilled]}>★</Text>
          ))}
        </View>
        {p.recommend ? (
          <View style={styles.recommendPill}>
            <Text style={styles.recommendText}>RECOMMEND · {p.recommend.toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={styles.footerSpacer} />
        <Text style={styles.footerLink}>Edit</Text>
        <Text style={styles.footerLink}>Share</Text>
      </View>
    </Pressable>
  );
}

// Blank environmental fields are stored as 0 / not-entered; show "N/A"
// rather than a misleading "0 ft". Mirrors fmtMetric in the LogDive
// PublishedView so the success screen and the report card agree.
function fmtStat(n: number): string {
  return Number.isFinite(n) && n > 0 ? String(n) : 'N/A';
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  const isNA = value === 'N/A';
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {isNA ? null : <Text style={styles.statUnit}>{unit}</Text>}
      </View>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
}

function ConditionChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 14,
  },
  dateChip: {
    width: 84,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    gap: 2,
  },
  dateChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.text2,
    fontWeight: '700',
  },
  dateChipTime: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
  },

  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  authorAvatarText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
  },
  authorTextWrap: { gap: 2 },
  authorName: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  authorMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  headerSpotWrap: { flex: 1, gap: 2 },
  spotName: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  spotRegion: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text3,
  },
  diveTypePill: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diveTypeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text2,
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.hairline,
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 12,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text1,
  },
  statUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },

  // Conditions
  conditionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text3,
  },
  chipValue: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text1,
    fontWeight: '500',
    marginTop: 2,
  },

  notes: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // Photo strip
  photoStrip: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
  },
  photoThumb: {
    width: 64,
    height: 64,
    backgroundColor: colors.surface1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbIcon: {
    fontSize: 18,
    color: colors.text4,
  },
  photoMore: {
    width: 64,
    height: 64,
    backgroundColor: colors.surface1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMoreText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 12,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontSize: 14,
    color: colors.text4,
  },
  starFilled: {
    color: colors.accent,
  },
  recommendPill: {
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.accentDim,
    justifyContent: 'center',
  },
  recommendText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: colors.accent,
  },
  footerSpacer: { flex: 1 },
  footerLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
  },
});
