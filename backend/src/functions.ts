/**
 * Firebase Cloud Functions entry point.
 * Wraps the Express app as a callable HTTPS function named "api".
 */
import { onRequest } from 'firebase-functions/v2/https'
import app from './app'

export const api = onRequest(app)
