# App assets

Bundled image assets referenced by `require()` from the source.

## Wired

- `logo-k-wave.png` — KAICAST brand mark (`components/Logo.tsx`)
- `alert-green-curl.png` — info-severity alert (`components/AlertRow.tsx`)
- `alert-blue-swirl.png` — warn-severity alert
- `alert-orange-globe.png` — hazard-severity alert
- `spot-electric-beach.png` — Electric Beach cover (placeholder satellite)
- `spot-sharks-cove.png` — Shark's Cove cover (placeholder satellite)
- `spot-molokini.png` — Molokini cover (placeholder satellite)
- `dawson.png` — Default header avatar

## Backend handoff

`Spot.imageUrl` and `User.photoUrl` accept any remote URL string and take
precedence over local `imageSource` when both are set. Wire backend
satellite tile / profile photo URLs into those fields once available.
