import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '@/theme';
import { TabBar } from './TabBar';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';

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
      screenOptions={{
        headerShown: false,
        sceneContainerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="Dashboard" component={HomeScreen} />
      <Tabs.Screen name="Saved" component={SavedSpotsScreen} />
      <Tabs.Screen name="Explore" component={ExploreScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { user, isAuthed, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile(user?.id);

  // Three phases:
  //   1. unauthed → AuthNav (CreateAccount / Login)
  //   2. authed but profile doc missing onboardingComplete → OnboardingNav
  //      (Step 1 → AlmostThere). Live snapshot listener in
  //      useUserProfile flips this the moment AlmostThere writes
  //      onboardingComplete:true.
  //   3. authed + onboarded → MainTabs + the rest of the root stack.
  // During auth/profile bootstrap we render a blank dark fill — no
  // branded splash, but it stops a returning user from seeing
  // CreateAccount flash before MainTabs takes over.
  if (authLoading || (isAuthed && profileLoading)) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const phase: 'auth' | 'onboarding' | 'main' = !isAuthed
    ? 'auth'
    : profile?.onboardingComplete === true
      ? 'main'
      : 'onboarding';

  return (
    <NavigationContainer theme={navTheme}>
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
  );
}
