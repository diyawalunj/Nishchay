import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import test, { after, before } from 'node:test';
import { omitUndefinedFirestoreValues, writeContentCollection } from '../firestore-content';
import { parseDailyNewsPost } from '../n-intel-parser';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const TEST_PROJECT_ID = 'demo-firestore-content-test';
let emulatorApp: admin.app.App | undefined;

before(() => {
  if (!EMULATOR_HOST) return;
  emulatorApp = admin.initializeApp({ projectId: TEST_PROJECT_ID }, TEST_PROJECT_ID);
});

after(async () => {
  await emulatorApp?.delete();
});

test('Firestore write values omit undefined object fields recursively', () => {
  const input = {
    id: 'story-1',
    sourceName: undefined,
    sourceUrl: undefined,
    metadata: {
      present: 'value',
      optional: undefined
    },
    tags: ['news', undefined]
  };

  assert.deepEqual(omitUndefinedFirestoreValues(input), {
    id: 'story-1',
    metadata: { present: 'value' },
    tags: ['news', null]
  });
});

test('A parsed story without a source can be safely prepared for Firestore', () => {
  const parsed = parseDailyNewsPost(
    'TODAYS TOP NEWS\n--------------------\n1. The government announced a new public infrastructure project with funding for regional transport and development.'
  );
  assert.equal(parsed.success, true);
  assert.equal(parsed.stories.length, 1);
  assert.equal(parsed.stories[0].sourceUrl, undefined);

  const safeRecord = omitUndefinedFirestoreValues(parsed.stories[0]) as Record<string, unknown>;
  assert.equal(Object.hasOwn(safeRecord, 'sourceUrl'), false);
  assert.equal(Object.hasOwn(safeRecord, 'sourceName'), false);
});

test('Firestore value cleanup preserves Date instances', () => {
  const date = new Date('2026-11-04T00:00:00.000Z');
  assert.deepEqual(omitUndefinedFirestoreValues({ createdAt: date }), { createdAt: date });
});

test('Firestore accepts an N-Intel story with missing optional source fields', {
  skip: !EMULATOR_HOST ? 'Run with the Firestore emulator to exercise a real Admin SDK write.' : false
}, async () => {
  const storyId = `nintel-undefined-fields-${Date.now()}`;
  await writeContentCollection('nintel_stories', [{
    id: storyId,
    headline: 'A story without a source URL',
    content: 'This parsed story has no external source URL.',
    sourceName: undefined,
    sourceUrl: undefined
  }]);

  const ref = admin.firestore(emulatorApp).collection('nintel_stories').doc(encodeURIComponent(storyId));
  const snapshot = await ref.get();
  assert.equal(snapshot.exists, true);
  assert.equal(snapshot.get('headline'), 'A story without a source URL');
  assert.equal(snapshot.get('sourceName'), undefined);
  await ref.delete();
});
