// CharterShell — the layout wrapper every charter screen sits inside.
// Holds the sidebar nav + a persistent Emergency button. Charter
// surfaces never render the consumer DesktopNav or Footer (see
// router.ts HIDE_FOOTER_ROUTES). The shell intentionally feels more
// utilitarian than the consumer dashboard — this is a working tool
// for a captain on a boat in bright sun, not a marketing dashboard.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH } from '../tokens';
import type { NavigateFn, RouteKey } from '../router';

type CharterNavKey =
  | 'charter-home'
  | 'charter-trips'
  | 'charter-spots'
  | 'charter-log'
  | 'charter-crew';

const NAV_ITEMS: Array<{ key: CharterNavKey; label: string; sub: string; icon: string }> = [
  { key: 'charter-home',  label: 'Today',          sub: 'Operations',          icon: '◐' },
  { key: 'charter-trips', label: 'Trips',          sub: 'Planner + archive',   icon: '✈' },
  { key: 'charter-spots', label: 'Spots',          sub: 'Library + calendar',  icon: '◉' },
  { key: 'charter-log',   label: "Captain's Log",  sub: 'File + archive',      icon: '✎' },
  { key: 'charter-crew',  label: 'Crew',           sub: 'Roster + certs',      icon: '★' },
];

export function CharterShell({
  active,
  onNavigate,
  children,
}: {
  active: CharterNavKey | 'charter-emergency';
  onNavigate?: NavigateFn;
  children: React.ReactNode;
}) {
  const go = (route: RouteKey) => () => onNavigate?.(route);
  return (
    <View style={styles.page}>
      <View style={styles.maxWidth}>
        <View style={styles.layout}>
          {/* ── Sidebar nav ── */}
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <Text style={styles.brandMark}>K</Text>
              <View>
                <Text style={styles.brandName}>KaiCast</Text>
                <Text style={styles.brandKind}>Charter</Text>
              </View>
            </View>

            <View style={styles.navStack}>
              {NAV_ITEMS.map((item) => {
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

            {/* Persistent Emergency button — always visible, red accent,
                designed for one-tap access in a real incident. */}
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
    color: colors.accent,
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
  navLabelActive: { color: colors.text1 },
  navSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text4,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#F73726',
    backgroundColor: 'rgba(247,55,38,0.08)',
  },
  emergencyBtnActive: {
    backgroundColor: 'rgba(247,55,38,0.20)',
  },
  emergencyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F73726',
    color: colors.text1,
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: fonts.display,
    fontWeight: '800',
    fontSize: 16,
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

  // ── Content column ──
  content: { flex: 1 },
  contentInner: { padding: 28, gap: 24 },
});
