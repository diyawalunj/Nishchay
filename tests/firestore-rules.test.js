import { readFileSync } from 'fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'test-nishchay-project';

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // 1. Normal user cannot set role: 'admin' on their own doc at create or update
  it("A normal user cannot set role: 'admin' on their own doc at create or update", async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
    const aliceDb = alice.firestore();

    // Create with role: 'admin' should FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice User',
        role: 'admin',
      })
    );

    // Create with valid role: 'user' should SUCCEED
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice User',
        role: 'user',
      })
    );

    // Update attempting to escalate role to 'admin' should FAIL
    await assertFails(
      updateDoc(doc(aliceDb, 'users/alice'), {
        role: 'admin',
      })
    );
  });

  // 2. Normal user cannot write to subject_notes or pyq_sessions
  it('A normal user cannot write to subject_notes or pyq_sessions', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
    const aliceDb = alice.firestore();

    // Writing to subject_notes should FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'subject_notes/note_1'), {
        title: 'Unauthorized Note',
        content: 'Should be rejected',
      })
    );

    // Writing to pyq_sessions should FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'pyq_sessions/session_1'), {
        title: 'Unauthorized PYQ',
      })
    );
  });

  // 3. User cannot create a doc whose uid differs from their auth uid
  it('A user cannot create a doc whose uid differs from their auth uid', async () => {
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
    const aliceDb = alice.firestore();

    // Trying to create a user doc with uid 'charlie' instead of 'alice' should FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'charlie',
        email: 'alice@example.com',
        displayName: 'Alice Impersonating Charlie',
        role: 'user',
      })
    );

    // Trying to create a doc in another user's path should FAIL
    await assertFails(
      setDoc(doc(aliceDb, 'users/charlie'), {
        uid: 'charlie',
        email: 'alice@example.com',
        displayName: 'Alice Impersonating Charlie',
        role: 'user',
      })
    );
  });

  // 4. A user cannot read another user's doc
  it("A user cannot read another user's doc", async () => {
    // Seed charlie's doc bypass-rules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/charlie'), {
        uid: 'charlie',
        email: 'charlie@example.com',
        displayName: 'Charlie User',
        role: 'user',
      });
    });

    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
    const aliceDb = alice.firestore();

    // Reading another user's doc should FAIL
    await assertFails(getDoc(doc(aliceDb, 'users/charlie')));

    // Setting and reading own doc should SUCCEED
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users/alice'), {
        uid: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice User',
        role: 'user',
      })
    );
    await assertSucceeds(getDoc(doc(aliceDb, 'users/alice')));
  });

  // 5. An admin (with the admin claim) can write to subject_notes and update any user
  it('An admin (with the admin claim) can write to subject_notes and update any user', async () => {
    // Seed charlie's doc bypass-rules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/charlie'), {
        uid: 'charlie',
        email: 'charlie@example.com',
        displayName: 'Charlie User',
        role: 'user',
      });
    });

    const admin = testEnv.authenticatedContext('admin_bob', {
      email: 'admin@example.com',
      admin: true, // Custom claim token
    });
    const adminDb = admin.firestore();

    // Admin writing to subject_notes should SUCCEED
    await assertSucceeds(
      setDoc(doc(adminDb, 'subject_notes/official_note'), {
        title: 'Official UPSC Mains Notes',
        createdAt: new Date().toISOString(),
      })
    );

    // Admin updating another user doc should SUCCEED
    await assertSucceeds(
      updateDoc(doc(adminDb, 'users/charlie'), {
        displayName: 'Charlie User (Admin Verified)',
        role: 'admin',
      })
    );
  });

  // 6. An unauthenticated user can read subject_notes but cannot write
  it('An unauthenticated user can read subject_notes but cannot write', async () => {
    // Seed note bypass-rules
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'subject_notes/public_note'), {
        title: 'Public Syllabus Note',
      });
    });

    const unauthed = testEnv.unauthenticatedContext();
    const unauthedDb = unauthed.firestore();

    // Unauthenticated read of subject_notes should SUCCEED
    await assertSucceeds(getDoc(doc(unauthedDb, 'subject_notes/public_note')));

    // Unauthenticated write to subject_notes should FAIL
    await assertFails(
      setDoc(doc(unauthedDb, 'subject_notes/intruder_note'), {
        title: 'Hacked Note',
      })
    );
  });

  // 7. Old documents without a role field do not error on legitimate update
  it('An existing user doc without a role field can be updated by owner without errors', async () => {
    // Seed doc without 'role' field
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/legacy_user'), {
        uid: 'legacy_user',
        email: 'legacy@example.com',
        displayName: 'Legacy User',
      });
    });

    const legacyUser = testEnv.authenticatedContext('legacy_user', {
      email: 'legacy@example.com',
    });
    const legacyDb = legacyUser.firestore();

    // Updating allowed field (displayName) on doc without role field should SUCCEED
    await assertSucceeds(
      updateDoc(doc(legacyDb, 'users/legacy_user'), {
        displayName: 'Updated Legacy User Name',
      })
    );
  });
});
