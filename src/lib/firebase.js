// Firebase setup. Config comes from .env (VITE_FIREBASE_*), see .env.example.
// These values are public by design (they ship in the browser bundle);
// access is controlled by Firestore Security Rules, not by hiding them.
import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirestore } from 'firebase/firestore'

const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
}

const missing = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value && key !== 'measurementId')
  .map(([key]) => key)
if (missing.length) {
  throw new Error(`ไม่พบค่า Firebase ใน .env: ${missing.join(', ')} (ดูตัวอย่างใน .env.example)`)
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// Analytics throws in browsers that block it (cookies off, some private modes),
// so only start it where supported. Resolves to null otherwise.
export const analytics = isSupported()
  .then((ok) => (ok && firebaseConfig.measurementId ? getAnalytics(app) : null))
  .catch(() => null)
