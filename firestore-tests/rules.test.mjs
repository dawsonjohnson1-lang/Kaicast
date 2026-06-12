// Firestore security-rules tests for the Charter captain's-log license
// gate (and the server-only captainLicense field).
//
// Run via the Firestore emulator:
//   cd firestore-tests && npm install && npm test
// (npm test wraps `firebase emulators:exec --only firestore "node --test"`)
//
// Covers the rules added in firestore.rules:
//   - hasCaptainsLicense()
//   - charter_accounts/{orgId}/trips/{tripId}.captainsLog writes
//   - charter_logs/{logId} create/read/update/delete
//   - users/{uid}.captainLicense is server-only
//
// Actors (seeded with rules disabled):
//   owner        — org admin: accountType 'charter', orgId 'org1' (the owner)
//   capLicensed  — crew of org1 (activeOrgIds:['org1']) WITH a captainLicense
//   capNoLicense — crew of org1 WITHOUT a captainLicense
//   outsider     — no org membership, no license

import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';

const here = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(here, '..', 'firestore.rules');

// emulators:exec sets FIRESTORE_EMULATOR_HOST; default for a bare run.
const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');

let testEnv;

const ORG = 'org1';
const LOG = { incidentFlag: 'none', surfaceConditions: {}, freeText: '' };

before(async () => {
  setLogLevel('error'); // silence noisy permission-denied logs from the SDK
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-kaicast',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host, port: Number(portStr) },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Fresh data per test so a successful write in one case can't leak into
// the next.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'owner'), { accountType: 'charter', orgId: ORG, displayName: 'Olive Owner' });
    await setDoc(doc(db, 'users', 'capLicensed'), { activeOrgIds: [ORG], captainLicense: 'USCG-123456' });
    await setDoc(doc(db, 'users', 'capNoLicense'), { activeOrgIds: [ORG] });
    await setDoc(doc(db, 'users', 'outsider'), { displayName: 'Otto Outsider' });

    await setDoc(doc(db, 'charter_accounts', ORG), { name: 'Blue Ocean Hawaii' });
    await setDoc(doc(db, 'charter_accounts', ORG, 'trips', 'trip1'), {
      captainUid: 'capLicensed', floatPlanFiled: false, status: 'planned', captainsLog: null, headcount: 4,
    });
    await setDoc(doc(db, 'charter_accounts', ORG, 'trips', 'trip2'), {
      captainUid: 'capNoLicense', floatPlanFiled: false, status: 'planned', captainsLog: null, headcount: 4,
    });
    await setDoc(doc(db, 'charter_logs', 'log1'), { operatorId: ORG, status: 'submitted', incident: 'none' });
  });
});

const db = (uid) => testEnv.authenticatedContext(uid).firestore();
const tripRef = (d, id) => doc(d, 'charter_accounts', ORG, 'trips', id);
const logRef = (d, id) => doc(d, 'charter_logs', id);

// ── trips.captainsLog: license gate ──────────────────────────────────

test('owner (org admin) can write captainsLog on any trip', async () => {
  await assertSucceeds(updateDoc(tripRef(db('owner'), 'trip1'), { captainsLog: LOG, status: 'completed' }));
});

test('licensed captain can file the captains log on their own trip', async () => {
  await assertSucceeds(updateDoc(tripRef(db('capLicensed'), 'trip1'), { captainsLog: LOG, status: 'completed' }));
});

test('unlicensed captain CANNOT file the captains log', async () => {
  await assertFails(updateDoc(tripRef(db('capNoLicense'), 'trip2'), { captainsLog: LOG, status: 'completed' }));
});

test('unlicensed captain CAN still file the float plan (no captainsLog)', async () => {
  await assertSucceeds(updateDoc(tripRef(db('capNoLicense'), 'trip2'), { floatPlanFiled: true }));
});

test('licensed captain cannot write captainsLog alongside a non-allowlisted field', async () => {
  await assertFails(updateDoc(tripRef(db('capLicensed'), 'trip1'), { captainsLog: LOG, headcount: 9 }));
});

test('captain cannot file a log on a trip they are not the captain of', async () => {
  await assertFails(updateDoc(tripRef(db('capLicensed'), 'trip2'), { captainsLog: LOG, status: 'completed' }));
});

test('outsider cannot update a trip at all', async () => {
  await assertFails(updateDoc(tripRef(db('outsider'), 'trip1'), { captainsLog: LOG }));
});

// ── charter_logs: create / read / update / delete ────────────────────

test('owner can create a charter_log for their org', async () => {
  await assertSucceeds(setDoc(logRef(db('owner'), 'new_owner'), { operatorId: ORG, status: 'draft' }));
});

test('licensed captain can create a charter_log', async () => {
  await assertSucceeds(setDoc(logRef(db('capLicensed'), 'new_lic'), { operatorId: ORG, status: 'draft' }));
});

test('unlicensed captain CANNOT create a charter_log', async () => {
  await assertFails(setDoc(logRef(db('capNoLicense'), 'new_nolic'), { operatorId: ORG, status: 'draft' }));
});

test('outsider cannot create a charter_log for the org', async () => {
  await assertFails(setDoc(logRef(db('outsider'), 'new_out'), { operatorId: ORG, status: 'draft' }));
});

test('any org member can read charter_logs (read needs no license)', async () => {
  await assertSucceeds(getDoc(logRef(db('owner'), 'log1')));
  await assertSucceeds(getDoc(logRef(db('capNoLicense'), 'log1')));
});

test('outsider cannot read charter_logs', async () => {
  await assertFails(getDoc(logRef(db('outsider'), 'log1')));
});

test('licensed captain can update a charter_log; unlicensed cannot', async () => {
  await assertSucceeds(updateDoc(logRef(db('capLicensed'), 'log1'), { status: 'archived' }));
  await assertFails(updateDoc(logRef(db('capNoLicense'), 'log1'), { status: 'archived' }));
});

test('charter_logs cannot be deleted by anyone (audit record)', async () => {
  await assertFails(deleteDoc(logRef(db('owner'), 'log1')));
});

// ── users.captainLicense is server-only ──────────────────────────────

test('a user cannot self-write captainLicense (must go via callable)', async () => {
  await assertFails(updateDoc(doc(db('capNoLicense'), 'users', 'capNoLicense'), { captainLicense: 'SELF-GRANT' }));
  await assertFails(updateDoc(doc(db('owner'), 'users', 'owner'), { captainLicense: 'SELF-GRANT' }));
});

test('a user can still edit a non-protected profile field (sanity)', async () => {
  await assertSucceeds(updateDoc(doc(db('owner'), 'users', 'owner'), { displayName: 'Olive O.' }));
});
