import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react"
import { useAuth } from "./auth-provider"
import { supabase } from "./supabase"

export interface ProfileData {
  username: string
  bio: string
  avatar: string | null
  email?: string
}

interface ProfileStore {
  profile: ProfileData
  isLoading: boolean
  error: string | null
  updateProfile: (data: Partial<ProfileData>) => Promise<void>
}

const STORAGE_KEY_PREFIX = "aces-profile"

function getUserStorageKey(userId: string | undefined) {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX
}

const DEFAULT_PROFILE: ProfileData = {
  username: "Aces User",
  bio: "Software Engineer at Aces",
  avatar: null,
}

function loadLocalProfile(userId: string | undefined): ProfileData {
  try {
    const stored = localStorage.getItem(getUserStorageKey(userId))
    return stored ? JSON.parse(stored) : DEFAULT_PROFILE
  } catch {
    return DEFAULT_PROFILE
  }
}

function saveLocalProfile(userId: string | undefined, profile: ProfileData) {
  localStorage.setItem(getUserStorageKey(userId), JSON.stringify(profile))
}

const ProfileContext = createContext<ProfileStore | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  // Fetch from API
  useEffect(() => {
    if (!user) {
      setProfile(DEFAULT_PROFILE)
      setIsLoading(false)
      return
    }

    const fetchProfile = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const token = await getAuthToken()
        if (!token) return

        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!res.ok) throw new Error("Failed to fetch profile")

        const data = await res.json()
        
        // Map backend to frontend schema
        const mappedProfile: ProfileData = {
          username: data.username || user.email?.split('@')[0] || "Aces User",
          bio: data.bio || "",
          avatar: data.avatar_url || null,
          email: data.email || user.email
        }

        setProfile(mappedProfile)
        saveLocalProfile(user.id, mappedProfile)
      } catch (err) {
        console.error("API Fetch Error, falling back to user-scoped localStorage:", err)
        setError("Offline mode: Using local data")
        setProfile(loadLocalProfile(user.id))
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [user])

  // Sync to user-scoped localStorage on state change
  useEffect(() => {
    if (user) {
      saveLocalProfile(user.id, profile)
    }
  }, [profile, user])

  const updateProfile = useCallback(async (data: Partial<ProfileData>) => {
    // Optimistic Update
    setProfile(prev => ({ ...prev, ...data }))

    try {
      const token = await getAuthToken()
      // Map frontend data to backend schema
      const payload: any = {}
      if (data.username !== undefined) payload.username = data.username
      if (data.bio !== undefined) payload.bio = data.bio
      if (data.avatar !== undefined) payload.avatar_url = data.avatar

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error("Failed to update profile on server")
      
      const updatedData = await res.json()
      
      const updatedProfile: ProfileData = {
        username: updatedData.username || data.username,
        bio: updatedData.bio || data.bio || "",
        avatar: updatedData.avatar_url || data.avatar || null,
        email: updatedData.email || user?.email
      }
      
      setProfile(updatedProfile)

    } catch (err) {
      console.error("API Update Error:", err)
      setError("Failed to update profile")
    }
  }, [user])

  const value = useMemo(() => ({ profile, isLoading, error, updateProfile }), [profile, isLoading, error, updateProfile])

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider")
  }
  return context
}
