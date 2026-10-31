// ข้อความ error ของ Firebase Auth เป็นภาษาไทย ใช้ร่วมกันระหว่างแท็บสด (LiveAuth) และแท็บ Day 4 (AuthBar)
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
export const authErrorText = (e) => AUTH_ERROR_TEXT[e?.code] ?? `เข้าสู่ระบบไม่สำเร็จ: ${e?.message ?? e}`;
