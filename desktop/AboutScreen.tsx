import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH } from './tokens';
import { DesktopNav } from './components/DesktopNav';
import { useBreakpoint, pick } from './hooks/useBreakpoint';
import type { NavigateFn } from './router';

/**
 * About — desktop screen. Static informational page that introduces
 * KaiCast, the Abyss forecasting model, and the team behind it.
 *
 * Renders below DesktopNav like other content screens. Linked from
 * the Footer "About" entry.
 */

export interface AboutScreenProps {
  onNavigate?: NavigateFn;
}

const SUPPORT_EMAIL = 'dawson@kaicast.com';

const LAYERS: Array<{ num: string; name: string; source: string; text: string }> = [
  {
    num: '01', name: 'Satellite baseline',
    source: 'VIIRS · NOAA-20',
    text: 'Ocean-color KD490 gives us a clear-water visibility ceiling per spot, refreshed daily.',
  },
  {
    num: '02', name: 'Wave energy',
    source: 'Open-Meteo Marine',
    text: 'Height, period, and direction mapped through each spot’s exposure geometry.',
  },
  {
    num: '03', name: 'Tidal flushing',
    source: 'NOAA Tides',
    text: 'Rise and fall driven by real station data, with extra weight near stream mouths and harbor drains.',
  },
  {
    num: '04', name: 'Runoff risk',
    source: 'OpenWeather',
    text: 'Rainfall over the last 1, 6, 24, 48, and 72 hours, weighted by each spot’s drainage profile.',
  },
  {
    num: '05', name: 'Algal bloom',
    source: 'VIIRS chlorophyll-a',
    text: 'Flags blooms and elevated turbidity invisible to the naked eye until you splash in.',
  },
  {
    num: '06', name: 'Solar + shadow',
    source: 'KaiCast horizon model',
    text: 'Sun altitude plus local mountain shadow per hour. A dawn dive reads very different from noon.',
  },
  {
    num: '07', name: 'Subsurface profile',
    source: 'PacIOOS ROMS',
    text: 'Surface currents and thermocline depth, with a wind-driven heuristic fallback when ROMS lags.',
  },
];

export function AboutScreen({ onNavigate }: AboutScreenProps) {
  const bp = useBreakpoint();
  const sidePad = pick(bp, 28, 16);
  // Layer-card grid responds to breakpoint: 3 wide on big screens, 2 on
  // mid, 1 on small.
  const layerCols = pick(bp, 3, 2);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const prev = document.title;
      document.title = 'About · KaiCast';
      return () => { document.title = prev; };
    }
  }, []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active="dashboard" onNavigate={onNavigate} />

      <View style={[styles.body, { paddingHorizontal: sidePad }]}>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.kickerPill}>
            <View style={styles.kickerDot} />
            <Text style={styles.kicker}>ABOUT KAICAST</Text>
          </View>
          <Text style={styles.h1}>Honest underwater forecasts,{'\n'}one spot at a time.</Text>
          <Text style={styles.lede}>
            KaiCast is a Hawaii-first dive and freediving forecast — a tool built by divers
            who got tired of guessing whether the trip out was going to be worth it. We combine
            satellite ocean color, real-time buoy and tide feeds, regional ocean models, and
            on-the-ground dive logs into a single, honest read on what the water is doing today
            and what it will do this week.
          </Text>
          <View style={styles.heroStats}>
            <HeroStat value="25" label="Hawaiian spots" />
            <HeroStat value="7"  label="Forecast layers" />
            <HeroStat value="24h" label="Refresh cadence" />
          </View>
        </View>

        {/* ── The Abyss model (card grid) ──────────────────────── */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionKicker}>THE ABYSS MODEL</Text>
            <Text style={styles.h2}>Seven layers, one honest score.</Text>
            <Text style={styles.h2Sub}>
              Each layer captures one physical truth about what makes a dive worth the drive.
              We weight them by what each spot actually cares about — Hanauma Bay’s
              exposure matters more than its swell; Molokini’s clarity matters more than
              its wind.
            </Text>
          </View>

          <View style={[styles.layerGrid, { gap: 16 }]}>
            {LAYERS.map((layer) => (
              <View
                key={layer.num}
                style={[
                  styles.layerCard,
                  // Equal-width grid; flexBasis carves the row into `layerCols`.
                  { flexBasis: `calc(${100 / layerCols}% - ${(16 * (layerCols - 1)) / layerCols}px)` as unknown as number },
                ]}
              >
                <View style={styles.layerCardHeader}>
                  <Text style={styles.layerNum}>{layer.num}</Text>
                  <Text style={styles.layerSource}>{layer.source}</Text>
                </View>
                <Text style={styles.layerName}>{layer.name}</Text>
                <Text style={styles.layerText}>{layer.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Why / What's next two-up ─────────────────────────── */}
        <View style={styles.twoUpRow}>
          <View style={styles.twoUpCol}>
            <Text style={styles.sectionKicker}>WHY WE BUILT IT</Text>
            <Text style={styles.h3}>Dive-first, not surf-second.</Text>
            <Text style={styles.body1}>
              Surf forecasts have been a real product for two decades. Dive forecasts haven’t —
              divers have made do with buoy reports written for boats, NOAA tide tables built for
              fishermen, and a phone call to whoever happened to be out that morning.
            </Text>
            <Text style={styles.body1}>
              KaiCast is the dive-first version of that toolkit. Built by divers, in Hawaii, against
              the ocean we actually swim in.
            </Text>
          </View>

          <View style={styles.twoUpCol}>
            <Text style={styles.sectionKicker}>WHAT&rsquo;S NEXT</Text>
            <Text style={styles.h3}>Hand-written guides, more coasts.</Text>
            <Text style={styles.body1}>
              We’re adding spot guides written by KaiCast forecasters with real water time at
              each location. The automated bio you see today is a placeholder until our team gets there.
            </Text>
            <Text style={styles.body1}>
              And we’re expanding past Hawaii. If you want KaiCast at your home spot, drop us a line.
            </Text>
          </View>
        </View>

        {/* ── Contact card ─────────────────────────────────────── */}
        <View style={styles.contactCard}>
          <Text style={styles.sectionKicker}>GET IN TOUCH</Text>
          <Text style={styles.contactHeadline}>
            Bug report, spot request, partnership — it all comes to one inbox.
          </Text>
          <Pressable
            style={styles.contactBtn}
            onPress={() => {
              if (typeof window !== 'undefined') {
                window.location.href = `mailto:${SUPPORT_EMAIL}`;
              }
            }}
          >
            <Text style={styles.contactBtnIcon}>✉</Text>
            <Text style={styles.contactBtnText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>

        {/* ── CTA back to forecast ────────────────────────────── */}
        <View style={styles.footerCta}>
          <Pressable
            style={styles.ctaBtn}
            onPress={() => onNavigate?.('spots-map')}
          >
            <Text style={styles.ctaBtnText}>See today&rsquo;s forecast</Text>
            <Text style={styles.ctaBtnArrow}>→</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },

  // Centered column for everything below the nav.
  body: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: 80,
    paddingBottom: 96,
    gap: 96,
    alignItems: 'center',
  },

  // ── Hero ────────────────────────────────────────────────────────
  hero: {
    width: '100%',
    maxWidth: 820,
    gap: 20,
    alignItems: 'center',
  },
  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
    fontWeight: '700',
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 60,
    color: colors.text1,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
  },
  lede: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 28,
    color: colors.text2,
    textAlign: 'center',
    maxWidth: 720,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 48,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    width: '100%',
    justifyContent: 'center',
  },
  heroStat: { alignItems: 'center', gap: 6 },
  heroStatValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text1,
    fontWeight: '700',
  },
  heroStatLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text3,
    fontWeight: '600',
  },

  // ── Sections ───────────────────────────────────────────────────
  sectionWrap: { width: '100%', gap: 32, alignItems: 'center' },
  sectionHeader: { alignItems: 'center', gap: 14, maxWidth: 720 },
  sectionKicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
    fontWeight: '700',
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 42,
    color: colors.text1,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  h2Sub: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text3,
    textAlign: 'center',
  },
  h3: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text1,
    fontWeight: '700',
  },
  body1: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text2,
  },

  // ── Layer cards ────────────────────────────────────────────────
  layerGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  layerCard: {
    minWidth: 240,
    padding: 22,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface1,
    gap: 10,
  },
  layerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  layerNum: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    fontWeight: '700',
  },
  layerSource: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.text4,
    fontWeight: '600',
  },
  layerName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text1,
    fontWeight: '700',
  },
  layerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text2,
  },

  // ── Two-up ─────────────────────────────────────────────────────
  twoUpRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    justifyContent: 'center',
  },
  twoUpCol: {
    flexGrow: 1,
    flexBasis: 360,
    maxWidth: 520,
    gap: 12,
    padding: 28,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface1,
  },

  // ── Contact card ───────────────────────────────────────────────
  contactCard: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
    gap: 16,
  },
  contactHeadline: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 30,
    color: colors.text1,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 480,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: colors.text1,
    borderRadius: 999,
    marginTop: 4,
  },
  contactBtnIcon: {
    fontSize: 14,
    color: '#04070d',
  },
  contactBtnText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#04070d',
    fontWeight: '600',
  },

  // ── CTA back to forecast ───────────────────────────────────────
  footerCta: { width: '100%', alignItems: 'center', marginTop: 8 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  ctaBtnText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: '#04070d',
    fontWeight: '600',
  },
  ctaBtnArrow: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: '#04070d',
    fontWeight: '600',
  },
});
