// Charter permission predicates shared by the charter screens.
//
// Filling out / submitting a captain's log is gated on a LICENSE, not a
// role: the org owner (charter admin) can always file; everyone else
// (captain, manager, crew, deckhand) can file only if they have a
// captain's license number recorded on their account. Mirrors the
// mobile predicate (app/src/types/charter.ts) and the server-side
// enforcement in firestore.rules (hasCaptainsLicense).

/** True when the user has a non-empty captain's license on file. */
export function hasCaptainsLicense(license: string | null | undefined): boolean {
  return typeof license === 'string' && license.trim().length > 0;
}

/**
 * canFillCaptainLog = owner OR has a captain's license.
 * On desktop the org "owner" is the charter admin (accountType ===
 * 'charter'); pass that as `isOwner`.
 */
export function canFillCaptainLog(isOwner: boolean, license: string | null | undefined): boolean {
  return isOwner || hasCaptainsLicense(license);
}
