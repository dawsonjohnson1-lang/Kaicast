// CrewCertsScreen — read-only cert view for the active org.
//
// D2 scope: list whatever certs are on the user's crew record, with
// expiry tiers (valid / expiring inside 60d / expired). Submitting
// new certs from the crew side ("admin reviews before recording")
// needs a separate `pending: boolean` field on the cert shape; that
// lands with D3 along with the admin-side review queue.

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { CrewShell } from './CrewShell';
import { useActiveMembership } from './useActiveMembership';
import { useCrewSelf } from './useCrewSelf';
import type { Cert, CertType } from '../charter/types';
import type { NavigateFn } from '../router';

const CERT_TYPE_LABEL: Record<CertType, string> = {
  USCG: 'USCG (Captain)',
  DiveMaster: 'DiveMaster',
  Instructor: 'Instructor',
  CPR: 'CPR',
  O2Provider: 'O2 Provider',
};

type CertTier = 'expired' | 'expiring-soon' | 'ok';

const TIER_LABEL: Record<CertTier, string> = {
  ok: 'Valid',
  'expiring-soon': 'Expires soon',
  expired: 'Expired',
};

const TIER_COLOR: Record<CertTier, string> = {
  ok: '#3DDC84',
  'expiring-soon': '#F5A623',
  expired: '#F73726',
};

export function CrewCertsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const { membership } = useActiveMembership();
  const { member, loading, error } = useCrewSelf(membership?.orgId);

  return (
    <CrewShell active="crew-certs" onNavigate={onNavigate}>
      <View style={styles.header}>
        <Text style={styles.title}>My certs</Text>
        <Text style={styles.subtitle}>
          Certifications on file with {membership?.orgName ?? 'this org'}.
          Expiring inside 60 days flags yellow; expired flags red.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Reading your cert list…</Text>
        </View>
      ) : error ? (
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Could not load certs</Text>
          <Text style={styles.errBody}>{error}</Text>
        </View>
      ) : !member ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No crew record yet</Text>
          <Text style={styles.emptyBody}>
            Cert tracking lives on your crew record at this org. Once an admin adds you (or your accepted invite auto-creates the record), your cert list shows up here.
          </Text>
        </View>
      ) : member.certs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No certs on file yet</Text>
          <Text style={styles.emptyBody}>
            Ask the admin at {membership?.orgName} to add your certs. Self-submit (with admin review) ships in the next slice.
          </Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {summary(member.certs).map((line) => (
            <Text key={line.key} style={styles.summaryLine}>{line.text}</Text>
          ))}
          {member.certs
            .slice()
            .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
            .map((cert, i) => (
              <CertRow key={`${cert.type}-${i}`} cert={cert} />
            ))}
        </View>
      )}
    </CrewShell>
  );
}

function CertRow({ cert }: { cert: Cert }) {
  const tier = tierFor(cert.expiresAt);
  const expiresText = cert.expiresAt.getTime() > 0
    ? cert.expiresAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No expiry on file';
  return (
    <View style={[styles.row, { borderLeftColor: TIER_COLOR[tier] }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{CERT_TYPE_LABEL[cert.type] ?? cert.type}</Text>
        <Text style={styles.rowSub}>
          {cert.issuedBy ? `Issued by ${cert.issuedBy}` : 'No issuer recorded'} · expires {expiresText}
        </Text>
      </View>
      <Text style={[styles.tierBadge, { color: TIER_COLOR[tier], borderColor: TIER_COLOR[tier] }]}>
        {TIER_LABEL[tier]}
      </Text>
    </View>
  );
}

function tierFor(expiresAt: Date): CertTier {
  const now = Date.now();
  const exp = expiresAt.getTime();
  if (!exp || exp === 0) return 'ok';
  if (exp < now) return 'expired';
  if (exp - now < 60 * 24 * 60 * 60 * 1000) return 'expiring-soon';
  return 'ok';
}

function summary(certs: Cert[]): Array<{ key: string; text: string }> {
  const counts = { ok: 0, 'expiring-soon': 0, expired: 0 } as Record<CertTier, number>;
  for (const c of certs) counts[tierFor(c.expiresAt)] += 1;
  const lines: Array<{ key: string; text: string }> = [];
  if (counts.expired > 0) {
    lines.push({ key: 'expired', text: `${counts.expired} expired cert${counts.expired === 1 ? '' : 's'} — renew immediately.` });
  }
  if (counts['expiring-soon'] > 0) {
    lines.push({ key: 'expiring-soon', text: `${counts['expiring-soon']} expiring inside 60 days.` });
  }
  return lines;
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    maxWidth: 640,
  },

  loadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18,
    borderRadius: radius.md, backgroundColor: colors.surface0,
    borderWidth: 1, borderColor: colors.hairline,
  },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.text3 },

  errCard: {
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: 'rgba(247,55,38,0.10)',
    borderWidth: 1,
    borderColor: '#F73726',
  },
  errTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#F73726' },
  errBody: { fontFamily: fonts.body, fontSize: 12, color: colors.text2, marginTop: 4 },

  emptyCard: {
    padding: 24,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
    maxWidth: 640,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 20,
  },

  stack: { gap: 10 },
  summaryLine: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 4,
  },
  rowTitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  rowSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tierBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
});
