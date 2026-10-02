import { useEffect, useState } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { auth } from './firebase'

/**
 * Current Firebase user. `ready` is false until Firebase has restored the saved session,
 * so the UI doesn't flash "signed out" for users who are already signed in.
 */
export function useAuth() {
  const [state, setState] = useState({ user: auth.currentUser, ready: false })
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, ready: true })), [])
  return state
}

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

/** Google sign-in in a popup; falls back to a full-page redirect when the browser blocks popups */
export async function signIn() {
  try {
    await signInWithPopup(auth, provider)
  } catch (err) {
    if (err.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider)
    // Closing the popup is the user's choice, not an error worth showing
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return undefined
    throw err
  }
  return undefined
}

export const signOutUser = () => signOut(auth)
