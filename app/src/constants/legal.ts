// Public URLs for our legal documents. Apple's App Store reviewer
// requires a working privacy policy URL on the listing AND inside the
// app (typically Settings → Privacy Policy). Same goes for Play.
//
// The drafts live at docs/privacy-policy.md and
// docs/terms-of-service.md in the repo. Host them anywhere with a
// stable HTTPS URL — GitHub Pages, Firebase Hosting, Webflow, a
// static site — and point these constants at the published locations
// before submitting to either store.
//
// Until they're hosted, opening these in-app falls through to the
// repo's GitHub URLs so QA / reviewers can still see content.

export const LEGAL_URLS = {
  privacy: 'https://kaicast.app/privacy',
  terms:   'https://kaicast.app/terms',
} as const;
