/**
 * @fileoverview Firebase Admin SDK initialisation.
 *
 * Initialises the Admin SDK once and exports the `admin` instance.
 * The service-account key path is optional: if `FIREBASE_SERVICE_ACCOUNT_PATH`
 * is set the file is loaded; otherwise the SDK falls back to Application
 * Default Credentials (ADC), which works on GCP / Cloud Run without any
 * extra configuration.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Initialise Firebase Admin SDK.
 *
 * Safe to call multiple times — returns the already-initialised app on
 * subsequent calls.
 *
 * @returns {import('firebase-admin').app.App} The default Firebase app.
 */
function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  let credential;
  if (serviceAccountPath) {
    const absolutePath = path.resolve(serviceAccountPath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `[Firebase] Service account file not found: ${absolutePath}`,
      );
    }
    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Fall back to Application Default Credentials (ADC)
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  console.log(
    '[Firebase] Admin SDK initialised for project:',
    process.env.FIREBASE_PROJECT_ID,
  );
  return admin.app();
}

module.exports = { initializeFirebase, admin };
