/**
 * CertEligibilityBadge (mobile mirror)
 *
 * Mirrors desktop/components/CertEligibilityBadge.tsx — same
 * `evaluateEligibility` semantics so the same dive evaluates to the
 * same cert tier on both surfaces. Visual styling uses the mobile
 * theme tokens (accent / accentSoft / textPrimary).
 *
 * KEEP IN SYNC with desktop's file when criteria change.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

export type CertLevel = 'open-water' | 'advanced' | 'rescue' | 'divemaster';

export interface DiveForBadge {
  // Hard gate — casual logs never count for any cert, even if all
  // fields happen to be filled in.
  isOfficial: boolean;

  // Verification
  verificationType: 'self' | 'buddy' | 'instructor';
  verifierName: string;
  verifierCertNumber: string;
  verifierAgency?: string;
  verifierSignatureTyped: string;

  // Basic params
  spot: string;
  depthMax: string | number;
  bottomTime: string | number;
  gasMix: string;

  // AOW requirements
  waterTemp: number;
  visibility: number;
  buddy: string;
  scubaSubtypes: string[];
}

export interface EligibilityResult {
  openWater: boolean;
  advanced: boolean;
  rescue: boolean;
  divemaster: boolean;
  highest: CertLevel | null;
  missingForNextLevel: string[];
}

function basicScubaPresent(d: DiveForBadge): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!d.spot) missing.push('spot');
  if (!d.depthMax || Number(d.depthMax) <= 0) missing.push('max depth');
  if (!d.bottomTime || Number(d.bottomTime) <= 0) missing.push('bottom time');
  if (!d.gasMix) missing.push('gas mix');
  return { ok: missing.length === 0, missing };
}

function verifiedByBuddyOrInstructor(d: DiveForBadge): { ok: boolean; missing: string[] } {
  if (d.verificationType === 'self') {
    return { ok: false, missing: ['verification (buddy or instructor)'] };
  }
  const missing: string[] = [];
  if (!d.verifierName) missing.push('verifier name');
  if (!d.verifierSignatureTyped) missing.push('signature acknowledgment');
  return { ok: missing.length === 0, missing };
}

function verifiedByInstructor(d: DiveForBadge): { ok: boolean; missing: string[] } {
  if (d.verificationType !== 'instructor') {
    return { ok: false, missing: ['instructor verification'] };
  }
  const missing: string[] = [];
  if (!d.verifierName) missing.push('instructor name');
  if (!d.verifierAgency) missing.push('agency');
  if (!d.verifierCertNumber) missing.push('cert/member number');
  if (!d.verifierSignatureTyped) missing.push('signature acknowledgment');
  return { ok: missing.length === 0, missing };
}

export function evaluateEligibility(d: DiveForBadge): EligibilityResult {
  if (!d.isOfficial) {
    return {
      openWater: false,
      advanced: false,
      rescue: false,
      divemaster: false,
      highest: null,
      missingForNextLevel: [
        '"Make official" toggle (casual logs do not count toward certifications)',
      ],
    };
  }

  const basic = basicScubaPresent(d);
  const openWater = basic.ok;

  // AOW: basic + verification + water temp + vis + buddy + ≥1 specialty.
  const verif = verifiedByBuddyOrInstructor(d);
  const advancedOk =
    openWater &&
    verif.ok &&
    d.waterTemp > 0 &&
    d.visibility > 0 &&
    !!d.buddy &&
    d.scubaSubtypes.length > 0;

  const rescueOk = advancedOk && verifiedByInstructor(d).ok;
  const dmOk = rescueOk;

  let highest: CertLevel | null = null;
  if (dmOk) highest = 'divemaster';
  else if (rescueOk) highest = 'rescue';
  else if (advancedOk) highest = 'advanced';
  else if (openWater) highest = 'open-water';

  let missingForNextLevel: string[] = [];
  if (!openWater) missingForNextLevel = basic.missing;
  else if (!advancedOk) {
    const aowMissing: string[] = [...basic.missing];
    if (!verif.ok) aowMissing.push(...verif.missing);
    if (!d.waterTemp || d.waterTemp <= 0) aowMissing.push('water temperature');
    if (!d.visibility || d.visibility <= 0) aowMissing.push('visibility');
    if (!d.buddy) aowMissing.push('buddy name');
    if (!d.scubaSubtypes || d.scubaSubtypes.length === 0) {
      aowMissing.push('at least one specialty subtype');
    }
    missingForNextLevel = Array.from(new Set(aowMissing.filter(Boolean)));
  } else if (!rescueOk || !dmOk) {
    missingForNextLevel = verifiedByInstructor(d).missing;
  }

  return {
    openWater,
    advanced: advancedOk,
    rescue: rescueOk,
    divemaster: dmOk,
    highest,
    missingForNextLevel,
  };
}

const LEVEL_LABEL: Record<CertLevel, string> = {
  'open-water': 'OW',
  advanced: 'AOW',
  rescue: 'Rescue',
  divemaster: 'DM',
};

export function CertEligibilityBadge({ dive }: { dive: DiveForBadge }) {
  const r = evaluateEligibility(dive);
  const items: Array<{ label: string; ok: boolean }> = [
    { label: LEVEL_LABEL['open-water'], ok: r.openWater },
    { label: LEVEL_LABEL.advanced, ok: r.advanced },
    { label: LEVEL_LABEL.rescue, ok: r.rescue },
    { label: LEVEL_LABEL.divemaster, ok: r.divemaster },
  ];
  return (
    <View style={styles.row}>
      {items.map((it) => (
        <View
          key={it.label}
          style={[styles.chip, it.ok ? styles.chipOn : styles.chipOff]}
        >
          <Text style={[styles.mark, it.ok ? styles.markOn : styles.markOff]}>
            {it.ok ? '✓' : '○'}
          </Text>
          <Text style={[styles.label, it.ok ? styles.labelOn : styles.labelOff]}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipOff: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  mark: { ...typography.caption, fontWeight: '700' },
  markOn: { color: colors.accent },
  markOff: { color: colors.textMuted },
  label: { ...typography.bodySm, fontWeight: '600' },
  labelOn: { color: colors.textPrimary },
  labelOff: { color: colors.textSecondary },
});
