# App assets

Bundled image assets referenced by `require()` from the source.

## Currently wired (already shipping)

- `logo-k-wave.png` — KAICAST K-wave brand mark (Logo component)
- `alert-green-curl.png` — info-severity alert icon
- `alert-blue-swirl.png` — warn-severity alert icon
- `alert-orange-globe.png` — hazard-severity alert icon

## Placeholders to drop in (not yet wired to bundler)

When these files are added, uncomment the matching `imageSource: require(...)`
lines in `src/api/mockData.ts` and `src/hooks/useAuth.tsx` (or set the
remote URL via `imageUrl` / `photoUrl` instead).

- `spot-electric-beach.jpg` — Electric Beach satellite cover
- `spot-sharks-cove.jpg` — Shark's Cove satellite cover
- `spot-molokini.jpg` — Molokini satellite cover
- `dawson.jpg` — Header avatar photo

## Future: backend-driven

`Spot.imageUrl` and `User.photoUrl` accept any remote URL string and take
precedence over local `imageSource` when both are set. Wire backend
satellite tile / profile photo URLs into those fields.
