import { useEffect, useState } from "react";

/** สถานะล็อกอิน + โหลดผลวิเคราะห์ครั้งเดียว (ไม่ใช้ onSnapshot เพราะข้อมูลเปลี่ยนวันละครั้ง) */
export function useAnalytics(source) {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => source.onAuth(setUser), [source]);
  useEffect(() => {
    if (!user) return;
    setError(null);
    source.loadAnalytics().then(setData).catch((e) => setError(
      e.code === "permission-denied"
        ? "อ่านผลวิเคราะห์ไม่ได้: บัญชีนี้ยังไม่ได้รับสิทธิ์พนักงาน ให้ผู้ดูแลรัน npm run grant-staff -- อีเมลของคุณ แล้วออกจากระบบ-เข้าใหม่ 1 ครั้ง (หรือ rules ของ collection analytics ยังไม่ได้ deploy)"
        : e.message
    ));
  }, [source, user]);
  return { user, data, error };
}
