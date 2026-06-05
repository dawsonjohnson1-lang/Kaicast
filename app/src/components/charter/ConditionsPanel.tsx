// ConditionsPanel — side-by-side conditions display.
//
// LEFT  column = Abyss-pipeline auto-filled (blue tint, read-only).
// RIGHT column = Captain-observed (green tint, editable).
//
// The two columns track the same field set so the captain can compare
// row by row. The captainNote field on the observed side spans full
// width below the columns.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import type { AbyssConditions, ObservedConditions } from '@/types/charterLog';

// Blue + green tint constants per spec. These are darker than the
// theme card so the captain can tell at a glance which side is which.
const ABYSS_BG    = '#081828';
const OBSERVED_BG = '#081812';

type FieldRow = {
  key: keyof AbyssConditions & keyof ObservedConditions;
  label: string;
  placeholder: string;
};

const FIELDS: FieldRow[] = [
  { key: 'visibility',       label: 'Visibility',     placeholder: 'e.g. 40 ft'  },
  { key: 'waterTemp' as keyof AbyssConditions & keyof ObservedConditions, label: 'Water / felt', placeholder: 'e.g. 78°F' },
  { key: 'swellHeight' as keyof AbyssConditions & keyof ObservedConditions, label: 'Swell / sea', placeholder: 'e.g. 2 ft' },
  { key: 'swellDirection' as keyof AbyssConditions & keyof ObservedConditions, label: 'Swell dir', placeholder: 'e.g. NW' },
  { key: 'windForecast' as keyof AbyssConditions & keyof ObservedConditions, label: 'Wind', placeholder: 'e.g. 10 kt E' },
  { key: 'surfaceCurrent' as keyof AbyssConditions & keyof ObservedConditions, label: 'Current', placeholder: 'e.g. 0.4 kt' },
  { key: 'currentDirection' as keyof AbyssConditions & keyof ObservedConditions, label: 'Current dir', placeholder: 'e.g. S' },
];

/**
 * Lookup table from the FieldRow.key to the actual field on each side.
 * Abyss and Observed mostly share keys but a few diverge (waterTemp →
 * feltTemp, swellHeight → seaState, swellDirection → swellDirObserved,
 * windForecast → windObserved, surfaceCurrent → currentObserved,
 * currentDirection → currentDirObserved). The mapping makes that
 * explicit so the JSX can stay symmetric.
 */
const ABYSS_KEY: Record<string, keyof AbyssConditions> = {
  visibility: 'visibility',
  waterTemp: 'waterTemp',
  swellHeight: 'swellHeight',
  swellDirection: 'swellDirection',
  windForecast: 'windForecast',
  surfaceCurrent: 'surfaceCurrent',
  currentDirection: 'currentDirection',
};

const OBSERVED_KEY: Record<string, keyof ObservedConditions> = {
  visibility: 'visibility',
  waterTemp: 'feltTemp',
  swellHeight: 'seaState',
  swellDirection: 'swellDirObserved',
  windForecast: 'windObserved',
  surfaceCurrent: 'currentObserved',
  currentDirection: 'currentDirObserved',
};

type Props = {
  abyss: AbyssConditions;
  observed: ObservedConditions;
  abyssLoading: boolean;
  abyssSource: 'live' | 'none';
  onObservedChange: (next: ObservedConditions) => void;
};

export function ConditionsPanel({
  abyss,
  observed,
  abyssLoading,
  abyssSource,
  onObservedChange,
}: Props) {
  const updateObserved = (key: keyof ObservedConditions, val: string) =>
    onObservedChange({ ...observed, [key]: val });

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={[styles.headerCell, styles.abyssTint]}>
          <Text style={styles.headerLabel}>ABYSS · AUTO</Text>
          <Text style={styles.headerSub}>
            {abyssLoading
              ? 'Loading…'
              : abyssSource === 'live'
                ? 'Live snapshot'
                : 'No data this hour'}
          </Text>
        </View>
        <View style={[styles.headerCell, styles.observedTint]}>
          <Text style={styles.headerLabel}>OBSERVED</Text>
          <Text style={styles.headerSub}>Captain fills in</Text>
        </View>
      </View>

      {FIELDS.map((f) => {
        const aKey = ABYSS_KEY[f.key];
        const oKey = OBSERVED_KEY[f.key];
        return (
          <View key={f.key} style={styles.row}>
            <View style={[styles.cell, styles.abyssTint]}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.abyssValue}>
                {abyss[aKey] || '—'}
              </Text>
            </View>
            <View style={[styles.cell, styles.observedTint]}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                value={observed[oKey]}
                onChangeText={(v) => updateObserved(oKey, v)}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textMuted}
                style={styles.observedInput}
              />
            </View>
          </View>
        );
      })}

      {/* Free-form captain note spans full width below the matrix. */}
      <View style={[styles.note, styles.observedTint]}>
        <Text style={styles.fieldLabel}>Captain note</Text>
        <TextInput
          value={observed.captainNote}
          onChangeText={(v) => updateObserved('captainNote', v)}
          placeholder="Anything notable about today's water?"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.observedInput, styles.noteInput]}
        />
      </View>

      {/* Abyss-side alerts visible (read-only). */}
      {abyss.alerts ? (
        <View style={[styles.note, styles.abyssTint]}>
          <Text style={styles.fieldLabel}>Active alerts</Text>
          <Text style={styles.abyssValue}>{abyss.alerts}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerCell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerLabel: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  headerSub: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    minHeight: 64,
  },
  abyssTint: { backgroundColor: ABYSS_BG },
  observedTint: { backgroundColor: OBSERVED_BG },
  fieldLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  abyssValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  observedInput: {
    color: colors.textPrimary,
    fontSize: 15,
    padding: 0,
    margin: 0,
  },
  note: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  noteInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
