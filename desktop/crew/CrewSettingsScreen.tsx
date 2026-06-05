// CrewSettingsScreen — D2 scope: org memberships list + Pro status
// link back to consumer. Notification preferences + "Leave org" land
// in a later slice (they touch admin-side accept/decline state).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useAuth, type OrgRole } from '../hooks/useAuth';
import { CrewShell } from './CrewShell';
import { useActiveMembership } from './useActiveMembership';
import type { NavigateFn } from '../router';

const ROLE_LABEL: Record<OrgRole, string> = {
  captain: 'Captain',
  divemaster: 'Divemaster',
  instructor: 'Instructor',
  manager: 'Manager',
  deckhand: 'Deckhand',
};

/** Human-readable countdown for the Pro grace clock. Shows the
 *  expiry date AND the day delta — both because "in 5 days" reads
 *  fast at a glance, and "Jun 9, 2026" is unambiguous if the user
 *  wants to plan around it. Past expirations read "Expired — Pro
 *  will be revoked at the next sweep". */
function graceLabel(expiresMs: number): string {
  const now = Date.now();
  const deltaMs = expiresMs - now;
  if (deltaMs <= 0) return 'Expired — Pro will be revoked at the next sweep.';
  const days = Math.ceil(deltaMs / (24 * 60 * 60 * 1000));
  const date = new Date(expiresMs).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return `${date} · in ${days} day${days === 1 ? '' : 's'}`;
}

export function CrewSettingsScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const auth = useAuth();
  const { membership: active } = useActiveMembership();
  const memberships = auth.orgMemberships;

  return (
    <CrewShell active="crew-settings" onNavigate={onNavigate}>
      <View style={styles.header}>
        <Text style={styles.title}>Crew settings</Text>
        <Text style={styles.subtitle}>
          Your KaiCast account, your org memberships, and how Pro features are unlocked.
        </Text>
      </View>

      <Section title="Account" subtitle="Managed from your Personal profile">
        <Row
          label="Email"
          value={auth.user?.email ?? '—'}
        />
        <Row
          label="Display name"
          value={auth.user?.displayName?.trim() || '—'}
        />
        <Row
          label="Edit your profile"
          actionLabel="Open Personal"
          onAction={() => onNavigate?.('profile')}
          isLast
        />
      </Section>

      <Section
        title="Pro access"
        subtitle={
          auth.proSource === 'subscription'
            ? 'You have a paid subscription. Crew memberships do not change this.'
            : auth.proSource === 'crew_membership'
              ? 'Pro is comped via your active crew memberships. If they all become inactive, you have a 7-day grace before Pro is revoked.'
              : 'Pro features are not currently active for your account.'
        }
      >
        <Row label="Status" value={auth.proAccess ? 'Active' : 'Inactive'} />
        <Row
          label="Source"
          value={
            auth.proSource === 'subscription' ? 'Subscription'
            : auth.proSource === 'crew_membership' ? 'Crew membership'
            : '—'
          }
          isLast={auth.proExpiresAt == null}
        />
        {auth.proExpiresAt != null ? (
          <Row
            label="Grace expires"
            value={graceLabel(auth.proExpiresAt)}
            isLast
          />
        ) : null}
      </Section>

      <Section
        title="Org memberships"
        subtitle="The orgs you belong to. The Personal switcher in your Profile picks which one is active."
      >
        {memberships.length === 0 ? (
          <Text style={styles.empty}>You don't belong to any orgs.</Text>
        ) : (
          memberships.map((m, i) => {
            const isActive = m.status === 'active' && active?.orgId === m.orgId;
            return (
              <View
                key={m.orgId + '-' + i}
                style={[styles.row, i < memberships.length - 1 && styles.rowDivider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {m.orgName} {isActive ? <Text style={styles.currentBadge}>· current</Text> : null}
                  </Text>
                  <Text style={styles.rowSub}>
                    {ROLE_LABEL[m.role]} · {m.status}
                    {m.acceptedAt ? ` · joined ${new Date(m.acceptedAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                {!isActive && m.status === 'active' ? (
                  <Pressable
                    style={styles.btn}
                    onPress={async () => {
                      await auth.setActiveContext(`crew:${m.orgId}`);
                      onNavigate?.('crew-home');
                    }}
                  >
                    <Text style={styles.btnText}>Switch to</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </Section>

      <Text style={styles.footnote}>
        Notification preferences (cert expiry warnings, trip conditions changes, hazard alerts) and leaving an org ship in the next slice.
      </Text>
    </CrewShell>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label, value, actionLabel, onAction, isLast,
}: {
  label: string;
  value?: string;
  actionLabel?: string;
  onAction?: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {actionLabel ? (
        <Pressable style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
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

  section: { gap: 8, maxWidth: 720 },
  sectionHeader: { paddingHorizontal: 4 },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
  },
  sectionBody: {
    backgroundColor: colors.surface0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text1,
    flex: 1,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  rowSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  currentBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.08)',
  },
  btnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
  },
});
