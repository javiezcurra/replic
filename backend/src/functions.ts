/**
 * Firebase Cloud Functions entry point.
 * Wraps the Express app as a callable HTTPS function named "api".
 */
import * as functions from 'firebase-functions'
import app from './app'

export const api = functions.https.onRequest(app)
