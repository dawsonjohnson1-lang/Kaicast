import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Loading: undefined;
  Welcome: undefined;
  CreateAccount: undefined;
  CreateAccountStep1: undefined;
  CreateAccountAlmostThere: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  SpotDetail: { spotId: string };
  DiveReportDetail: { reportId: string };
  LogDive: undefined;
  Followers: undefined;
  Following: undefined;
  ProfileSettings: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Saved: undefined;
  Explore: undefined;
  Profile: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
export type TabNav = BottomTabNavigationProp<TabParamList>;
export type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;
