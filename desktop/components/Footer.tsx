import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, DESKTOP_MAX_WIDTH } from '../tokens';
import type { NavigateFn, RouteKey } from '../router';

/**
 * Global footer. Mounted by App.tsx beneath every screen so users always
 * have legal + nav links regardless of where they land.
 */

type FooterLink = { label: string; route?: RouteKey; href?: string };

const COLUMNS: ReadonlyArray<{ title: string; links: ReadonlyArray<FooterLink> }> = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard',     route: 'dashboard' },
      { label: 'Spots & Maps',  route: 'spots-map' },
      { label: 'Conditions',    route: 'conditions' },
      { label: 'Log a dive',    route: 'log-dive' },
      { label: 'Community',     route: 'community' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About',         route: 'about' },
      { label: 'Contact',       href: 'mailto:hello@kaicast.com' },
      { label: 'Press',         href: 'mailto:press@kaicast.com' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service',  route: 'terms' },
      { label: 'Privacy Policy',    route: 'privacy' },
      { label: 'Cookie Policy',     route: 'cookies' },
      { label: 'Acceptable Use',    route: 'aup' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'Instagram',     href: 'https://instagram.com/kaicast.app' },
      { label: 'TikTok',        href: 'https://tiktok.com/@kaicast' },
      { label: 'Email',         href: 'mailto:hello@kaicast.com' },
    ],
  },
];

export interface FooterProps {
  onNavigate?: NavigateFn;
}

export function Footer({ onNavigate }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <View style={styles.root}>
      <View style={styles.maxWidth}>
        <View style={styles.columns}>
          {COLUMNS.map((col) => (
            <View key={col.title} style={styles.column}>
              <Text style={styles.columnTitle}>{col.title}</Text>
              {col.links.map((link) => (
                <FooterLinkRow key={link.label} link={link} onNavigate={onNavigate} />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.copy}>© {year} KaiCast · Made with aloha in Hawaii</Text>
          <Text style={styles.copy}>v1.0.0 · Public beta</Text>
        </View>
      </View>
    </View>
  );
}

function FooterLinkRow({
  link,
  onNavigate,
}: {
  link: FooterLink;
  onNavigate?: NavigateFn;
}) {
  const onPress = () => {
    if (link.route) {
      onNavigate?.(link.route);
    } else if (link.href && typeof window !== 'undefined') {
      // External links: open in the same tab for mailto, new tab otherwise.
      const isMailto = link.href.startsWith('mailto:');
      if (isMailto) {
        window.location.href = link.href;
      } else {
        window.open(link.href, '_blank', 'noopener,noreferrer');
      }
    }
  };
  return (
    <Pressable onPress={onPress} style={styles.linkRow}>
      <Text style={styles.linkText}>{link.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface0,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  maxWidth: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 48,
  },
  column: {
    minWidth: 160,
    gap: 8,
  },
  columnTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
    marginBottom: 6,
  },
  linkRow: {
    paddingVertical: 4,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 36,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    flexWrap: 'wrap',
    gap: 12,
  },
  copy: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text4,
    letterSpacing: 0.6,
  },
});
