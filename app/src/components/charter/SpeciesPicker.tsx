// SpeciesPicker — protected-species observation tracker.
//
// Tap a species chip to add it to the list (count 1). Once on the
// list, the chip becomes selected and +/− buttons appear to adjust
// the count. Tap a custom species via the "Other" input to add an
// arbitrary species — useful for sightings outside the quick list.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import {
  COMMON_HAWAII_SPECIES,
  type SpeciesObservation,
} from '@/types/charterLog';

type Props = {
  observed: SpeciesObservation[];
  onChange: (next: SpeciesObservation[]) => void;
};

function countOf(observed: SpeciesObservation[], species: string): number {
  return observed.find((s) => s.species === species)?.count ?? 0;
}

function setCount(
  observed: SpeciesObservation[],
  species: string,
  count: number,
): SpeciesObservation[] {
  if (count <= 0) return observed.filter((s) => s.species !== species);
  const existing = observed.find((s) => s.species === species);
  if (existing) return observed.map((s) => (s.species === species ? { ...s, count } : s));
  return [...observed, { species, count }];
}

export function SpeciesPicker({ observed, onChange }: Props) {
  const [customName, setCustomName] = useState('');

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    onChange(setCount(observed, name, countOf(observed, name) + 1));
    setCustomName('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chipGrid}>
        {COMMON_HAWAII_SPECIES.map((species) => {
          const count = countOf(observed, species);
          const active = count > 0;
          return (
            <Pressable
              key={species}
              onPress={() => onChange(setCount(observed, species, count + 1))}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {species}
              </Text>
              {active ? (
                <View style={styles.countBubble}>
                  <Text style={styles.countText}>×{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Counts/remove row — only for species that are on the list. */}
      {observed.length > 0 ? (
        <View style={styles.adjustList}>
          {observed.map((obs) => (
            <View key={obs.species} style={styles.adjustRow}>
              <Text style={styles.adjustName} numberOfLines={1}>{obs.species}</Text>
              <View style={styles.adjustControls}>
                <Pressable
                  onPress={() => onChange(setCount(observed, obs.species, obs.count - 1))}
                  style={styles.adjustBtn}
                >
                  <Text style={styles.adjustBtnText}>−</Text>
                </Pressable>
                <Text style={styles.adjustCount}>{obs.count}</Text>
                <Pressable
                  onPress={() => onChange(setCount(observed, obs.species, obs.count + 1))}
                  style={styles.adjustBtn}
                >
                  <Text style={styles.adjustBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.customRow}>
        <TextInput
          value={customName}
          onChangeText={setCustomName}
          placeholder="Other species — type and add"
          placeholderTextColor={colors.textMuted}
          style={styles.customInput}
          onSubmitEditing={addCustom}
          returnKeyType="done"
        />
        <Pressable onPress={addCustom} style={styles.addBtn}>
          <Text style={styles.addBtnText}>ADD</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  chipTextActive: { color: colors.accent, fontWeight: '600' },
  countBubble: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    ...typography.bodySm,
    color: colors.bg,
    fontSize: 10,
    fontWeight: '700',
  },
  adjustList: { gap: spacing.xs },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adjustName: { flex: 1, ...typography.body, color: colors.textPrimary },
  adjustControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  adjustBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '600',
  },
  adjustCount: {
    ...typography.body,
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  addBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  addBtnText: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
