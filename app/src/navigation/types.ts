import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
  CreateAccount: undefined;
  CreateAccountStep1: undefined;
  CreateAccountAlmostThere: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  /** `date` is the optional HST YYYY-MM-DD a share link points at.
   *  When omitted the screen renders "now" conditions (today). Set by
   *  the React Navigation `linking` config from
   *  `kaicast://spot/:spotId/:date?` and
   *  `https://kaicast.com/spots/:spotId/:date?` deep links. */
  SpotDetail: { spotId: string; date?: string };
  DiveReportDetail: { reportId: string };
  LogDive: undefined;
  Followers: undefined;
  Following: undefined;
  ProfileSettings: undefined;
  DeleteAccount: undefined;
  DiscoverUsers: undefined;
  Charter: undefined;
  /** Per-trip captain's log form. Reached from the Logs tab. */
  LogsTrip: { tripId: string };
  /** Final review + submit surface for the day's captain's log. */
  LogsSubmit: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Saved: undefined;
  Explore: undefined;
  /** Charter-tier only — see DailyLogScreen for the gate behavior. */
  Logs: undefined;
  Profile: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
export type TabNav = BottomTabNavigationProp<TabParamList>;
export type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;
