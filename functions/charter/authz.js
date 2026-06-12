/* eslint-env node */
'use strict';

/**
 * Charter callable authorization predicates.
 *
 * Mirrors the firestore.rules predicate for charter_logs writes
 * (hasOrgAccess + (isCharterMember || hasCaptainsLicense)): a caller
 * may finalize/render a log when they are the org admin
 * (users.orgId === operatorId, set by provisionCharterOperator) OR a
 * licensed crew member (operatorId ∈ users.activeOrgIds AND a
 * non-empty captainLicense — acceptCrewInvitation sets activeOrgIds,
 * never orgId). Keep in sync with firestore.rules
 * hasActiveCrewMembership / hasCaptainsLicense.
 */
function canFinalizeCharterLog(userData, operatorId) {
  if (!userData || !operatorId) return false;
  if (userData.orgId === operatorId) return true; // org admin
  return (
    Array.isArray(userData.activeOrgIds) &&
    userData.activeOrgIds.includes(operatorId) &&
    typeof userData.captainLicense === 'string' &&
    userData.captainLicense.length > 0
  );
}

module.exports = { canFinalizeCharterLog };
