import React from 'react';
import { View, Text, Pressable, TextInput, Image, StyleSheet } from 'react-native';
import { colors, fonts, radius, NAV_HEIGHT, UTIL_BAR_HEIGHT } from '../tokens';
import type { NavigateFn, RouteKey } from '../router';
import { logos } from '../assets/figma/logos';
import { flags } from '../assets/figma/flags';

/**
 * Shared top nav, appears on all six desktop screens.
 *
 * - Util bar (36px): Hawaii flag + small inline meta.
 * - Main nav (64px): logo · center links · search + bell + avatar.
 * - Active link uses an accent underline (not a background fill).
 * - Bottom border is a single hairline.
 * - Logo → dashboard, avatar → profile.
 */

export type NavKey = 'dashboard' | 'forecast' | 'spots' | 'log';

/** Map a nav slot to its destination route. Forecast/Spots/Log are 1:1
 * with route keys; the nav doesn't surface a separate Conditions slot
 * because Conditions sits under the Forecast group. */
const NAV_TO_ROUTE: Record<NavKey, RouteKey> = {
  dashboard: 'dashboard',
  forecast:  'spot-detail',
  spots:     'spots-map',
  log:       'log-dive',
};

export interface DesktopNavProps {
  active: NavKey;
  /** Router-aware navigate. When provided, links + logo + avatar are clickable. */
  onNavigate?: NavigateFn;
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
          <Image source={{ uri: flags.HI }} style={styles.flag} resizeMode="cover" />
          <Text style={styles.utilText}>HAWAII · 78°F · WED APR 15 · 2:14 PM HST</Text>
          <View style={styles.utilSpacer} />
          <Text style={styles.utilText}>NOAA · NDBC · KAICAST MODEL</Text>
        </View>
      ) : null}

      <View style={styles.nav}>
        <Pressable style={styles.logoWrap} onPress={() => onNavigate?.('dashboard')}>
          {/* The exported Figma logo is the full wave-mark + wordmark, so the
              separate KAICAST text used by the prototype is no longer needed. */}
          <Image source={{ uri: logos.kaicast }} style={styles.logoImage} resizeMode="contain" />
        </Pressable>

        <View style={styles.linksWrap}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Pressable
                key={item.key}
                onPress={() => onNavigate?.(NAV_TO_ROUTE[item.key])}
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
          <Pressable style={styles.avatar} onPress={() => onNavigate?.('profile')}>
            <Text style={styles.avatarText}>{userInitials}</Text>
          </Pressable>
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
  // Dimensions match the source Figma export's aspect (~125 × 25.5).
  logoImage: {
    width: 130,
    height: 26,
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
