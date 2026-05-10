// Public URLs for our legal documents. Apple's App Store reviewer
// requires a working privacy policy URL on the listing AND inside the
// app (typically Settings → Privacy Policy). Same goes for Play.
//
// Source-of-truth markdown lives at docs/privacy-policy.md and
// docs/terms-of-service.md. scripts/build-legal.js renders them to
// styled HTML in functions/public/. Deploy via:
//   node scripts/build-legal.js && firebase deploy --only hosting
//
// When you wire a custom domain (e.g. kaicast.app), update the URLs
// below — the existing routes /privacy and /terms continue to work
// on the new domain since the rewrites are domain-agnostic.

export const LEGAL_URLS = {
  privacy: 'https://kaicast-207dc.web.app/privacy',
  terms:   'https://kaicast-207dc.web.app/terms',
} as const;
