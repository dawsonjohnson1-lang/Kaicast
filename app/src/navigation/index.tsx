import React from 'react';
import { NavigationContainer, DefaultTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '@/theme';
import { TabBar } from './TabBar';
import { LoadingView } from '@/components/LoadingView';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { CharterRoleProvider } from '@/hooks/useCharterRole';

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { CreateAccountScreen } from '@/screens/auth/CreateAccountScreen';
import { CreateAccountStep1Screen } from '@/screens/auth/CreateAccountStep1Screen';
import { CreateAccountAlmostThereScreen } from '@/screens/auth/CreateAccountAlmostThereScreen';

import { HomeScreen } from '@/screens/home/HomeScreen';
import { SavedSpotsScreen } from '@/screens/home/SavedSpotsScreen';
import { ExploreScreen } from '@/screens/explore/ExploreScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { SpotDetailScreen } from '@/screens/spot/SpotDetailScreen';
import { DiveReportDetailScreen } from '@/screens/profile/DiveReportDetailScreen';
import { LogDiveScreen } from '@/screens/log/LogDiveScreen';
import { FollowersScreen } from '@/screens/profile/FollowersScreen';
import { FollowingScreen } from '@/screens/profile/FollowingScreen';
import { ProfileSettingsScreen } from '@/screens/profile/ProfileSettingsScreen';
import { DeleteAccountScreen } from '@/screens/profile/DeleteAccountScreen';
import { DiscoverUsersScreen } from '@/screens/profile/DiscoverUsersScreen';
import { CharterDashboard } from '@/screens/charter/CharterDashboard';
import { DailyLogScreen } from '@/screens/charter/DailyLogScreen';
import { TripLogScreen } from '@/screens/charter/TripLogScreen';
import { SubmitLogScreen } from '@/screens/charter/SubmitLogScreen';

import type { AuthStackParamList, RootStackParamList, TabParamList } from './types';

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accent,
  },
};

// Deep-link routing for share URLs.
//
// Two surfaces share the same payload (`{ spotId, date? }`):
//   - kaicast://spot/:spotId/:date?   — custom-scheme link the
//     spotSharePage HTML fires from its <script>; works when the app
//     is installed and the OS routes the scheme back to us.
//   - https://kaicast.com/spots/:spotId/:date? — Universal Link path.
//     Activated once apple-app-site-association lands at kaicast.com
//     with the live Apple team ID; until then this stays a no-op
//     since iOS won't intercept the URL without the AASA handshake.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kaicast://', 'https://kaicast.com'],
  config: {
    initialRouteName: 'Main',
    screens: {
      // `screens.SpotDetail` accepts both `spot/:spotId/:date?`
      // (custom scheme route) and `spots/:spotId/:date?` (Universal
      // Link route). React Navigation matches the first pattern that
      // fits, so listing both lets a single screen back both paths.
      SpotDetail: {
        path: 'spot/:spotId/:date?',
        parse: {
          spotId: (v: string) => decodeURIComponent(v),
          date:   (v: string) => decodeURIComponent(v),
        },
      },
    },
  },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function AuthNav() {
  return (
    <AuthStack.Navigator
      initialRouteName="CreateAccount"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <AuthStack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// Multi-step onboarding stack — shown to authenticated users whose
// `users/{uid}` profile doc has `onboardingComplete !== true`. Once
// CreateAccountAlmostThereScreen flips that flag the navigator
// re-renders and routes into the main app.
function OnboardingNav() {
  return (
    <AuthStack.Navigator
      initialRouteName="CreateAccountStep1"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <AuthStack.Screen name="CreateAccountStep1" component={CreateAccountStep1Screen} />
      <AuthStack.Screen name="CreateAccountAlmostThere" component={CreateAccountAlmostThereScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <TabBar {...props} />}
      sceneContainerStyle={{ backgroundColor: colors.bg }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="Dashboard" component={HomeScreen} />
      <Tabs.Screen name="Saved" component={SavedSpotsScreen} />
      <Tabs.Screen name="Explore" component={ExploreScreen} />
      {/* Logs tab is always present in the bar — the screen itself
          renders the charter-tier upsell card when the user isn't on
          the charter plan. Keeps the tab layout stable across
          upgrades + dev role-switching. */}
      <Tabs.Screen name="Logs" component={DailyLogScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { user, isAuthed, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);
  // Refreshes the push token doc whenever a user is authed AND has
  // already granted notification permission. Doesn't prompt — that's
  // user-initiated via the Settings toggle.
  usePushRegistration(user?.id);

  // Three phases:
  //   1. unauthed → AuthNav (CreateAccount / Login)
  //   2. authed but profile doc missing onboardingComplete → OnboardingNav
  //      (Step 1 → AlmostThere). Live snapshot listener in
  //      useUserProfile flips this the moment AlmostThere writes
  //      onboardingComplete:true.
  //   3. authed + onboarded → MainTabs + the rest of the root stack.
  // Branded loading view (diver background + animated logo) while we
  // resolve auth and profile state. Also prevents the CreateAccount
  // flash a returning user would otherwise see before MainTabs mounts.
  if (authLoading || (isAuthed && profileLoading)) {
    return <LoadingView />;
  }

  const phase: 'auth' | 'onboarding' | 'main' = !isAuthed
    ? 'auth'
    : profile?.onboardingComplete === true
      ? 'main'
      : 'onboarding';

  // CharterRoleProvider sits above NavigationContainer so the single
  // role useState instance is shared across every screen — the dev
  // role-switcher in CharterDashboard, the read-only gate in
  // DailyLogScreen, and any future consumer all read from the same
  // store. Wrapping each RootStack.Screen individually would give
  // them isolated state and silently re-introduce the bug this
  // refactor fixes. Auth + onboarding phases don't consume the
  // context but mounting it there is free (no consumers, no renders).
  return (
    <CharterRoleProvider>
    <NavigationContainer theme={navTheme} linking={linking}>
      <RootStack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      >
        {phase === 'main' && (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="SpotDetail" component={SpotDetailScreen} />
            <RootStack.Screen name="DiveReportDetail" component={DiveReportDetailScreen} />
            <RootStack.Screen name="LogDive" component={LogDiveScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Followers" component={FollowersScreen} />
            <RootStack.Screen name="Following" component={FollowingScreen} />
            <RootStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
            <RootStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            <RootStack.Screen name="DiscoverUsers" component={DiscoverUsersScreen} />
            {/* Charter Dashboard — gate is enforced inside the screen
                itself (CharterDashboard checks profile.accountType ===
                'charter'). Registered here unconditionally so deep
                links don't break for charter users; non-charter
                visitors get bounced back from inside the screen. */}
            <RootStack.Screen name="Charter" component={CharterDashboard} />
            {/* Captain's Log nested screens — DailyLogScreen lives on
                the Logs tab; these two are pushed onto the root stack
                from there. Tier gate is enforced inside each screen
                (mirrors CharterDashboard's pattern) so deep links
                degrade gracefully. */}
            <RootStack.Screen name="LogsTrip" component={TripLogScreen} />
            <RootStack.Screen name="LogsSubmit" component={SubmitLogScreen} />
          </>
        )}
        {phase === 'onboarding' && (
          <RootStack.Screen name="Auth" component={OnboardingNav} />
        )}
        {phase === 'auth' && (
          <RootStack.Screen name="Auth" component={AuthNav} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
    </CharterRoleProvider>
  );
}
