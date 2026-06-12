/* eslint-env node */
'use strict';

/**
 * Unit tests for charter/authz.js — the rules-mirroring predicate
 * used by generateCaptainsLog. Pure function, no admin mocking needed.
 *
 * Run: node functions/__test__/charterAuthz.unit.js
 */

const assert = require('assert');
const { canFinalizeCharterLog } = require('../charter/authz');

const ORG = 'org_kona_dive_co';

// Org admin (provisionCharterOperator sets users.orgId).
assert.strictEqual(
  canFinalizeCharterLog({ orgId: ORG }, ORG),
  true,
  'org admin should be allowed',
);

// Licensed crew (acceptCrewInvitation sets activeOrgIds, never orgId).
assert.strictEqual(
  canFinalizeCharterLog(
    { activeOrgIds: [ORG], captainLicense: 'USCG-123456' },
    ORG,
  ),
  true,
  'licensed crew should be allowed',
);

// Unlicensed crew — denied (license gates the captain's log).
assert.strictEqual(
  canFinalizeCharterLog({ activeOrgIds: [ORG] }, ORG),
  false,
  'unlicensed crew should be denied',
);
assert.strictEqual(
  canFinalizeCharterLog({ activeOrgIds: [ORG], captainLicense: '' }, ORG),
  false,
  'crew with empty license should be denied',
);

// Non-member — denied even with a license.
assert.strictEqual(
  canFinalizeCharterLog(
    { orgId: 'other_org', activeOrgIds: ['other_org'], captainLicense: 'USCG-123456' },
    ORG,
  ),
  false,
  'licensed non-member should be denied',
);

// Degenerate inputs.
assert.strictEqual(canFinalizeCharterLog(undefined, ORG), false, 'missing user doc denied');
assert.strictEqual(canFinalizeCharterLog({ orgId: ORG }, undefined), false, 'missing operatorId denied');
assert.strictEqual(
  canFinalizeCharterLog({ activeOrgIds: ORG, captainLicense: 'USCG-123456' }, ORG),
  false,
  'non-array activeOrgIds denied',
);

console.log('charterAuthz.unit.js — all assertions passed');
