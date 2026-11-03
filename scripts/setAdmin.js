#!/usr/bin/env node

/**
 * scripts/setAdmin.js
 * 
 * One-time administrative CLI script to grant custom claims (admin: true) to a Firebase user.
 * 
 * Usage:
 *   node scripts/setAdmin.js <UID>
 *   node scripts/setAdmin.js <UID> [path/to/serviceAccountKey.json]
 *   node scripts/setAdmin.js --email <email>
 * 
 * Credentials loading priority:
 *   1. Explicit file path passed as second argument
 *   2. GOOGLE_APPLICATION_CREDENTIALS environment variable
 *   3. FIREBASE_SERVICE_ACCOUNT_KEY environment variable (file path or inline JSON)
 *   4. Local file: ./serviceAccountKey.json or ./scripts/serviceAccountKey.json
 *   5. Project ID with Application Default Credentials
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function loadServiceAccount(customPath) {
  const candidatePaths = [
    customPath,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    process.env.SERVICE_ACCOUNT_KEY_PATH,
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(process.cwd(), 'scripts', 'serviceAccountKey.json'),
    path.join(process.cwd(), 'firebase-service-account.json'),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    // Check if the candidate is directly a JSON string
    if (typeof candidate === 'string' && candidate.trim().startsWith('{')) {
      try {
        return JSON.parse(candidate);
      } catch (err) {
        console.warn('Failed to parse inline service account JSON:', err.message);
      }
    }

    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) {
      try {
        const content = fs.readFileSync(resolved, 'utf8');
        return JSON.parse(content);
      } catch (err) {
        console.warn(`Could not read service account file at ${resolved}:`, err.message);
      }
    }
  }

  // Fallback to individual env vars if available
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'nishchay-defence';

  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim();
    return {
      projectId,
      clientEmail,
      privateKey
    };
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
==============================================================
 Nishchay - Firebase Custom Claims Admin Provisioning Script
==============================================================

Usage:
  node scripts/setAdmin.js <UID>
  node scripts/setAdmin.js <UID> <path/to/serviceAccountKey.json>
  node scripts/setAdmin.js --email <admin-email@example.com>

Environment Variables:
  GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON
  FIREBASE_SERVICE_ACCOUNT_KEY    Path or inline JSON string
  VITE_FIREBASE_PROJECT_ID        Firebase Project ID (default: nishchay-defence)

Example:
  node scripts/setAdmin.js 4aBcdEfGhIjKlMnOpQrStUvWxYz1
    `);
    process.exit(1);
  }

  let targetUid = null;
  let targetEmail = null;
  let keyPathArg = null;

  if (args[0] === '--email' && args[1]) {
    targetEmail = args[1].trim().toLowerCase();
    keyPathArg = args[2];
  } else {
    targetUid = args[0].trim();
    keyPathArg = args[1];
  }

  // Initialize Firebase Admin
  const serviceAccount = loadServiceAccount(keyPathArg);
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || serviceAccount?.project_id || serviceAccount?.projectId || 'nishchay-defence';

  try {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId
      });
      console.log(`✅ Firebase Admin initialized with service account for project: ${projectId}`);
    } else {
      admin.initializeApp({
        projectId
      });
      console.log(`⚠️ Firebase Admin initialized with default credentials for project: ${projectId}`);
    }
  } catch (initErr) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', initErr.message);
    process.exit(1);
  }

  // If email was provided, resolve to UID
  try {
    if (!targetUid && targetEmail) {
      console.log(`🔍 Looking up user record for email: ${targetEmail}...`);
      const userRecord = await admin.auth().getUserByEmail(targetEmail);
      targetUid = userRecord.uid;
      console.log(`✅ Found user UID: ${targetUid}`);
    }

    // Verify user exists
    const user = await admin.auth().getUser(targetUid);
    console.log(`👤 Target User:`);
    console.log(`   - UID:          ${user.uid}`);
    console.log(`   - Email:        ${user.email || '(No email)'}`);
    console.log(`   - Display Name: ${user.displayName || '(No name)'}`);
    console.log(`   - Existing Claims:`, user.customClaims || {});

    // Set custom claim
    console.log(`\n⏳ Setting custom user claims { admin: true }...`);
    await admin.auth().setCustomUserClaims(targetUid, { admin: true });

    // Re-fetch user to confirm
    const updatedUser = await admin.auth().getUser(targetUid);
    console.log(`\n🎉 SUCCESS! Custom user claims updated:`);
    console.log(`   - Claims:`, updatedUser.customClaims);

    console.log(`
----------------------------------------------------------------------
IMPORTANT NOTE FOR THE USER:
Firebase ID tokens are cached on client devices for up to 1 hour.
For the new custom claims to take effect, the user MUST either:
  1. Sign out of the website and sign back in, OR
  2. Call auth.currentUser.getIdToken(true) to force token refresh.
----------------------------------------------------------------------
    `);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error provisioning admin claim:`, error.message);
    if (error.code === 'auth/user-not-found') {
      console.error(`User with UID/Email "${targetUid || targetEmail}" was not found in project "${projectId}".`);
    }
    process.exit(1);
  }
}

main();
