import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, DESKTOP_MAX_WIDTH } from '../tokens';
import type { NavigateFn } from '../router';

const LS_KEY = 'kaicast.cookies.consent';

type Consent = 'accepted' | 'declined' | null;

function readConsent(): Consent {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(LS_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(c: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem(LS_KEY, c);
  } catch {}
}

export interface CookieBannerProps {
  onNavigate?: NavigateFn;
}

export function CookieBanner({ onNavigate }: CookieBannerProps) {
  const [consent, setConsent] = React.useState<Consent>(() => readConsent());

  // Re-check on mount in case another tab set it after this one rendered.
  React.useEffect(() => {
    setConsent(readConsent());
  }, []);

  if (consent !== null) return null;

  const accept = () => { writeConsent('accepted'); setConsent('accepted'); };
  const decline = () => { writeConsent('declined'); setConsent('declined'); };

  return (
    <View
      // `position: fixed` is RN-Web only and not typed in StyleSheet; apply
      // inline. Also use inline boxShadow for the same typing reason.
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        padding: 20,
        zIndex: 1000,
      } as unknown as object}
      pointerEvents="box-none"
    >
      <View
        style={[styles.card, { boxShadow: '0 12px 32px rgba(0,0,0,0.45)' } as object]}
      >
        <Text style={styles.text}>
          KaiCast uses cookies to keep you signed in and remember your preferences.
          {'  '}
          <Text style={styles.link} onPress={() => onNavigate?.('cookies')}>
            See our Cookie Policy
          </Text>
          .
        </Text>
        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={decline}>
            <Text style={styles.btnGhostText}>Decline</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={accept}>
            <Text style={styles.btnPrimaryText}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: colors.surface1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  text: {
    flex: 1,
    minWidth: 280,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 18,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  btnGhostText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text2,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.bg,
  },
});
