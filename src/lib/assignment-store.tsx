import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "./supabase"
import { useAuth } from "./auth-provider"

export type AssignmentPriority = "low" | "medium" | "high"
export type AssignmentStatus = "todo" | "in-progress" | "done"

export interface Assignment {
  id: string
  title: string
  course: string
  description: string
  dueDate: string
  priority: AssignmentPriority
  status: AssignmentStatus
  createdAt: string
}

interface AssignmentStore {
  assignments: Assignment[]
  isLoading: boolean
  error: string | null
  addAssignment: (assignment: Omit<Assignment, "id" | "createdAt">) => void
  updateAssignment: (id: string, updates: Partial<Assignment>) => void
  deleteAssignment: (id: string) => void
  moveAssignment: (id: string, newStatus: AssignmentStatus) => void
}

const STORAGE_KEY_PREFIX = "aces-assignments"

// Namespace localStorage by user ID so users never see each other's cached data
function getUserStorageKey(userId: string | undefined) {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX
}

function loadLocalAssignments(userId: string | undefined): Assignment[] {
  try {
    const stored = localStorage.getItem(getUserStorageKey(userId))
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveLocalAssignments(userId: string | undefined, assignments: Assignment[]) {
  localStorage.setItem(getUserStorageKey(userId), JSON.stringify(assignments))
}

const AssignmentContext = createContext<AssignmentStore | null>(null)

export function AssignmentProvider({ children }: { children: React.ReactNode }) {
  // Start with empty array — API is the source of truth, not localStorage
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    console.log("[DEBUG][Frontend] Current session user:", data.session?.user?.id)
    return data.session?.access_token
  }

  // Fetch assignments from API whenever the authenticated user changes
  useEffect(() => {
    // Reset state when user changes (including logout)
    setAssignments([])
    setError(null)

    if (!user) {
      setIsLoading(false)
      return
    }

    const fetchAssignments = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const token = await getAuthToken()
        if (!token) {
          setIsLoading(false)
          return
        }

        console.log("[DEBUG][Frontend] Fetching assignments from API for user:", user.id)

        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assignments`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!res.ok) {
          const errBody = await res.text()
          console.error("[DEBUG][Frontend] API response error:", res.status, errBody)
          throw new Error(`Server error ${res.status}: ${errBody}`)
        }
        
        const data = await res.json()
        console.log("[DEBUG][Frontend] API response assignments:", data)
        setAssignments(data)
        saveLocalAssignments(user.id, data) // Cache per-user backup
      } catch (err: any) {
        console.error("[DEBUG][Frontend] API Fetch Error, falling back to user-scoped localStorage:", err)
        setError("Offline mode: Using local data")
        // Fallback: load ONLY this user's cached data
        setAssignments(loadLocalAssignments(user.id))
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssignments()
  }, [user])

  // Sync to user-scoped localStorage on state change
  useEffect(() => {
    if (user) {
      saveLocalAssignments(user.id, assignments)
    }
  }, [assignments, user])

  const addAssignment = useCallback(
    async (assignment: Omit<Assignment, "id" | "createdAt">) => {
      // Optimistic update for snappy UI
      const tempId = crypto.randomUUID()
      const optimisticAssignment: Assignment = {
        ...assignment,
        id: tempId,
        createdAt: new Date().toISOString(),
      }
      setAssignments((prev) => [...prev, optimisticAssignment])

      try {
        const token = await getAuthToken()
        console.log("[DEBUG][Frontend] Sending assignment:", assignment)

        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(assignment)
        })

        if (!res.ok) {
          const errBody = await res.text()
          console.error("[DEBUG][Frontend] POST error:", res.status, errBody)
          throw new Error(`Failed to save: ${errBody}`)
        }

        const savedAssignment = await res.json()
        console.log("[DEBUG][Frontend] API response saved:", savedAssignment)
        // Replace optimistic temp assignment with real server data
        setAssignments((prev) => prev.map(a => a.id === tempId ? savedAssignment : a))
      } catch (err) {
        console.error("[DEBUG][Frontend] API Save Error:", err)
        // Rollback optimistic update on failure
        setAssignments((prev) => prev.filter(a => a.id !== tempId))
        setError("Failed to save assignment. Please try again.")
      }
    },
    []
  )

  const updateAssignment = useCallback(
    async (id: string, updates: Partial<Assignment>) => {
      // Optimistic update
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      )

      try {
        const token = await getAuthToken()
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assignments/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        })
        if (!res.ok) throw new Error("Failed to update assignment on server")
      } catch (err) {
        console.error("[DEBUG][Frontend] API Update Error:", err)
      }
    },
    []
  )

  const deleteAssignment = useCallback(async (id: string) => {
    // Optimistic update
    setAssignments((prev) => prev.filter((a) => a.id !== id))

    try {
      const token = await getAuthToken()
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assignments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error("Failed to delete assignment on server")
    } catch (err) {
      console.error("[DEBUG][Frontend] API Delete Error:", err)
    }
  }, [])

  const moveAssignment = useCallback(
    async (id: string, newStatus: AssignmentStatus) => {
      // Optimistic update
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
      )

      try {
        const token = await getAuthToken()
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/assignments/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        })
        if (!res.ok) throw new Error("Failed to move assignment on server")
      } catch (err) {
        console.error("[DEBUG][Frontend] API Move Error:", err)
      }
    },
    []
  )

  const value = useMemo(
    () => ({ assignments, isLoading, error, addAssignment, updateAssignment, deleteAssignment, moveAssignment }),
    [assignments, isLoading, error, addAssignment, updateAssignment, deleteAssignment, moveAssignment]
  )

  return (
    <AssignmentContext.Provider value={value}>
      {children}
    </AssignmentContext.Provider>
  )
}

export function useAssignments() {
  const context = useContext(AssignmentContext)
  if (!context) {
    throw new Error("useAssignments must be used within an AssignmentProvider")
  }
  return context
}
