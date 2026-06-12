// ConditionChipRow — renders the ordered advisory chips for one vessel
// on one day. Pure presentational; the chip list comes from
// conditionChips.buildChips() and is already filtered to data-backed
// entries. Tone drives the border/tint, mirroring HazardStrip's palette.
//
// (Named *Row to avoid a case-only filename clash with conditionChips.ts
// on case-insensitive filesystems.)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import type { ConditionChip, ChipTone } from './conditionChips';

const TONE_COLOR: Record<ChipTone, string> = {
  good:   '#2BBB7F',
  info:   '#09A1FB',
  warn:   '#F5A623',
  danger: '#F73726',
};
const TONE_TINT: Record<ChipTone, string> = {
  good:   'rgba(43,187,127,0.10)',
  info:   'rgba(9,161,251,0.10)',
  warn:   'rgba(245,166,35,0.12)',
  danger: 'rgba(247,55,38,0.12)',
};

export function ConditionChipRow({ chips }: { chips: ConditionChip[] }) {
  if (chips.length === 0) {
    return <Text style={styles.empty}>No condition data for this spot yet.</Text>;
  }
  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <View
          key={chip.key}
          style={[styles.chip, { borderColor: TONE_COLOR[chip.tone], backgroundColor: TONE_TINT[chip.tone] }]}
        >
          <View style={[styles.dot, { backgroundColor: TONE_COLOR[chip.tone] }]} />
          <Text style={styles.label}>
            {chip.label}
            {chip.detail ? <Text style={styles.detail}>{`  ·  ${chip.detail}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.text1 },
  detail: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '500', color: colors.text3 },
  empty: { fontFamily: fonts.body, fontSize: 12, color: colors.text3 },
});
