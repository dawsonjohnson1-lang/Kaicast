// CrewHomeScreen — landing for /crew.
//
// D1 scope: identity card + an "up next" placeholder. Cert status,
// hazard strip, and trip-aware cards land in D2 (which adds Firestore
// rule support for crew reading their own crew record + assigned
// trips). For now this screen is a structural shell so the
// post-acceptance flow has somewhere to land.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useAuth } from '../hooks/useAuth';
import { CrewShell } from './CrewShell';
import { useActiveMembership } from './useActiveMembership';
import type { NavigateFn } from '../router';

export function CrewHomeScreen({ onNavigate }: { onNavigate?: NavigateFn }) {
  const auth = useAuth();
  const { membership } = useActiveMembership();

  if (!membership) {
    // Route gate should have already bounced us, but guard so the
    // shell doesn't render a meaningless "Crew" header on an empty
    // dashboard.
    return (
      <CrewShell active="crew-home" onNavigate={onNavigate}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>No active crew memberships</Text>
          <Text style={styles.errorBody}>
            Once a charter admin invites you and you accept, you'll land here as part of their crew.
          </Text>
          <Pressable style={styles.btn} onPress={() => onNavigate?.('dashboard')}>
            <Text style={styles.btnText}>Back to your dashboard</Text>
          </Pressable>
        </View>
      </CrewShell>
    );
  }

  const displayName = auth.user?.displayName?.trim() || auth.user?.email?.split('@')[0] || 'Crew';

  return (
    <CrewShell active="crew-home" onNavigate={onNavigate}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Welcome back</Text>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>
          You're on the roster at <Text style={styles.orgName}>{membership.orgName}</Text> as{' '}
          <Text style={styles.role}>{roleLabel(membership.role)}</Text>.
        </Text>
        <Text style={styles.proBadge}>
          {auth.proAccess && auth.proSource === 'crew_membership'
            ? `Pro features unlocked via ${membership.orgName}`
            : auth.proAccess
              ? 'Pro features active'
              : ''}
        </Text>
      </View>

      <View style={styles.grid}>
        <PlaceholderCard
          icon="✈"
          title="My trips"
          body="See your upcoming assignments + trip briefs as soon as the next slice lands."
          actionLabel="View trips"
          onAction={() => onNavigate?.('crew-trips')}
        />
        <PlaceholderCard
          icon="★"
          title="My certs"
          body="Add and track your certifications. Expiry warnings show on every screen that depends on them."
          actionLabel="Manage certs"
          onAction={() => onNavigate?.('crew-certs')}
        />
        {membership.role === 'captain' ? (
          <PlaceholderCard
            icon="✎"
            title="Captain's Log"
            body="File float plans and trip logs for the trips you captain."
            actionLabel="Open log"
            onAction={() => onNavigate?.('crew-log')}
          />
        ) : null}
        <PlaceholderCard
          icon="◆"
          title="Settings"
          body="Notification preferences, org memberships, and your link back to Personal mode."
          actionLabel="Open settings"
          onAction={() => onNavigate?.('crew-settings')}
        />
      </View>

      <Text style={styles.footnote}>
        The trip planner + cert tracker land in the next release. Personal mode (your KaiCast account) is one click away in the sidebar.
      </Text>
    </CrewShell>
  );
}

function PlaceholderCard({
  icon, title, body, actionLabel, onAction,
}: {
  icon: string; title: string; body: string; actionLabel: string; onAction: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <Pressable style={styles.cardBtn} onPress={onAction}>
        <Text style={styles.cardBtnText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function roleLabel(role: import('../hooks/useAuth').OrgRole): string {
  if (role === 'captain')    return 'Captain';
  if (role === 'divemaster') return 'Divemaster';
  if (role === 'instructor') return 'Instructor';
  if (role === 'manager')    return 'Manager';
  return 'Deckhand';
}

const styles = StyleSheet.create({
  headerCard: {
    padding: 24,
    backgroundColor: colors.surface0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 8,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text2,
    lineHeight: 22,
  },
  orgName: { color: colors.text1, fontWeight: '700' },
  role: { color: colors.accent, fontWeight: '700' },
  proBadge: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    flexBasis: 280,
    flexGrow: 1,
    padding: 18,
    backgroundColor: colors.surface0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 8,
  },
  cardIcon: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.accent,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 18,
  },
  cardBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(9,161,251,0.08)',
    marginTop: 6,
  },
  cardBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },

  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
    marginTop: 8,
  },

  // ── No-membership fallback ──
  errorCard: {
    padding: 24,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
    gap: 10,
    maxWidth: 480,
  },
  errorTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
  },
  errorBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 18,
  },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  btnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.bg,
  },
});
