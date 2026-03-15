import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import { useAuth } from './AuthContext'

interface SavedContextType {
  savedIds: Set<string>
  toggleSave: (listingId: string) => void
  isSaved: (id: string) => boolean
}

const SavedContext = createContext<SavedContextType>({
  savedIds: new Set(),
  toggleSave: () => {},
  isSaved: () => false,
})

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  // Load saved listings from Supabase when user signs in
  useEffect(() => {
    if (!user) return
    supabase
      .from('saved_listings')
      .select('listing_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedIds(new Set(data.map((r) => r.listing_id as string)))
      })
  }, [user])

  // Clear when user signs out
  useEffect(() => {
    if (!user) setSavedIds(new Set())
  }, [user])

  const toggleSave = (listingId: string) => {
    const isSaving = !savedIds.has(listingId)
    track(isSaving ? 'listing_saved' : 'listing_unsaved', { listing_id: listingId })
    setSavedIds((prev) => {
      const next = new Set(prev)
      isSaving ? next.add(listingId) : next.delete(listingId)
      return next
    })

    if (user) {
      if (isSaving) {
        supabase.from('saved_listings').insert({ user_id: user.id, listing_id: listingId })
      } else {
        supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', listingId)
      }
    }
  }

  const isSaved = (id: string) => savedIds.has(id)

  return (
    <SavedContext.Provider value={{ savedIds, toggleSave, isSaved }}>
      {children}
    </SavedContext.Provider>
  )
}

export function useSaved() {
  return useContext(SavedContext)
}
