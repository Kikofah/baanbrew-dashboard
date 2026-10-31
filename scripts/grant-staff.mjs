// ให้/ถอนสิทธิ์พนักงาน (custom claim staff) ซึ่ง firestore.rules ใช้ตัดสินว่าใครอ่านข้อมูลร้านได้
//   npm run grant-staff -- you@example.com            ให้สิทธิ์
//   npm run grant-staff -- you@example.com --revoke   ถอนสิทธิ์
// ผู้ใช้ต้องเคยล็อกอินเข้าเว็บด้วย Google มาก่อน 1 ครั้ง (จึงมีบัญชีใน Firebase Auth)
// หลังให้สิทธิ์ ผู้ใช้ต้องออกจากระบบแล้วเข้าใหม่ 1 ครั้ง token ใหม่จึงมี staff = true
// ใช้ key เดียวกับ npm run seed (FIREBASE_SERVICE_ACCOUNT ใน .env → ไฟล์ใน secrets/)
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"));
if (!email || !email.includes("@")) {
  console.error("❌ ใส่อีเมล เช่น npm run grant-staff -- you@example.com");
  process.exit(1);
}

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("❌ ไม่พบ key ตั้ง FIREBASE_SERVICE_ACCOUNT ใน .env (ไฟล์ใน secrets/)");
  process.exit(1);
}
if (!path.relative(process.cwd(), path.resolve(keyPath)).startsWith("secrets" + path.sep)) {
  console.error("❌ key ต้องอยู่ในโฟลเดอร์ secrets/ เท่านั้น");
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (e) {
  if (e.code === "auth/user-not-found") {
    console.error(`❌ ยังไม่มีบัญชี ${email} ใน Firebase Auth ให้เจ้าของบัญชีล็อกอินเข้าเว็บด้วย Google 1 ครั้งก่อน`);
    process.exit(1);
  }
  throw e;
}

// คง claim อื่นที่มีอยู่ไว้ แก้เฉพาะ staff
const claims = { ...(user.customClaims ?? {}) };
if (revoke) delete claims.staff;
else claims.staff = true;
await auth.setCustomUserClaims(user.uid, claims);

console.log(revoke
  ? `✅ ถอนสิทธิ์พนักงานของ ${email} แล้ว (มีผลเมื่อ token หมดอายุ ภายใน 1 ชั่วโมง หรือเมื่อออกจากระบบ)`
  : `✅ ให้สิทธิ์พนักงานแก่ ${email} แล้ว · ให้ผู้ใช้ออกจากระบบแล้วเข้าใหม่ 1 ครั้ง`);
