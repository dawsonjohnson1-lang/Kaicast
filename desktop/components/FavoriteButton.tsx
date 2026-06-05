import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../tokens';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../hooks/useAuth';
import type { NavigateFn, RouteKey } from '../router';

/**
 * Heart button that toggles a spot's favorite state.
 *
 * - Signed-in: clicking toggles the favorite set immediately.
 * - Signed-out: bounces to /signin?returnTo=<current> so they can
 *   come back and click again after auth.
 *
 * Two visual variants:
 *   variant="hero"   — pill button with text "Favorite" / "Favorited",
 *                       sized for spot-detail headers
 *   variant="icon"   — bare heart glyph, sized for inline list rows
 */

export type FavoriteButtonVariant = 'hero' | 'icon';

export interface FavoriteButtonProps {
  spotId: string;
  variant?: FavoriteButtonVariant;
  /** Where to send signed-out users after they sign in (defaults to current). */
  returnTo?: RouteKey;
  onNavigate?: NavigateFn;
}

export function FavoriteButton({
  spotId,
  variant = 'icon',
  returnTo,
  onNavigate,
}: FavoriteButtonProps) {
  const favs = useFavorites();
  const auth = useAuth();
  const on = favs.isFavorite(spotId);

  const onPress = () => {
    if (!auth.user) {
      onNavigate?.('signin', { returnTo: returnTo ?? 'spot-detail' });
      return;
    }
    favs.toggle(spotId);
  };

  if (variant === 'hero') {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.heroBtn, on && styles.heroBtnOn]}
        accessibilityLabel={on ? 'Remove from favorites' : 'Save to favorites'}
      >
        <Text style={[styles.heroGlyph, on && styles.heroGlyphOn]}>{on ? '♥' : '♡'}</Text>
        <Text style={[styles.heroLabel, on && styles.heroLabelOn]}>
          {on ? 'Saved' : 'Save'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={styles.iconBtn}
      hitSlop={8}
      accessibilityLabel={on ? 'Remove from favorites' : 'Save to favorites'}
    >
      <Text style={[styles.iconGlyph, on && styles.iconGlyphOn]}>{on ? '♥' : '♡'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ── Hero variant ─────────────────────────────────────────────────
  // Sized to match the LIVE badge + ConditionPill md in the spot-detail
  // header row (both are 20px tall). Slightly taller (24px) so it still
  // feels tappable, but no longer dominates the neighboring pills.
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  heroBtnOn: {
    backgroundColor: 'rgba(247,55,38,0.10)',
    borderColor: 'rgba(247,55,38,0.40)',
  },
  heroGlyph: {
    fontSize: 12,
    color: colors.text2,
    lineHeight: 14,
  },
  heroGlyphOn: {
    color: colors.nogo,
  },
  heroLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: colors.text2,
  },
  heroLabelOn: {
    color: colors.text1,
  },

  // ── Icon variant ─────────────────────────────────────────────────
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  iconGlyph: {
    fontSize: 18,
    color: colors.text3,
    lineHeight: 20,
  },
  iconGlyphOn: {
    color: colors.nogo,
  },
});
