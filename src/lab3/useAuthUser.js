// ฟังสถานะการล็อกอินของ Firebase Auth (ใช้ในแท็บสด)
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase.js";

/** { status: "checking" | "signed-out" | "signed-in", user } */
export function useAuthUser() {
  const [state, setState] = useState(() => ({ status: auth ? "checking" : "signed-out", user: null }));
  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => setState({ status: user ? "signed-in" : "signed-out", user }));
  }, []);
  return state;
}
