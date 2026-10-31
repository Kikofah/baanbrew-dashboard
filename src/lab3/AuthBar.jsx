// การ์ดเข้าสู่ระบบและป้ายผู้ใช้ สำหรับแท็บ Day 4 (src/lab4/ui.jsx เรียกใช้)
// ชื่อผู้ใช้และปุ่มออกจากระบบอยู่ที่แถบด้านบนของเว็บแล้ว (AuthButton) UserChip จึงแสดงแค่ป้ายโหมดสาธิต ไม่แสดงซ้ำ

/** แสดงแทนเนื้อหาเมื่อยังไม่ล็อกอิน · onSignIn = source.signIn() */
export function LoginCard({ onSignIn, error }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl bg-white p-8 text-center ring-1 ring-stone-200">
      <h1 className="text-2xl font-bold">เข้าสู่ระบบเพื่อดูผลวิเคราะห์</h1>
      <p className="mt-2 text-sm text-stone-500">ผลวิเคราะห์ใน collection analytics เปิดให้เฉพาะผู้ที่เข้าสู่ระบบแล้ว</p>
      <button type="button" className="btn-primary mt-6" onClick={onSignIn}>เข้าสู่ระบบด้วย Google</button>
      <p className="mt-4 text-xs text-stone-400">หรือเปิดโหมดสาธิตโดยเติม ?demo ท้าย URL (คำนวณในเบราว์เซอร์ ไม่ต้องล็อกอิน)</p>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">❌ {error}</p>}
    </div>
  );
}

/** ป้ายมุมขวาบนของหัวแท็บ: แสดงเฉพาะโหมดสาธิต (ผู้ใช้จริงดูได้ที่แถบด้านบน) */
export function UserChip({ user }) {
  if (!user?.demo) return null;
  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">โหมดสาธิต · ไม่ได้เชื่อม Firebase</span>
  );
}
