// CrewShell — layout wrapper every /crew/* screen sits inside.
//
// Mirrors CharterShell's structure (sidebar + persistent Emergency
// button + Personal-mode escape link) but is intentionally lighter:
// crew members aren't managing the org, they're showing up to do
// their job. The nav surfaces only what they need to see.
//
// Captains get an additional "Captain's Log" nav item — that's the
// one place the crew nav diverges by role. Everything else is the
// same for captain / divemaster / deckhand.
//
// The shell reads `activeContext` + `orgMemberships` via
// useActiveMembership() to figure out which org to label in the
// brand row. When a user belongs to multiple orgs and lands here
// without an explicit activeContext, the most-recently-accepted
// membership wins (see useActiveMembership for the resolution rules).

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH } from '../tokens';
import { useAuth } from '../hooks/useAuth';
import { useActiveMembership } from './useActiveMembership';
import type { NavigateFn, RouteKey } from '../router';

type CrewNavKey =
  | 'crew-home'
  | 'crew-trips'
  | 'crew-certs'
  | 'crew-log'        // captains only
  | 'crew-settings';

const BASE_NAV: Array<{ key: CrewNavKey; label: string; sub: string; icon: string }> = [
  { key: 'crew-home',     label: 'Home',         sub: 'You + today',         icon: '◐' },
  { key: 'crew-trips',    label: 'My trips',     sub: 'Briefs + history',    icon: '✈' },
  { key: 'crew-certs',    label: 'My certs',     sub: 'On file with the org', icon: '★' },
  { key: 'crew-settings', label: 'Settings',     sub: 'Notifications + orgs', icon: '◆' },
];

const CAPTAIN_NAV_ITEM = { key: 'crew-log' as const, label: "Captain's Log", sub: 'File + history', icon: '✎' };

export function CrewShell({
  active,
  onNavigate,
  children,
}: {
  active: CrewNavKey | 'charter-emergency' | 'crew-brief';
  onNavigate?: NavigateFn;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { membership } = useActiveMembership();
  const go = (route: RouteKey) => () => onNavigate?.(route);

  const isCaptain = membership?.role === 'captain';
  const navItems = isCaptain
    ? [BASE_NAV[0], BASE_NAV[1], CAPTAIN_NAV_ITEM, BASE_NAV[2], BASE_NAV[3]]
    : BASE_NAV;

  // Brand row: org name + role badge. When membership resolves to null
  // (rare — route gate should have bounced) fall back to a neutral
  // "Crew" label so the layout doesn't break.
  const orgLabel = membership?.orgName ?? 'Crew';
  const roleLabel = membership ? roleDisplay(membership.role) : null;
  const roleColor = membership ? roleColorFor(membership.role) : colors.text3;

  return (
    <View style={styles.page}>
      <View style={styles.maxWidth}>
        <View style={styles.layout}>
          {/* ── Sidebar ── */}
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <Text style={styles.brandMark}>K</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.brandName} numberOfLines={1}>{orgLabel}</Text>
                {roleLabel ? (
                  <View style={[styles.roleChip, { borderColor: roleColor }]}>
                    <Text style={[styles.roleChipText, { color: roleColor }]}>{roleLabel}</Text>
                  </View>
                ) : (
                  <Text style={styles.brandKind}>CREW</Text>
                )}
              </View>
            </View>

            <View style={styles.navStack}>
              {navItems.map((item) => {
                const isActive = active === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={go(item.key)}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                  >
                    <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{item.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                        {item.label}
                      </Text>
                      <Text style={styles.navSub}>{item.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Emergency — always visible. Routes to the existing
                charter emergency screen (same data; the screen itself
                doesn't know whether it's being rendered from charter
                or crew context). */}
            <Pressable
              onPress={go('charter-emergency')}
              style={[styles.emergencyBtn, active === 'charter-emergency' && styles.emergencyBtnActive]}
            >
              <Text style={styles.emergencyIcon}>!</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyLabel}>Emergency</Text>
                <Text style={styles.emergencySub}>USCG + dive medicine + GPS</Text>
              </View>
            </Pressable>

            {/* Personal-mode escape: same affordance CharterShell has.
                Lands on Profile > Settings where the account switcher
                lives. */}
            <Pressable
              onPress={() => onNavigate?.('profile', { tab: 'Settings' })}
              style={styles.personalLink}
            >
              <Text style={styles.personalLinkText}>Personal mode →</Text>
              <Text style={styles.personalLinkSub}>Your KaiCast account</Text>
            </Pressable>

            {/* If this user is ALSO a charter admin (accountType === 'charter')
                they get a direct hop to their admin surface — saves a
                round trip through the Profile switcher. */}
            {auth.accountType === 'charter' ? (
              <Pressable
                onPress={() => onNavigate?.('charter-home')}
                style={styles.personalLink}
              >
                <Text style={styles.personalLinkText}>Charter Admin →</Text>
                <Text style={styles.personalLinkSub}>Manage your org</Text>
              </Pressable>
            ) : null}
          </View>

          {/* ── Main content column ── */}
          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function roleDisplay(role: 'captain' | 'divemaster' | 'deckhand'): string {
  if (role === 'captain') return 'Captain';
  if (role === 'divemaster') return 'Divemaster';
  return 'Deckhand';
}

// Per-role accent. Matches the addendum spec:
//   Captain — KaiCast accent blue
//   Divemaster — green
//   Deckhand — neutral
function roleColorFor(role: 'captain' | 'divemaster' | 'deckhand'): string {
  if (role === 'captain') return colors.accent;
  if (role === 'divemaster') return '#3DDC84';
  return colors.text3;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    backgroundColor: colors.bg,
  },
  maxWidth: { width: '100%', maxWidth: DESKTOP_MAX_WIDTH, alignSelf: 'center', flex: 1 },
  layout: { flex: 1, flexDirection: 'row', gap: 0 },

  // ── Sidebar ──
  sidebar: {
    width: 260,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRightWidth: 1,
    borderRightColor: colors.hairlineStrong,
    backgroundColor: colors.surface0,
    gap: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    color: colors.bg,
    textAlign: 'center',
    lineHeight: 32,
    fontFamily: fonts.display,
    fontWeight: '800',
    fontSize: 18,
  },
  brandName: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  brandKind: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.text3,
    marginTop: 2,
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleChipText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  navStack: { gap: 4, flex: 1 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  navItemActive: { backgroundColor: colors.surface1 },
  navIcon: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text3,
    width: 22,
    textAlign: 'center',
  },
  navIconActive: { color: colors.accent },
  navLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text2,
  },
  navLabelActive: { color: colors.text1, fontWeight: '700' },
  navSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#F73726',
    backgroundColor: 'rgba(247,55,38,0.06)',
  },
  emergencyBtnActive: { backgroundColor: 'rgba(247,55,38,0.12)' },
  emergencyIcon: {
    width: 22, height: 22, textAlign: 'center', lineHeight: 22,
    fontFamily: fonts.display, fontSize: 16, fontWeight: '800',
    color: '#F73726',
    borderRadius: 11, borderWidth: 1, borderColor: '#F73726',
  },
  emergencyLabel: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#F73726',
  },
  emergencySub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  personalLink: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'transparent',
  },
  personalLinkText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text2,
  },
  personalLinkSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // ── Content column ──
  content: { flex: 1 },
  contentInner: { padding: 28, gap: 24 },
});
