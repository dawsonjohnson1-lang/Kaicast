import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '@/theme';
import { TabBar } from './TabBar';
import { useAuth } from '@/hooks/useAuth';

import { LoadingScreen } from '@/screens/auth/LoadingScreen';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
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
      initialRouteName="Loading"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <AuthStack.Screen name="Loading" component={LoadingScreen} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="CreateAccount" component={CreateAccountScreen} />
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
  const { isAuthed } = useAuth();

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      >
        {isAuthed ? (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="SpotDetail" component={SpotDetailScreen} />
            <RootStack.Screen name="DiveReportDetail" component={DiveReportDetailScreen} />
            <RootStack.Screen name="LogDive" component={LogDiveScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Followers" component={FollowersScreen} />
            <RootStack.Screen name="Following" component={FollowingScreen} />
            <RootStack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNav} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
