import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { colors, fonts, radius, NAV_HEIGHT, UTIL_BAR_HEIGHT } from '../tokens';

/**
 * Shared top nav, appears on all six desktop screens.
 *
 * - Util bar (36px): Hawaii flag + small inline meta.
 * - Main nav (64px): logo · center links · search + bell + avatar.
 * - Active link uses an accent underline (not a background fill).
 * - Bottom border is a single hairline.
 */

export type NavKey = 'dashboard' | 'forecast' | 'spots' | 'log';

export interface DesktopNavProps {
  active: NavKey;
  onNavigate?: (key: NavKey) => void;
  userInitials?: string;
  /** Top util bar is purely decorative; pass false to suppress for screens that don't show it. */
  showUtilBar?: boolean;
}

const NAV_ITEMS: ReadonlyArray<{ key: NavKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'forecast',  label: 'Forecast' },
  { key: 'spots',     label: 'Spots & Maps' },
  { key: 'log',       label: 'Log Dive' },
];

export function DesktopNav({
  active,
  onNavigate,
  userInitials = 'DJ',
  showUtilBar = true,
}: DesktopNavProps) {
  return (
    <View style={styles.root}>
      {showUtilBar ? (
        <View style={styles.utilBar}>
          <View style={styles.flag} />
          <Text style={styles.utilText}>HAWAII · 78°F · WED APR 15 · 2:14 PM HST</Text>
          <View style={styles.utilSpacer} />
          <Text style={styles.utilText}>NOAA · NDBC · KAICAST MODEL</Text>
        </View>
      ) : null}

      <View style={styles.nav}>
        <View style={styles.logoWrap}>
          <View style={styles.logoMark} />
          <Text style={styles.logoText}>KAICAST</Text>
        </View>

        <View style={styles.linksWrap}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Pressable
                key={item.key}
                onPress={() => onNavigate?.(item.key)}
                style={styles.link}
              >
                <Text style={[styles.linkText, isActive && styles.linkTextActive]}>
                  {item.label}
                </Text>
                {isActive ? <View style={styles.linkUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rightCluster}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              placeholder="Search spots…"
              placeholderTextColor={colors.text3}
              // `outlineStyle` is RN-Web only; not in RN's TextStyle so we
              // attach it inline with a cast rather than inside StyleSheet.
              style={[styles.searchInput, { outlineStyle: 'none' } as object]}
            />
          </View>
          <Pressable style={styles.iconBtn}>
            <Text style={styles.bellIcon}>◔</Text>
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },

  // ── Util bar ─────────────────────────────────────────────────────────
  utilBar: {
    height: UTIL_BAR_HEIGHT,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  flag: {
    width: 22,
    height: 11,
    backgroundColor: colors.surface2,
    borderRadius: 2,
  },
  utilText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    textTransform: 'uppercase',
  },
  utilSpacer: { flex: 1 },

  // ── Main nav ─────────────────────────────────────────────────────────
  nav: {
    height: NAV_HEIGHT,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.accent,
  },
  logoText: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: 1.5,
  },

  linksWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flex: 1,
  },
  link: {
    height: NAV_HEIGHT,
    paddingHorizontal: 16,
    justifyContent: 'center',
    position: 'relative',
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text2,
  },
  linkTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  linkUnderline: {
    position: 'absolute',
    bottom: 6,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },

  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    width: 240,
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  searchIcon: {
    fontSize: 14,
    color: colors.text3,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  bellIcon: {
    fontSize: 16,
    color: colors.text2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  avatarText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
    letterSpacing: 0.5,
  },
});
