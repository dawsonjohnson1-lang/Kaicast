import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from './tokens';
import type { NavigateFn, RouteKey, RouteParams } from './router';

import { SpotDetailScreen } from './SpotDetailScreen';
import { ConditionsScreen } from './ConditionsScreen';
import { SpotsMapScreen } from './SpotsMapScreen';
import { DashboardScreen } from './DashboardScreen';
import { ProfileScreen } from './ProfileScreen';
import { LogDiveScreen } from './LogDiveScreen';
import { MyDivesScreen } from './MyDivesScreen';
import { CommunityScreen } from './CommunityScreen';

/**
 * Desktop preview shell — now a real router.
 *
 * Maintains a small history stack so the floating picker can offer
 * back/forward + persists the current route to localStorage so reloads
 * land on the same screen.
 *
 * Each screen receives `onNavigate(routeKey, params?)` and uses it for
 * its CTAs, nav links, card clicks, etc.
 */

const SCREENS: Record<RouteKey, { label: string; component: React.ComponentType<any> }> = {
  'dashboard':    { label: 'Dashboard',    component: DashboardScreen },
  'spot-detail':  { label: 'Spot Detail',  component: SpotDetailScreen },
  'conditions':   { label: 'Conditions',   component: ConditionsScreen },
  'spots-map':    { label: 'Spots & Maps', component: SpotsMapScreen },
  'log-dive':     { label: 'Log Dive',     component: LogDiveScreen },
  'profile':      { label: 'Profile',      component: ProfileScreen },
  'my-dives':     { label: 'My Dives',     component: MyDivesScreen },
  'community':    { label: 'Community',    component: CommunityScreen },
};

const ROUTE_ORDER: RouteKey[] = [
  'dashboard',
  'spot-detail',
  'conditions',
  'spots-map',
  'log-dive',
  'profile',
  'my-dives',
  'community',
];

const LS_KEY = 'kaicast.desktop.route';

type Frame = { route: RouteKey; params?: RouteParams };

export function App() {
  const [history, setHistory] = React.useState<Frame[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage?.getItem(LS_KEY);
      if (saved && ROUTE_ORDER.includes(saved as RouteKey)) {
        return [{ route: saved as RouteKey }];
      }
    }
    return [{ route: 'dashboard' }];
  });
  const [cursor, setCursor] = React.useState(0);

  const current = history[cursor];

  const navigate: NavigateFn = React.useCallback((route, params) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, cursor + 1); // drop forward history on new nav
      return [...truncated, { route, params }];
    });
    setCursor((c) => c + 1);
  }, [cursor]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(LS_KEY, current.route);
      // Scroll to top on navigation so deep pages don't land mid-scroll.
      window.scrollTo(0, 0);
    }
  }, [current.route]);

  const goBack    = () => setCursor((c) => Math.max(0, c - 1));
  const goForward = () => setCursor((c) => Math.min(history.length - 1, c + 1));
  const canBack    = cursor > 0;
  const canForward = cursor < history.length - 1;

  const ScreenComponent = SCREENS[current.route].component;

  return (
    <View style={styles.root}>
      {/* `key` forces re-mount when navigating between same-route entries
          with different params; for now most screens ignore params, so
          re-mounting is harmless. */}
      <ScreenComponent
        key={`${current.route}-${cursor}`}
        onNavigate={navigate}
      />
      <PreviewPicker
        active={current.route}
        onPick={(r) => navigate(r)}
        onBack={goBack}
        onForward={goForward}
        canBack={canBack}
        canForward={canForward}
      />
    </View>
  );
}

function PreviewPicker({
  active,
  onPick,
  onBack,
  onForward,
  canBack,
  canForward,
}: {
  active: RouteKey;
  onPick: (r: RouteKey) => void;
  onBack: () => void;
  onForward: () => void;
  canBack: boolean;
  canForward: boolean;
}) {
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
        <View style={styles.pickerHistoryBtns}>
          <Pressable
            onPress={onBack}
            disabled={!canBack}
            style={[styles.histBtn, !canBack && styles.histBtnDisabled]}
          >
            <Text style={[styles.histBtnText, !canBack && styles.histBtnTextDisabled]}>←</Text>
          </Pressable>
          <Pressable
            onPress={onForward}
            disabled={!canForward}
            style={[styles.histBtn, !canForward && styles.histBtnDisabled]}
          >
            <Text style={[styles.histBtnText, !canForward && styles.histBtnTextDisabled]}>→</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setCollapsed(true)} hitSlop={8}>
          <Text style={styles.pickerCollapse}>×</Text>
        </Pressable>
      </View>
      <View style={styles.pickerList}>
        {ROUTE_ORDER.map((r) => {
          const isActive = r === active;
          return (
            <Pressable
              key={r}
              onPress={() => onPick(r)}
              style={[styles.pickerBtn, isActive && styles.pickerBtnActive]}
            >
              <Text style={[styles.pickerBtnText, isActive && styles.pickerBtnTextActive]}>
                {SCREENS[r].label}
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
    width: 200,
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
    gap: 8,
  },
  pickerTitle: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text3,
    fontWeight: '700',
  },
  pickerHistoryBtns: {
    flexDirection: 'row',
    gap: 2,
  },
  histBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  histBtnDisabled: {
    opacity: 0.3,
  },
  histBtnText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.text2,
  },
  histBtnTextDisabled: {
    color: colors.text4,
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
