import { useState } from 'react'
import { signIn, signOutUser } from '../lib/useAuth'

/** Sign-in / sign-out button for the top bar. `auth` = result of useAuth() */
export default function AuthButton({ auth }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = (action) => async () => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.code === 'auth/unauthorized-domain'
        ? 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Authentication'
        : `ไม่สำเร็จ: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  if (!auth.ready) return null

  return (
    <div className="flex min-w-0 items-center gap-2">
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
      {auth.user ? (
        <>
          {auth.user.photoURL && (
            <img src={auth.user.photoURL} alt="" className="h-8 w-8 shrink-0 rounded-full ring-2 ring-white" referrerPolicy="no-referrer" />
          )}
          <span className="hidden max-w-40 truncate text-sm font-medium text-stone-700 md:inline" title={auth.user.email ?? ''}>
            {auth.user.displayName ?? auth.user.email}
          </span>
          <button type="button" onClick={run(signOutUser)} disabled={busy}
                  className="btn-ghost">
            ออกจากระบบ
          </button>
        </>
      ) : (
        <button type="button" onClick={run(signIn)} disabled={busy}
                className="btn-primary py-1.5">
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>
      )}
    </div>
  )
}
