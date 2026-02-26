import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  } else {
    // Inside Firebase Functions — use application default credentials
    admin.initializeApp()
  }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()
adminDb.settings({ ignoreUndefinedProperties: true })
