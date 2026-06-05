/**
 * CertEligibilityBadge
 *
 * Surfaces the highest cert level a SCUBA dive could count toward
 * (PADI / SSI / NAUI / SDI advanced + pro tracks). The criteria
 * mirror the canonical agency requirements:
 *
 *   - Open Water:   basic fields only (date, spot, depth, time, gas).
 *                   Self-logging is fine.
 *   - Advanced OW:  all OW + buddy or instructor verification + water
 *                   temp + visibility + buddy name + at least one
 *                   specialty subtype (Night/Deep/Wreck/etc).
 *   - Rescue:       AOW + instructor verification (must be signed by
 *                   a DM or higher with agency + cert number).
 *   - Divemaster:   Rescue + instructor verification with cert number.
 *   - Instructor:   same as DM at the form layer; agency credit is
 *                   awarded by the agency, not by us.
 *
 * `evaluateEligibility(dive)` returns the same set of booleans the
 * badge renders, so callers can also gate behavior off it (e.g.
 * "Send to instructor" button only enables when the dive otherwise
 * qualifies for Rescue+).
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';

export type CertLevel = 'open-water' | 'advanced' | 'rescue' | 'divemaster';

export interface DiveForBadge {
  // Cert-eligibility gate: a dive only counts toward any cert level
  // when isOfficial === true. Casual logs always evaluate to no
  // credit even if the data happens to be complete.
  isOfficial: boolean;

  // Verification block
  verificationType: 'self' | 'buddy' | 'instructor';
  verifierName: string;
  verifierCertNumber: string;
  verifierAgency?: string;
  verifierSignatureTyped: string;

  // Basic dive params
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
  /** Highest level reached, or null when nothing qualifies. */
  highest: CertLevel | null;
  /** Field names that are still missing for the next level up. */
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
  // Hard gate: a casual (non-official) dive never counts for any
  // cert level. Surface this clearly via missingForNextLevel so the
  // banner can tell the user "turn on Make official to count this dive".
  if (!d.isOfficial) {
    return {
      openWater: false,
      advanced: false,
      rescue: false,
      divemaster: false,
      highest: null,
      missingForNextLevel: ['"Make official" toggle (casual logs do not count toward certifications)'],
    };
  }

  const basic = basicScubaPresent(d);
  const openWater = basic.ok;

  // AOW = basic + verification + water temp + vis + buddy + 1 subtype
  const aowMissing: string[] = [...basic.missing];
  const verif = verifiedByBuddyOrInstructor(d);
  if (!verif.ok) aowMissing.push(...verif.missing);
  if (!d.waterTemp || d.waterTemp <= 0) aowMissing.push('water temperature');
  if (!d.visibility || d.visibility <= 0) aowMissing.push('visibility');
  if (!d.buddy) aowMissing.push('buddy name');
  if (!d.scubaSubtypes || d.scubaSubtypes.length === 0) aowMissing.push('at least one specialty subtype');
  const advanced = openWater && aowMissing.length === basic.missing.length + (verif.ok ? 0 : verif.missing.length) - (verif.ok ? 0 : verif.missing.length); // recompute cleanly
  const advancedOk = openWater && verif.ok && d.waterTemp > 0 && d.visibility > 0 && !!d.buddy && d.scubaSubtypes.length > 0;

  // Rescue = AOW + instructor verification
  const rescueOk = advancedOk && verifiedByInstructor(d).ok;

  // DM = Rescue + agency + cert number (subset of instructor verification
  // requirements, already enforced above)
  const dmOk = rescueOk;

  let highest: CertLevel | null = null;
  if (dmOk) highest = 'divemaster';
  else if (rescueOk) highest = 'rescue';
  else if (advancedOk) highest = 'advanced';
  else if (openWater) highest = 'open-water';

  // What's blocking the next level
  let missingForNextLevel: string[] = [];
  if (!openWater) missingForNextLevel = basic.missing;
  else if (!advancedOk) {
    const m = [...aowMissing];
    missingForNextLevel = Array.from(new Set(m.filter(Boolean)));
  } else if (!rescueOk) {
    missingForNextLevel = verifiedByInstructor(d).missing;
  } else if (!dmOk) {
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

/** Compact inline badge — used on dive history cards. */
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
        <View key={it.label} style={[styles.chip, it.ok ? styles.chipOn : styles.chipOff]}>
          <Text style={[styles.mark, it.ok ? styles.markOn : styles.markOff]}>
            {it.ok ? '✓' : '○'}
          </Text>
          <Text style={[styles.label, it.ok ? styles.labelOn : styles.labelOff]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipOn: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  chipOff: {
    backgroundColor: 'transparent',
    borderColor: colors.hairlineStrong,
  },
  mark: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  markOn: { color: colors.accent },
  markOff: { color: colors.text4 },
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  labelOn: { color: colors.text1 },
  labelOff: { color: colors.text3 },
});
