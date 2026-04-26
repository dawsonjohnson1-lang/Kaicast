# KaiCast App

React Native (Expo) mobile app for KaiCast — built from the Figma `KAICAST APP` design and wired to the existing Firebase Functions backend in this same repo.

## Stack
- Expo SDK 51 (React Native 0.74)
- TypeScript (strict)
- React Navigation (bottom tabs + native stack)
- `react-native-svg` for icons + charts
- `expo-linear-gradient`, `expo-blur`
- `@react-native-async-storage/async-storage` for auth persistence

## Run it

```bash
cd app
npm install
npm run start          # opens Expo dev tools
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run web            # browser
```

> The app uses dark mode only (matching the Figma).
> A `Skip for now (demo)` button on the Welcome screen lets you bypass auth.

## Backend wiring

`src/api/kaicast.ts` calls the Firebase Function `fetchKaiCastNow` deployed
from `/functions` in this repo. Override the base URL via `app.json → extra.kaicastApiBase`
or by editing the file directly if you deploy under a different region/project.

```ts
import { triggerFetchNow } from '@/api/kaicast';
await triggerFetchNow();   // GET https://<region>-kaicast.cloudfunctions.net/fetchKaiCastNow
```

The shape returned from the backend is mirrored in `BackendReport` so screens
can be re-pointed from `mockData.ts` to live data with minimal churn.

## Project layout

```
app/
├── App.tsx                       # entry — auth + navigation providers
├── app.json                      # Expo config
├── src/
│   ├── api/                      # backend client + mock data
│   ├── components/               # design-system primitives + composite cards
│   ├── hooks/                    # useAuth, useReports
│   ├── navigation/               # auth stack, root stack, bottom tabs
│   ├── screens/
│   │   ├── auth/                 # Loading, Welcome, Create-account flow
│   │   ├── home/                 # Dashboard + Saved Spots
│   │   ├── spot/                 # Spot detail (Overview / Conditions / Hazards / Forecast / Guide)
│   │   ├── explore/              # Map + spot list
│   │   ├── log/                  # Multi-step Log Dive
│   │   └── profile/              # Profile, Settings, Followers, Following, Report detail
│   ├── theme/                    # colors / typography / spacing / radius
│   └── types/
```

## Screens implemented (matched 1:1 to the Figma frames)

- Loading screen
- Sign Up Account, Almost There (3-step onboarding)
- Dashboard (Favorite Spots, Condition Alerts, Friends' Reports, Log Your Dive CTA)
- Saved Spots (grid)
- Spot Page (Overview / Conditions / Hazards / Forecast / Guide tabs, tide chart, compass dials, UV ramp, moon panel)
- Explore (map placeholder + sheet of spots)
- Log Your Dive (5 steps: type/group → activity → conditions → wrap-up → success)
- Dive Report detail (Three Tables-style read view)
- Profile (Dashboard / Dive Reports / Friends / Settings tabs)
- Followers / Following
- Profile & Settings (full settings list)
