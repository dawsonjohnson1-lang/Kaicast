import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, Image, StyleSheet } from 'react-native';
import { colors, fonts, radius, NAV_HEIGHT, UTIL_BAR_HEIGHT } from '../tokens';
import type { NavigateFn, RouteKey } from '../router';
import { logos } from '../assets/figma/logos';
import { flags } from '../assets/figma/flags';
import { useBreakpoint, pick } from '../hooks/useBreakpoint';
import { initialsFromUser, useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { useHawaiiAirTempF } from '../data/getReport';

/**
 * Shared top nav, appears on all six desktop screens.
 *
 * - Util bar (36px): Hawaii flag + small inline meta.
 * - Main nav (64px): logo · center links · search + bell + avatar.
 * - Active link uses an accent underline (not a background fill).
 * - Bottom border is a single hairline.
 * - Logo → dashboard, avatar → profile.
 */

export type NavKey = 'dashboard' | 'forecast' | 'spots' | 'log' | 'charter';

/** Map a nav slot to its destination route. Forecast/Spots/Log are 1:1
 * with route keys; the nav doesn't surface a separate Conditions slot
 * because Conditions sits under the Forecast group. The Charter slot
 * only appears for charter-affiliated accounts (see NAV_ITEMS logic
 * below) and routes into the charter ops dashboard. */
const NAV_TO_ROUTE: Record<NavKey, RouteKey> = {
  dashboard: 'dashboard',
  forecast:  'conditions',
  spots:     'spots-map',
  log:       'log-dive',
  charter:   'charter-home',
};

export interface DesktopNavProps {
  active: NavKey;
  /** Router-aware navigate. When provided, links + logo + avatar are clickable. */
  onNavigate?: NavigateFn;
  userInitials?: string;
  /** Top util bar is purely decorative; pass false to suppress for screens that don't show it. */
  showUtilBar?: boolean;
}

const BASE_NAV_ITEMS: ReadonlyArray<{ key: NavKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'forecast',  label: 'Forecast' },
  { key: 'spots',     label: 'Spots & Maps' },
  { key: 'log',       label: 'Log Dive' },
];

const CHARTER_NAV_ITEM = { key: 'charter' as const, label: 'Charter' };

/**
 * Hawaii standard time is UTC−10 year-round (no DST), so we format
 * against the IANA zone 'Pacific/Honolulu' rather than the browser's
 * local zone — the dev machine / users are not necessarily in Hawaii.
 */
const HST_TZ = 'Pacific/Honolulu';
const HST_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: HST_TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const HST_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: HST_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** Build "WED APR 15 · 2:14 PM HST" from a Date, in Hawaii time. */
function formatHawaiiStamp(now: Date): string {
  const parts: Record<string, string> = {};
  for (const p of HST_DATE_FMT.formatToParts(now)) parts[p.type] = p.value;
  const date = `${parts.weekday} ${parts.month} ${parts.day}`.toUpperCase();
  const time = HST_TIME_FMT.format(now); // e.g. "2:14 PM"
  return `${date} · ${time} HST`;
}

/**
 * Live Hawaii clock. Re-renders every 30s — enough for a minute-
 * resolution display — and clears the interval on unmount.
 */
function useHawaiiStamp(): string {
  const [stamp, setStamp] = useState(() => formatHawaiiStamp(new Date()));
  useEffect(() => {
    const id = setInterval(() => setStamp(formatHawaiiStamp(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return stamp;
}

export function DesktopNav({
  active,
  onNavigate,
  userInitials,
  showUtilBar = true,
}: DesktopNavProps) {
  const bp = useBreakpoint();
  const auth = useAuth();
  // Live Hawaii date/time + air temp for the util bar. Temp is sampled
  // from a representative spot's backend report (the nav isn't
  // spot-scoped); it's null while loading, so we omit that segment
  // rather than show a stale number.
  const hawaiiStamp = useHawaiiStamp();
  const airTempF = useHawaiiAirTempF();
  const tempLabel = airTempF != null ? `${airTempF}°F` : null;
  // Prefer the canonical /users/{uid} photoURL (custom upload, kept in
  // sync with mobile) and fall back to the Firebase Auth photo
  // (typically populated for Google sign-in).
  const { profile } = useUserProfile(auth.user?.uid);
  const sidePad = pick(bp, 28, 16);
  const searchWidth = pick(bp, 240, 180);
  const signedIn = auth.user != null;
  const resolvedInitials = userInitials ?? initialsFromUser(auth.user, 'KC');
  const resolvedPhotoURL = profile?.photoURL ?? auth.user?.photoURL ?? null;
  // Charter-affiliated accounts get a "Charter" entry to the right of
  // Log Dive so they can jump to the ops dashboard even when their
  // activeContext is 'consumer' (Personal mode). Surfaced for
  // accountType === 'charter' (the admin role); crew users have their
  // own /crew nav under the crew shell.
  const navItems = auth.accountType === 'charter'
    ? [...BASE_NAV_ITEMS, CHARTER_NAV_ITEM]
    : BASE_NAV_ITEMS;
  return (
    <View style={styles.root}>
      {showUtilBar ? (
        <View style={[styles.utilBarOuter, { paddingHorizontal: sidePad }]}>
          <View style={styles.utilBar}>
            <Image source={{ uri: flags.HI }} style={styles.flag} resizeMode="cover" />
            <Text style={styles.utilText}>
              {tempLabel ? `HAWAII · ${tempLabel} · ${hawaiiStamp}` : `HAWAII · ${hawaiiStamp}`}
            </Text>
            <View style={styles.utilSpacer} />
            <Text style={styles.utilText}>ABYSS FORECASTING MODEL</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.navOuter, { paddingHorizontal: sidePad }]}>
      <View style={[styles.nav, { gap: pick(bp, 28, 16) }]}>
        <Pressable style={styles.logoWrap} onPress={() => onNavigate?.('dashboard')}>
          {/* The exported Figma logo is the full wave-mark + wordmark, so the
              separate KAICAST text used by the prototype is no longer needed. */}
          <Image source={{ uri: logos.kaicast }} style={styles.logoImage} resizeMode="contain" />
        </Pressable>

        <View style={styles.linksWrap}>
          {navItems.map((item) => {
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
          <View style={[styles.searchWrap, { width: searchWidth }]}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              placeholder="Search spots…"
              placeholderTextColor={colors.text3}
              // `outlineStyle` is RN-Web only; not in RN's TextStyle so we
              // attach it inline with a cast rather than inside StyleSheet.
              style={[styles.searchInput, { outlineStyle: 'none' } as object]}
            />
          </View>
          {signedIn ? (
            <>
              <Pressable style={styles.iconBtn}>
                <Text style={styles.bellIcon}>◔</Text>
              </Pressable>
              <Pressable style={styles.avatar} onPress={() => onNavigate?.('profile')}>
                {resolvedPhotoURL ? (
                  <Image
                    source={{ uri: resolvedPhotoURL }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>{resolvedInitials}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.navAuthLinkBtn} onPress={() => onNavigate?.('signin')}>
                <Text style={styles.navAuthLinkText}>Sign in</Text>
              </Pressable>
              <Pressable style={styles.navAuthPrimaryBtn} onPress={() => onNavigate?.('signup')}>
                <Text style={styles.navAuthPrimaryText}>Sign up</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // alignSelf:stretch overrides the page's alignItems:center so the
  // nav fills the full viewport width regardless of the column cap
  // applied to the content below.
  root: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },

  // ── Util bar ─────────────────────────────────────────────────────────
  // Outer takes the full-width hairline; inner caps at DESKTOP_MAX_WIDTH
  // so contents align with the page below (which is centered at that
  // width as well).
  utilBarOuter: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  utilBar: {
    height: UTIL_BAR_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  // Same outer/inner split as the util bar so the nav contents align
  // with the page column below at every viewport width.
  navOuter: {},
  nav: {
    height: NAV_HEIGHT,
    width: '100%',
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.sm,
  },
  avatarText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
    letterSpacing: 0.5,
  },
  navAuthLinkBtn: {
    paddingHorizontal: 14,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAuthLinkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text2,
  },
  navAuthPrimaryBtn: {
    paddingHorizontal: 18,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
  },
  navAuthPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.bg,
  },
});
