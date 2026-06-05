import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH } from './tokens';
import { DesktopNav } from './components/DesktopNav';
import type { NavigateFn } from './router';

/**
 * Public marketing landing page. Shown when signed-out users hit the root.
 * Three sections: hero, features ("what's in it"), and a closing CTA. All
 * routes the user can click lead back to /signup or /signin.
 */

const FEATURES = [
  {
    title: 'Five-tier condition ratings',
    body:
      'Real models — wind, swell, runoff, current, visibility — fuse into one quick read per spot.',
  },
  {
    title: 'Live buoys & satellite',
    body:
      'NDBC buoy data, CoastWatch ocean-color, and a 7-day outlook from NOAA — all in one place.',
  },
  {
    title: 'Track every dive',
    body:
      'Log depth, viz, marine life, and conditions. Your dives feed back into the community baseline.',
  },
  {
    title: 'Community calibration',
    body:
      'Every signed-in diver makes the forecast sharper. Your last log narrows the next prediction.',
  },
  {
    title: 'Built for Hawaii',
    body:
      '47 named spots across Oʻahu, Maui, Kauaʻi, Hawaiʻi, and Molokaʻi — with the local nuance.',
  },
  {
    title: 'Open data',
    body:
      'Free for divers, forever. Pro tier unlocks 16-day forecasts and custom alerts.',
  },
];

export interface LandingScreenProps {
  onNavigate?: NavigateFn;
}

export function LandingScreen({ onNavigate }: LandingScreenProps) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <DesktopNav active="dashboard" onNavigate={onNavigate} />

      <View style={styles.maxWidth}>
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <View style={styles.heroPillDot} />
            <Text style={styles.heroPillText}>NOW IN PUBLIC BETA · HAWAII</Text>
          </View>
          <Text style={styles.heroTitle}>
            The dive forecast{'\n'}for <Text style={styles.heroTitleAccent}>Hawaii.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Five-tier condition ratings, real-time buoy data, satellite ocean color, and
            community dive logs — built for divers across the islands.
          </Text>
          <View style={styles.heroCtas}>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => onNavigate?.('signup')}
            >
              <Text style={styles.btnPrimaryText}>Create your account</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => onNavigate?.('spots-map')}
            >
              <Text style={styles.btnSecondaryText}>Explore spots →</Text>
            </Pressable>
          </View>
          <Text style={styles.heroFinePrint}>
            Free for divers. Sign in with Google or email — no credit card required.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureBody}>{f.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.closingCta}>
          <Text style={styles.closingTitle}>Better dives start with better data.</Text>
          <Text style={styles.closingSub}>
            Join the community and start logging dives today.
          </Text>
          <Pressable
            style={[styles.btn, styles.btnPrimary, styles.btnLarge]}
            onPress={() => onNavigate?.('signup')}
          >
            <Text style={styles.btnPrimaryText}>Get started — it's free</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { alignItems: 'center' },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    paddingHorizontal: 32,
    paddingBottom: 64,
  },

  hero: {
    paddingTop: 80,
    paddingBottom: 64,
    alignItems: 'center',
    gap: 18,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(9,161,251,0.30)',
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  heroPillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 78,
    letterSpacing: -1.5,
    color: colors.text1,
    textAlign: 'center',
  },
  heroTitleAccent: {
    color: colors.accent,
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 28,
    color: colors.text2,
    textAlign: 'center',
    maxWidth: 640,
    marginTop: 8,
  },
  heroCtas: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  heroFinePrint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text3,
    marginTop: 4,
  },

  btn: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLarge: {
    height: 54,
    paddingHorizontal: 28,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '700',
    color: colors.bg,
  },
  btnSecondary: {
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  btnSecondaryText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
  },

  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 32,
  },
  featureCard: {
    flexBasis: '32%',
    flexGrow: 1,
    minWidth: 280,
    padding: 24,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface0,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  featureTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: -0.2,
  },
  featureBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text2,
  },

  closingCta: {
    marginTop: 64,
    paddingVertical: 64,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  closingTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: '800',
    color: colors.text1,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  closingSub: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text2,
    marginBottom: 8,
  },
});
