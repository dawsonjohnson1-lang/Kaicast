// CrewListCard — single row in /charter/crew. Surfaces name, role,
// and a row of cert badges color-coded by expiry tier (red expired /
// amber expiring inside 60 days / neutral ok). Edit button pops the
// modal; expired or missing certs glow the whole card to draw the
// eye when a captain scrolls a long roster.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { certWarning, crewWorstCertTier } from './useCharterData';
import type { Cert, CrewMember } from './types';

const ROLE_LABEL: Record<CrewMember['role'], string> = {
  owner:      'OWNER',
  captain:    'CAPTAIN',
  divemaster: 'DIVEMASTER',
  deckhand:   'DECKHAND',
};

export function CrewListCard({
  member,
  onEdit,
}: {
  member: CrewMember;
  onEdit: () => void;
}) {
  const worst = crewWorstCertTier(member);
  return (
    <View style={[
      styles.card,
      worst === 'expired' && styles.cardExpired,
      worst === 'expiring-soon' && styles.cardExpiring,
    ]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{member.name}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{ROLE_LABEL[member.role]}</Text>
            </View>
          </View>
          {member.uid ? (
            <Text style={styles.uidLine}>↗ linked to KaiCast user · uid {member.uid.slice(0, 8)}…</Text>
          ) : null}
        </View>
        <Pressable onPress={onEdit} style={styles.editBtn}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.certsRow}>
        {member.certs.length === 0 ? (
          <Text style={styles.noCerts}>No certs on file — add at least the ones you require for the role.</Text>
        ) : (
          member.certs.map((c, i) => <CertBadge key={`${c.type}-${i}`} cert={c} />)
        )}
      </View>
    </View>
  );
}

function CertBadge({ cert }: { cert: Cert }) {
  const w = certWarning(cert);
  const tone =
    w.tier === 'expired'        ? { border: '#F73726', bg: 'rgba(247,55,38,0.10)', text: '#F73726' } :
    w.tier === 'expiring-soon'  ? { border: '#F5A623', bg: 'rgba(245,166,35,0.10)', text: '#F5A623' } :
                                   { border: colors.hairlineStrong, bg: colors.surface1, text: colors.text2 };
  return (
    <View style={[styles.certBadge, { borderColor: tone.border, backgroundColor: tone.bg }]}>
      <Text style={[styles.certType, { color: tone.text }]}>{cert.type}</Text>
      <Text style={[styles.certMeta, { color: tone.text }]}>
        {w.tier === 'expired'
          ? `EXPIRED ${Math.abs(w.daysUntil)}d ago`
          : w.tier === 'expiring-soon'
            ? `${w.daysUntil}d left`
            : isFinite(cert.expiresAt.getTime()) && cert.expiresAt.getTime() > 0
              ? cert.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
              : 'no expiry'}
      </Text>
      {cert.issuedBy ? <Text style={styles.certIssuer}>by {cert.issuedBy}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
    gap: 12,
  },
  cardExpired: { borderColor: '#F73726', backgroundColor: 'rgba(247,55,38,0.04)' },
  cardExpiring: { borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.04)' },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text1 },
  roleChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.hairlineStrong },
  roleText: { fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: colors.text2 },
  uidLine: { fontFamily: fonts.mono, fontSize: 10, color: colors.text3, marginTop: 4 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: colors.surface1 },
  editText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text2 },

  certsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noCerts: { fontFamily: fonts.body, fontSize: 12, color: colors.text3, fontStyle: 'italic' },
  certBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, gap: 2 },
  certType: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  certMeta: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '600' },
  certIssuer: { fontFamily: fonts.body, fontSize: 10, color: colors.text4, marginTop: 2 },
});
