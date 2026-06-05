// IncidentReport — collapsed-by-default incident block. Captain
// toggles "Report incident" to expand; until then the section reads
// "No incidents this trip." Mirrors the dark-PDF section of the
// printable captain's log.

import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import {
  INCIDENT_TYPES,
  type CharterLogTrip,
  type IncidentSeverity,
} from '@/types/charterLog';

const SEVERITIES: IncidentSeverity[] = ['Minor', 'Major', 'Critical'];

type Props = {
  trip: CharterLogTrip;
  onChange: (next: Partial<CharterLogTrip>) => void;
};

export function IncidentReport({ trip, onChange }: Props) {
  const reporting = trip.incident !== 'None' && trip.incident !== '';

  const startReporting = () => {
    onChange({
      incident: 'Other',
      incidentSeverity: trip.incidentSeverity ?? 'Minor',
    });
  };
  const stopReporting = () => {
    onChange({
      incident: 'None',
      incidentSeverity: undefined,
      coastGuardNotification: false,
      dlnrNotification: false,
      insuranceClaim: false,
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>
          {reporting ? 'Incident reported' : 'No incidents'}
        </Text>
        <Pressable
          onPress={reporting ? stopReporting : startReporting}
          style={[styles.toggleBtn, reporting && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, reporting && styles.toggleTextActive]}>
            {reporting ? 'Mark resolved' : 'Report incident'}
          </Text>
        </Pressable>
      </View>

      {reporting ? (
        <View style={styles.body}>
          {/* Type picker */}
          <View>
            <Text style={styles.label}>TYPE</Text>
            <View style={styles.chipRow}>
              {INCIDENT_TYPES.map((t) => {
                const active = trip.incident === t || (trip.incident ?? '').startsWith(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => onChange({ incident: t })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Severity picker */}
          <View>
            <Text style={styles.label}>SEVERITY</Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((s) => {
                const active = trip.incidentSeverity === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => onChange({ incidentSeverity: s })}
                    style={[
                      styles.chip,
                      active && (s === 'Critical' ? styles.chipCritical : styles.chipActive),
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                        active && s === 'Critical' && { color: colors.hazard },
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Description */}
          <View>
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput
              value={trip.incident && trip.incident !== 'Other' && !INCIDENT_TYPES.includes(trip.incident) ? trip.incident : ''}
              onChangeText={(v) => onChange({ incident: v || 'Other' })}
              placeholder="What happened, who was involved, action taken…"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.textArea}
            />
          </View>

          {/* Notification toggles */}
          <View style={styles.toggleList}>
            <ToggleRow
              label="USCG notified"
              value={trip.coastGuardNotification ?? false}
              onChange={(v) => onChange({ coastGuardNotification: v })}
            />
            <ToggleRow
              label="DLNR notified"
              value={trip.dlnrNotification ?? false}
              onChange={(v) => onChange({ dlnrNotification: v })}
            />
            <ToggleRow
              label="Insurance claim"
              value={trip.insuranceClaim ?? false}
              onChange={(v) => onChange({ insuranceClaim: v })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleRowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accentDeep }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnActive: {
    backgroundColor: colors.hazardSoft,
    borderColor: colors.hazard,
  },
  toggleText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  toggleTextActive: { color: colors.hazard },
  body: { gap: spacing.md },
  label: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipCritical: {
    backgroundColor: colors.hazardSoft,
    borderColor: colors.hazard,
  },
  chipText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontSize: 12,
  },
  chipTextActive: { color: colors.accent, fontWeight: '600' },
  textArea: {
    minHeight: 80,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  toggleList: { gap: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleRowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
