import { createContext, useContext, useEffect, useState } from 'react'

// The team whose "path to the Final" is highlighted across the Bracket and
// Radial views. Lifted to a context (and persisted) so the selection survives
// switching between those two tabs. null = no path highlighted.
const KEY = 'wc2026:pathTeam'
const PathCtx = createContext(null)

export function PathProvider({ children }) {
  const [pathTeam, setPathTeam] = useState(() => {
    try {
      return localStorage.getItem(KEY) || null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (pathTeam) localStorage.setItem(KEY, pathTeam)
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [pathTeam])

  return <PathCtx.Provider value={{ pathTeam, setPathTeam }}>{children}</PathCtx.Provider>
}

// Inert fallback so components/tests can render without a provider mounted.
const FALLBACK = { pathTeam: null, setPathTeam: () => {} }
export function usePath() {
  return useContext(PathCtx) || FALLBACK
}
