import { useEffect, useState } from 'react'
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase'

export const SALES = collection(db, 'sales')

/**
 * Live sales rows for one date range ('YYYY-MM-DD', inclusive) from Firestore.
 * The range is part of the query, so only that range is read (and billed) —
 * the free tier allows 50k reads/day, less than one full read of all sales.
 * Returns { rows, loading, error }. rows is null until the first snapshot arrives.
 */
export function useSales(from, to) {
  const key = from && to ? `${from}|${to}` : null
  // `forKey` = which range the current result belongs to; loading = still waiting for this range.
  // Old rows stay visible while a new range loads, so the page doesn't flash empty.
  const [result, setResult] = useState({ forKey: null, rows: null, error: null })

  useEffect(() => {
    if (!key) return undefined
    const q = query(SALES, where('date', '>=', from), where('date', '<=', to))
    const unsubscribe = onSnapshot(
      q,
      (snap) => setResult({ forKey: key, rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
      (err) => setResult({ forKey: key, rows: null, error: err.message }),
    )
    return unsubscribe // stop listening when the range changes or the page unmounts
  }, [key, from, to])

  return { rows: result.rows, error: result.error, loading: result.forKey !== key }
}

/** Latest 'YYYY-MM-DD' in the collection (1 read), or null when it is empty */
export async function latestSaleDate() {
  const snap = await getDocs(query(SALES, orderBy('date', 'desc'), limit(1)))
  return snap.empty ? null : snap.docs[0].data().date
}
