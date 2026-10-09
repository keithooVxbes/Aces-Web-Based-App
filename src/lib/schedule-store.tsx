import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { ScheduleClass, initialScheduleData } from "./schedule-data"
import { useAuth } from "./auth-provider"
import { supabase } from "./supabase"

interface ScheduleStore {
  classes: ScheduleClass[]
  isLoading: boolean
  addClass: (cls: Omit<ScheduleClass, "id">) => Promise<void>
  removeClass: (id: string) => Promise<void>
  updateClass: (id: string, updates: Partial<ScheduleClass>) => Promise<void>
}

const STORAGE_PREFIX = "aces-schedule"

function getStorageKey(userId: string | undefined) {
  return userId ? `${STORAGE_PREFIX}-${userId}` : STORAGE_PREFIX
}

function readStorageItem(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function parseJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const ScheduleContext = createContext<ScheduleStore | null>(null)

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [classes, setClasses] = useState<ScheduleClass[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }
  
  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"

  // Load Local Fallback
  useEffect(() => {
    if (!user) {
      setClasses(initialScheduleData)
      return
    }
    const cachedData = parseJson(readStorageItem(getStorageKey(user.id))) as ScheduleClass[] || []
    setClasses(cachedData)
  }, [user?.id])

  // Fetch API Data
  useEffect(() => {
    if (!user) return
    let isMounted = true
    
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const token = await getAuthToken()
        if (!token) return

        const res = await fetch(`${API_URL}/schedules`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!res.ok) throw new Error("Failed to fetch schedules")

        const fetchedClasses: ScheduleClass[] = await res.json()
        
        if (isMounted) {
          setClasses(fetchedClasses)
          localStorage.setItem(getStorageKey(user.id), JSON.stringify(fetchedClasses))
        }
      } catch (err) {
        console.error("Schedule Fetch API Error:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    
    fetchData()
    return () => { isMounted = false }
  }, [user?.id])

  // Keep local storage synced
  useEffect(() => {
    if (!user) return
    localStorage.setItem(getStorageKey(user.id), JSON.stringify(classes))
  }, [classes, user?.id])

  const addClass = useCallback(
    async (cls: Omit<ScheduleClass, "id">) => {
      if (!user) return
      
      const newClassPayload = {
        id: crypto.randomUUID(),
        ...cls
      }

      console.log("[DEBUG] addClass payload:", newClassPayload)

      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/schedules`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(newClassPayload)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMsg = errorData.error || "Failed to create schedule"
        console.error("[DEBUG] addClass error:", errorMsg)
        throw new Error(errorMsg) // Let the UI component catch and show toast
      }

      const createdClass: ScheduleClass = await res.json()
      console.log("[DEBUG] addClass success:", createdClass)
      
      setClasses((prev) => [...prev, createdClass])
    },
    [user?.id]
  )

  const removeClass = useCallback(async (id: string) => {
    if (!user) return
    
    let previousClasses: ScheduleClass[] = []
    setClasses((prev) => {
      previousClasses = [...prev]
      return prev.filter((c) => c.id !== id)
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/schedules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error("Failed to delete schedule")
    } catch (err) {
      console.error("[DEBUG] removeClass rollback:", err)
      setClasses(previousClasses)
      throw err
    }
  }, [user?.id])

  const updateClass = useCallback(
    async (id: string, updates: Partial<ScheduleClass>) => {
      if (!user) return
      
      let previousClasses: ScheduleClass[] = []
      setClasses((prev) => {
        previousClasses = [...prev]
        return prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      })

      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_URL}/schedules/${id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(updates)
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to update schedule")
        }
      } catch (err) {
        console.error("[DEBUG] updateClass rollback:", err)
        setClasses(previousClasses)
        throw err
      }
    },
    [user?.id]
  )

  const value = useMemo(
    () => ({ classes, isLoading, addClass, removeClass, updateClass }),
    [classes, isLoading, addClass, removeClass, updateClass]
  )

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  )
}

export function useSchedule() {
  const context = useContext(ScheduleContext)
  if (!context) {
    throw new Error("useSchedule must be used within a ScheduleProvider")
  }
  return context
}
