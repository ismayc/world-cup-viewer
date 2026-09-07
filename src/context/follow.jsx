import { createContext, useContext, useEffect, useState } from 'react'
import { LEAGUE } from '../config/league.js'

// Followed teams, persisted to localStorage. Used to highlight teams, filter to
// "My Teams", and prioritize the next-match countdown.
const KEY = `${LEAGUE.storageKey}:followed`
const FollowCtx = createContext(null)

export function FollowProvider({ children }) {
  const [followed, setFollowed] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...followed]))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [followed])

  const toggle = (name) =>
    setFollowed((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  const value = {
    followed,
    isFollowed: (name) => followed.has(name),
    toggle,
    count: followed.size,
    clear: () => setFollowed(new Set()),
  }
  return <FollowCtx.Provider value={value}>{children}</FollowCtx.Provider>
}

// Safe even if no provider is mounted (returns an inert fallback), so components
// and tests can render in isolation.
const FALLBACK = { followed: new Set(), isFollowed: () => false, toggle: () => {}, count: 0, clear: () => {} }
export function useFollow() {
  return useContext(FollowCtx) || FALLBACK
}
