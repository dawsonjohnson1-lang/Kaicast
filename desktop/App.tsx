import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from './tokens';

import { SpotDetailScreen } from './SpotDetailScreen';
import { ConditionsScreen } from './ConditionsScreen';
import { SpotsMapScreen } from './SpotsMapScreen';
import { DashboardScreen } from './DashboardScreen';
import { ProfileScreen } from './ProfileScreen';
import { LogDiveScreen } from './LogDiveScreen';

/**
 * Dev harness shell. Picks a screen and renders it underneath a small
 * floating chip. Not shipped to prod — purely for previewing the 6
 * screens during design review.
 */

const SCREENS = [
  { key: 'spot-detail', label: 'Spot Detail',       component: SpotDetailScreen },
  { key: 'conditions',  label: 'Conditions',        component: ConditionsScreen },
  { key: 'spots-map',   label: 'Spots & Maps',      component: SpotsMapScreen },
  { key: 'dashboard',   label: 'Dashboard',         component: DashboardScreen },
  { key: 'profile',     label: 'Profile',           component: ProfileScreen },
  { key: 'log-dive',    label: 'Log Dive',          component: LogDiveScreen },
] as const;

type ScreenKey = (typeof SCREENS)[number]['key'];

const LS_KEY = 'kaicast.desktop.previewScreen';

export function App() {
  const [active, setActive] = React.useState<ScreenKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage?.getItem(LS_KEY) as ScreenKey | null;
      if (saved && SCREENS.some((s) => s.key === saved)) return saved;
    }
    return 'spot-detail';
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(LS_KEY, active);
    }
  }, [active]);

  const ScreenComponent = SCREENS.find((s) => s.key === active)?.component ?? SpotDetailScreen;

  return (
    <View style={styles.root}>
      <ScreenComponent />
      <PreviewPicker active={active} onPick={setActive} />
    </View>
  );
}

function PreviewPicker({ active, onPick }: { active: ScreenKey; onPick: (k: ScreenKey) => void }) {
  const [collapsed, setCollapsed] = React.useState(false);

  if (collapsed) {
    return (
      <Pressable
        style={[styles.fab, { boxShadow: '0 6px 20px rgba(9,161,251,0.45)' } as object]}
        onPress={() => setCollapsed(false)}
      >
        <Text style={styles.fabText}>⌥</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.picker, { boxShadow: '0 6px 32px rgba(0,0,0,0.4)' } as object]}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>PREVIEW</Text>
        <Pressable onPress={() => setCollapsed(true)} hitSlop={8}>
          <Text style={styles.pickerCollapse}>×</Text>
        </Pressable>
      </View>
      <View style={styles.pickerList}>
        {SCREENS.map((s) => {
          const isActive = s.key === active;
          return (
            <Pressable
              key={s.key}
              onPress={() => onPick(s.key)}
              style={[styles.pickerBtn, isActive && styles.pickerBtnActive]}
            >
              <Text style={[styles.pickerBtnText, isActive && styles.pickerBtnTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    backgroundColor: colors.bg,
  },
  picker: {
    position: 'fixed' as unknown as 'absolute',
    bottom: 16,
    right: 16,
    width: 180,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(12,16,21,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 6,
    zIndex: 1000,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  pickerTitle: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    fontWeight: '700',
  },
  pickerCollapse: {
    fontSize: 16,
    color: colors.text3,
    paddingHorizontal: 4,
  },
  pickerList: {
    gap: 2,
  },
  pickerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pickerBtnActive: {
    backgroundColor: colors.accentDim,
  },
  pickerBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  pickerBtnTextActive: {
    color: colors.text1,
    fontWeight: '600',
  },
  fab: {
    position: 'fixed' as unknown as 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  fabText: {
    fontSize: 16,
    color: colors.bg,
    fontWeight: '700',
  },
});
