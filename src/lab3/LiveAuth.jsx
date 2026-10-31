// Lab 3.2 · ล็อกอินด้วย Google สำหรับแท็บสด
// SignInCard แสดงแทน Dashboard เมื่อยังไม่ล็อกอิน · UserMenu อยู่มุมขวาบน
import { useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";

const AUTH_ERROR_TEXT = {
  "auth/unauthorized-domain":
    "โดเมนนี้ยังไม่ได้รับอนุญาต — เพิ่มโดเมนใน Firebase Console › Authentication › Settings › Authorized domains",
  "auth/operation-not-allowed":
    "ยังไม่ได้เปิดการล็อกอินด้วย Google — เปิดใน Firebase Console › Authentication › Sign-in method",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน — อนุญาต pop-up สำหรับเว็บนี้แล้วลองใหม่",
  "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ — กดเข้าสู่ระบบอีกครั้ง",
  "auth/cancelled-popup-request": "มีหน้าต่างล็อกอินเปิดอยู่แล้ว",
  "auth/network-request-failed": "เชื่อมต่ออินเทอร์เน็ตไม่ได้ — ตรวจการเชื่อมต่อแล้วลองใหม่",
};
const thaiAuthError = (e) => AUTH_ERROR_TEXT[e?.code] ?? `เข้าสู่ระบบไม่สำเร็จ: ${e?.message ?? e}`;

export function SignInCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider); // สำเร็จแล้ว onAuthStateChanged จะสลับไปหน้า Dashboard เอง
    } catch (e) {
      setError(thaiAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl bg-white p-8 text-center ring-1 ring-stone-200">
      <h1 className="text-2xl font-bold">ยอดขายสด</h1>
      <p className="mt-2 text-sm text-stone-500">เข้าสู่ระบบด้วยบัญชี Google เพื่อดูยอดขายแบบ real-time และบันทึกยอดขาย</p>
      <button
        type="button"
        onClick={signIn}
        disabled={busy || !auth}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-stone-800 ring-1 ring-stone-300 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? "กำลังเปิดหน้าต่างล็อกอิน…" : "เข้าสู่ระบบด้วย Google"}
      </button>
      {!auth && <p className="mt-4 text-sm text-red-700">ยังไม่ได้ตั้งค่า Firebase — คัดลอก .env.example เป็น .env แล้วใส่ค่าโปรเจกต์</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">❌ {error}</p>}
    </div>
  );
}

export function UserMenu({ user }) {
  const [error, setError] = useState(null);
  const name = user.displayName || user.email || "ผู้ใช้";
  return (
    <div className="flex items-center gap-2">
      {user.photoURL ? (
        // Google avatar ต้องใช้ no-referrer ไม่งั้นบางครั้งโหลดรูปไม่ขึ้น
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full ring-1 ring-stone-200" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="max-w-[12rem] truncate text-sm font-medium text-stone-700" title={user.email ?? undefined}>{name}</span>
      <button
        type="button"
        onClick={() => signOut(auth).catch((e) => setError(`ออกจากระบบไม่สำเร็จ: ${e.message}`))}
        className="rounded-lg px-2.5 py-1.5 text-sm text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100"
      >
        ออกจากระบบ
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
