import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "./auth-provider"
import { supabase } from "./supabase"

export interface Note {
  id: string
  content: string
  lastModified: number
  pinned: boolean
  folderId: string | null
}

export interface NoteFolder {
  id: string
  name: string
  createdAt: number
}

interface NotesState {
  notes: Note[]
  folders: NoteFolder[]
}

interface NotesStore extends NotesState {
  activeNoteId: string | null
  setActiveNoteId: (id: string | null) => void
  createNote: (folderId?: string | null) => void
  updateNote: (id: string, content: string) => void
  setNotePinned: (id: string, pinned: boolean) => void
  setNoteFolder: (id: string, folderId: string | null) => void
  createFolder: (name: string) => string | null
  renameFolder: (id: string, name: string) => boolean
  deleteFolder: (id: string) => void
  deleteFolderAndNotes: (id: string) => void
  deleteNote: (id: string) => void
  deleteNotes: (ids: string[]) => void
  moveNote: (draggedId: string, targetId: string) => void
}

const NOTES_STORAGE_PREFIX = "aces-notes"
const FOLDERS_STORAGE_PREFIX = "aces-note-folders"

function getStorageKey(prefix: string, userId: string | undefined) {
  return userId ? `${prefix}-${userId}` : prefix
}

function createId(prefix: string) {
  // Postgres requires valid UUIDs. Ignore the prefix.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
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

const NotesContext = createContext<NotesStore | null>(null)

export function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  
  const [state, setState] = useState<NotesState>({ notes: [], folders: [] })
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  
  // Helpers
  const getAuthToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }
  
  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"

  // 1. Load Local Fallback
  useEffect(() => {
    if (!user) {
      console.log("[DEBUG] No user, resetting local fallback state.");
      setState({ notes: [], folders: [] })
      return
    }
    console.log("[DEBUG] Loading local fallback for user:", user.id);
    const foldersData = parseJson(readStorageItem(getStorageKey(FOLDERS_STORAGE_PREFIX, user.id))) as NoteFolder[] || []
    const notesData = parseJson(readStorageItem(getStorageKey(NOTES_STORAGE_PREFIX, user.id))) as Note[] || []
    setState({ folders: foldersData, notes: notesData })
  }, [user?.id])

  // 2. Fetch API Data
  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      console.log("[DEBUG] Fetching notes API for user:", user.id);
      try {
        const token = await getAuthToken()
        if (!token) return

        const [foldersRes, notesRes] = await Promise.all([
          fetch(`${API_URL}/notes/folders`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/notes`, { headers: { 'Authorization': `Bearer ${token}` } })
        ])

        if (!foldersRes.ok || !notesRes.ok) throw new Error("Failed to fetch data")

        const fetchedFolders: NoteFolder[] = await foldersRes.json()
        const fetchedNotes: Note[] = await notesRes.json()

        console.log("[DEBUG] API fetch success. Notes count:", fetchedNotes.length);
        setState({ folders: fetchedFolders, notes: fetchedNotes })
        
        // Cache locally
        localStorage.setItem(getStorageKey(FOLDERS_STORAGE_PREFIX, user.id), JSON.stringify(fetchedFolders))
        localStorage.setItem(getStorageKey(NOTES_STORAGE_PREFIX, user.id), JSON.stringify(fetchedNotes))

      } catch (err) {
        console.error("Notes Fetch API Error:", err)
      }
    }
    fetchData()
  }, [user?.id])

  // Track active note
  useEffect(() => {
    console.log("[DEBUG] useEffect [state.notes] triggered. Current notes length:", state.notes.length);
    setActiveNoteId((currentId) => {
      console.log("[DEBUG] setActiveNoteId evaluator. currentId:", currentId);
      if (currentId && state.notes.some((n) => n.id === currentId)) {
        console.log("[DEBUG] Keeping current activeNoteId:", currentId);
        return currentId
      }
      const fallbackId = state.notes.length > 0 ? state.notes[0].id : null;
      console.log("[DEBUG] currentId not found or null, falling back to:", fallbackId);
      return fallbackId
    })
  }, [state.notes])

  // Keep local storage up to date on changes
  useEffect(() => {
    if (!user) return
    localStorage.setItem(getStorageKey(NOTES_STORAGE_PREFIX, user.id), JSON.stringify(state.notes))
    localStorage.setItem(getStorageKey(FOLDERS_STORAGE_PREFIX, user.id), JSON.stringify(state.folders))
  }, [state, user])

  // --- ACTIONS ---

  const createNote = useCallback(async (folderId: string | null = null) => {
    if (!user) return
    const validFolderId = folderId && state.folders.some((f) => f.id === folderId) ? folderId : null
    
    const newNote: Note = {
      id: createId("note"),
      content: "",
      lastModified: Date.now(),
      pinned: false,
      folderId: validFolderId,
    }

    console.log(`[DEBUG] createNote: Creating new note ${newNote.id} in folder ${validFolderId}`);
    
    setState(prev => ({ ...prev, notes: [newNote, ...prev.notes] }))
    setActiveNoteId(newNote.id)
    console.log(`[DEBUG] createNote: Set optimistic state and activeNoteId to ${newNote.id}`);

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newNote)
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[DEBUG] createNote: POST failed with status ${res.status}. Body: ${errorText}`);
        throw new Error("Failed to save note")
      }
      console.log(`[DEBUG] createNote: POST success for ${newNote.id}`);
    } catch (err) {
      console.error("[DEBUG] createNote: Exception caught, rolling back.", err)
      setState(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== newNote.id) }))
    }
  }, [state.folders, user?.id])

  const updateNote = useCallback(async (id: string, content: string) => {
    if (!user) return
    
    // Backup for rollback
    let oldNote: Note | undefined
    
    setState(prev => {
      oldNote = prev.notes.find(n => n.id === id)
      return {
        ...prev,
        notes: prev.notes.map(n => n.id === id ? { ...n, content, lastModified: Date.now() } : n)
      }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content, lastModified: Date.now() })
      })
      if (!res.ok) throw new Error("Failed to update note")
    } catch (err) {
      console.error(err)
      if (oldNote) {
        setState(prev => ({
          ...prev,
          notes: prev.notes.map(n => n.id === id ? oldNote! : n)
        }))
      }
    }
  }, [user?.id])

  const moveNote = useCallback(async (draggedId: string, targetId: string) => {
    if (!user || draggedId === targetId) return
    
    let previousNotes: Note[] = []
    let newOrderedIds: string[] = []

    setState(prev => {
      previousNotes = [...prev.notes]
      const draggedIndex = prev.notes.findIndex(n => n.id === draggedId)
      const targetIndex = prev.notes.findIndex(n => n.id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return prev

      const next = [...prev.notes]
      const draggedNote = next[draggedIndex]
      next.splice(draggedIndex, 1) // remove from old
      next.splice(targetIndex, 0, draggedNote) // insert at new
      
      newOrderedIds = next.map(n => n.id)
      return { ...prev, notes: next }
    })

    if (newOrderedIds.length > 0) {
      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_URL}/notes/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderedIds: newOrderedIds })
        })
        if (!res.ok) throw new Error("Failed to reorder")
      } catch (err) {
        console.error(err)
        setState(prev => ({ ...prev, notes: previousNotes })) // Rollback
      }
    }
  }, [user?.id])

  const setNotePinned = useCallback(async (id: string, pinned: boolean) => {
    if (!user) return
    
    let oldNotes: Note[] = []
    
    setState(prev => {
      oldNotes = [...prev.notes]
      const noteIndex = prev.notes.findIndex(n => n.id === id)
      if (noteIndex === -1) return prev

      const updatedNote = { ...prev.notes[noteIndex], pinned }
      const withoutCurrent = prev.notes.filter(n => n.id !== id)

      if (pinned) {
        return { ...prev, notes: [updatedNote, ...withoutCurrent] }
      }
      
      const firstUnpinnedIndex = withoutCurrent.findIndex(n => !n.pinned)
      const insertionIndex = firstUnpinnedIndex === -1 ? withoutCurrent.length : firstUnpinnedIndex
      
      const next = [...withoutCurrent]
      next.splice(insertionIndex, 0, updatedNote)
      return { ...prev, notes: next }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pinned })
      })
      if (!res.ok) throw new Error("Failed to update pinned state")
    } catch (err) {
      console.error(err)
      setState(prev => ({ ...prev, notes: oldNotes }))
    }
  }, [user?.id])

  const setNoteFolder = useCallback(async (id: string, folderId: string | null) => {
    if (!user) return
    let oldNotes: Note[] = []
    
    setState(prev => {
      oldNotes = [...prev.notes]
      return {
        ...prev,
        notes: prev.notes.map(n => n.id === id ? { ...n, folderId } : n)
      }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ folderId })
      })
      if (!res.ok) throw new Error("Failed to set folder")
    } catch (err) {
      console.error(err)
      setState(prev => ({ ...prev, notes: oldNotes }))
    }
  }, [user?.id])

  const createFolder = useCallback((name: string) => {
    if (!user) return null
    const normalizedName = name.trim().replace(/\s+/g, " ").toLocaleLowerCase()
    if (!normalizedName || normalizedName === "inbox") return null
    if (state.folders.some(f => f.name.toLocaleLowerCase() === normalizedName)) return null

    const newFolder: NoteFolder = {
      id: createId("folder"),
      name: normalizedName,
      createdAt: Date.now()
    }

    setState(prev => ({ ...prev, folders: [...prev.folders, newFolder] }))

    getAuthToken().then(token => {
      fetch(`${API_URL}/notes/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newFolder)
      }).catch(err => {
        console.error(err)
        setState(prev => ({ ...prev, folders: prev.folders.filter(f => f.id !== newFolder.id) }))
      })
    })

    return newFolder.id
  }, [state.folders, user?.id])

  const renameFolder = useCallback((id: string, name: string) => {
    if (!user) return false
    const normalizedName = name.trim().replace(/\s+/g, " ").toLocaleLowerCase()
    if (!normalizedName || normalizedName === "inbox") return false
    
    if (state.folders.some(f => f.id !== id && f.name.toLocaleLowerCase() === normalizedName)) return false

    let oldFolders: NoteFolder[] = []
    
    setState(prev => {
      oldFolders = [...prev.folders]
      return {
        ...prev,
        folders: prev.folders.map(f => f.id === id ? { ...f, name: normalizedName } : f)
      }
    })

    getAuthToken().then(token => {
      fetch(`${API_URL}/notes/folders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: normalizedName })
      }).then(res => {
        if (!res.ok) throw new Error("Failed to rename folder")
      }).catch(err => {
        console.error(err)
        setState(prev => ({ ...prev, folders: oldFolders }))
      })
    })

    return true
  }, [state.folders, user?.id])

  const deleteFolder = useCallback(async (id: string) => {
    if (!user) return
    let oldState: NotesState = { notes: [], folders: [] }
    
    setState(prev => {
      oldState = { folders: [...prev.folders], notes: [...prev.notes] }
      return {
        ...prev,
        folders: prev.folders.filter(f => f.id !== id),
        notes: prev.notes.map(n => n.folderId === id ? { ...n, folderId: null } : n)
      }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete folder")
    } catch (err) {
      console.error(err)
      setState(oldState)
    }
  }, [user?.id])

  const deleteFolderAndNotes = useCallback(async (id: string) => {
    if (!user) return
    let oldState: NotesState = { notes: [], folders: [] }
    
    setState(prev => {
      oldState = { folders: [...prev.folders], notes: [...prev.notes] }
      return {
        ...prev,
        folders: prev.folders.filter(f => f.id !== id),
        notes: prev.notes.filter(n => n.folderId !== id)
      }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/folders/${id}/with-notes`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete folder and notes")
    } catch (err) {
      console.error(err)
      setState(oldState)
    }
  }, [user?.id])

  const deleteNote = useCallback(async (id: string) => {
    if (!user) return
    let oldNotes: Note[] = []
    
    setState(prev => {
      oldNotes = [...prev.notes]
      return { ...prev, notes: prev.notes.filter(n => n.id !== id) }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete note")
    } catch (err) {
      console.error(err)
      setState(prev => ({ ...prev, notes: oldNotes }))
    }
  }, [user?.id])

  const deleteNotes = useCallback(async (ids: string[]) => {
    if (!user || ids.length === 0) return
    let oldNotes: Note[] = []
    
    setState(prev => {
      oldNotes = [...prev.notes]
      const idsToDelete = new Set(ids)
      return { ...prev, notes: prev.notes.filter(n => !idsToDelete.has(n.id)) }
    })

    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/notes/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ids })
      })
      if (!res.ok) throw new Error("Failed to batch delete notes")
    } catch (err) {
      console.error(err)
      setState(prev => ({ ...prev, notes: oldNotes }))
    }
  }, [user?.id])

  const value = useMemo<NotesStore>(() => ({
    ...state,
    activeNoteId,
    setActiveNoteId,
    createNote,
    updateNote,
    setNotePinned,
    setNoteFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    deleteFolderAndNotes,
    deleteNote,
    deleteNotes,
    moveNote,
  }), [
    state,
    activeNoteId,
    createNote,
    updateNote,
    setNotePinned,
    setNoteFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    deleteFolderAndNotes,
    deleteNote,
    deleteNotes,
    moveNote,
  ])

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotes() {
  const context = useContext(NotesContext)
  if (!context) {
    throw new Error("useNotes must be used within a NotesProvider")
  }
  return context
}
