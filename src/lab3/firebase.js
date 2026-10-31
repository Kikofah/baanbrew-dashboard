// เชื่อมต่อ Firebase จากค่าใน .env (ดู .env.example)
// web config ไม่ใช่ความลับ ความปลอดภัยจริงมาจาก Security Rules (Lab 3.3)
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(config.apiKey && config.projectId && config.appId && config.authDomain);
export const projectId = config.projectId;
// ใช้ app เดียวกับ src/lib/firebase.js ถ้าสร้างไว้แล้ว (เรียก initializeApp ซ้ำด้วย config ต่างกันจะ error app/duplicate-app)
// ผลพลอยได้: ล็อกอินที่ปุ่มด้านบนของเว็บ = ล็อกอินในแท็บสดด้วย เพราะใช้ auth ตัวเดียวกัน
export const app = isConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;
