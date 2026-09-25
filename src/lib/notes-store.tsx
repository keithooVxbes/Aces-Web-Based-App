import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

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

const NOTES_STORAGE_KEY = "aces-notes"
const FOLDERS_STORAGE_KEY = "aces-note-folders"

const NotesContext = createContext<NotesStore | null>(null)

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function loadFolders(): NoteFolder[] {
  const parsed = parseJson(readStorageItem(FOLDERS_STORAGE_KEY))
  if (!Array.isArray(parsed)) return []

  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  return parsed.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const candidate = value as Record<string, unknown>
    const id = typeof candidate.id === "string" ? candidate.id : ""
    const name = typeof candidate.name === "string" ? candidate.name.trim() : ""
    const normalizedName = name.toLocaleLowerCase()
    const createdAt = typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now()

    if (
      !id ||
      !name ||
      isReservedFolderName(normalizedName) ||
      seenIds.has(id) ||
      seenNames.has(normalizedName)
    ) {
      return []
    }
    seenIds.add(id)
    seenNames.add(normalizedName)

    return [{ id, name, createdAt }]
  })
}

function loadNotes(folders: NoteFolder[]): Note[] {
  const parsed = parseJson(readStorageItem(NOTES_STORAGE_KEY))
  if (!Array.isArray(parsed)) return []

  const folderIds = new Set(folders.map((folder) => folder.id))
  const seenIds = new Set<string>()

  return parsed.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const candidate = value as Record<string, unknown>
    const id = typeof candidate.id === "string" ? candidate.id : ""
    if (!id || seenIds.has(id)) return []
    seenIds.add(id)

    const folderId = typeof candidate.folderId === "string" && folderIds.has(candidate.folderId)
      ? candidate.folderId
      : null

    return [{
      id,
      content: typeof candidate.content === "string" ? candidate.content : "",
      lastModified: typeof candidate.lastModified === "number" ? candidate.lastModified : Date.now(),
      pinned: typeof candidate.pinned === "boolean" ? candidate.pinned : false,
      folderId,
    }]
  })
}

function loadInitialState(): NotesState {
  const folders = loadFolders()
  return {
    folders,
    notes: loadNotes(folders),
  }
}

function normalizeFolderName(name: string) {
  return name.trim().replace(/\s+/g, " ")
}

function folderNameExists(folders: NoteFolder[], name: string, ignoredId?: string) {
  const normalizedName = name.toLocaleLowerCase()
  return folders.some(
    (folder) => folder.id !== ignoredId && folder.name.toLocaleLowerCase() === normalizedName,
  )
}

function isReservedFolderName(name: string) {
  return name.toLocaleLowerCase() === "inbox"
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NotesState>(loadInitialState)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(
    () => state.notes[0]?.id ?? null,
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state.notes))
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(state.folders))
      } catch {
        // Local storage can be unavailable in restricted browser contexts.
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [state])

  useEffect(() => {
    setActiveNoteId((currentId) => {
      if (currentId && state.notes.some((note) => note.id === currentId)) {
        return currentId
      }

      return state.notes[0]?.id ?? null
    })
  }, [state.notes])

  const createNote = useCallback((folderId: string | null = null) => {
    const validFolderId = folderId && state.folders.some((folder) => folder.id === folderId)
      ? folderId
      : null
    const newNote: Note = {
      id: createId("note"),
      content: "",
      lastModified: Date.now(),
      pinned: false,
      folderId: validFolderId,
    }

    setState((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
    }))
    setActiveNoteId(newNote.id)
  }, [state.folders])

  const updateNote = useCallback((id: string, content: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) =>
        note.id === id ? { ...note, content, lastModified: Date.now() } : note,
      ),
    }))
  }, [])

  const moveNote = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return

    setState((prev) => {
      const draggedIndex = prev.notes.findIndex((note) => note.id === draggedId)
      const targetIndex = prev.notes.findIndex((note) => note.id === targetId)
      if (draggedIndex === -1 || targetIndex === -1) return prev

      const next = [...prev.notes]
      const draggedNote = next[draggedIndex]
      next[draggedIndex] = next[targetIndex]
      next[targetIndex] = draggedNote
      return { ...prev, notes: next }
    })
  }, [])

  const setNotePinned = useCallback((id: string, pinned: boolean) => {
    setState((prev) => {
      const noteIndex = prev.notes.findIndex((note) => note.id === id)
      if (noteIndex === -1) return prev

      const current = prev.notes[noteIndex]
      if (current.pinned === pinned) return prev

      const updatedNote = { ...current, pinned }
      const withoutCurrent = prev.notes.filter((note) => note.id !== id)

      if (pinned) {
        return { ...prev, notes: [updatedNote, ...withoutCurrent] }
      }

      const firstUnpinnedIndex = withoutCurrent.findIndex((note) => !note.pinned)
      const insertionIndex = firstUnpinnedIndex === -1
        ? withoutCurrent.length
        : firstUnpinnedIndex

      const next = [...withoutCurrent]
      next.splice(insertionIndex, 0, updatedNote)
      return { ...prev, notes: next }
    })
  }, [])

  const setNoteFolder = useCallback((id: string, folderId: string | null) => {
    setState((prev) => {
      if (folderId !== null && !prev.folders.some((folder) => folder.id === folderId)) {
        return prev
      }

      const noteIndex = prev.notes.findIndex((note) => note.id === id)
      if (noteIndex === -1 || prev.notes[noteIndex].folderId === folderId) return prev

      return {
        ...prev,
        notes: prev.notes.map((note) =>
          note.id === id ? { ...note, folderId } : note,
        ),
      }
    })
  }, [])

  const createFolder = useCallback((name: string) => {
    const normalizedName = normalizeFolderName(name)
    if (!normalizedName || isReservedFolderName(normalizedName) || folderNameExists(state.folders, normalizedName)) return null

    const folder: NoteFolder = {
      id: createId("folder"),
      name: normalizedName,
      createdAt: Date.now(),
    }

    setState((prev) => {
      if (folderNameExists(prev.folders, normalizedName)) return prev
      return { ...prev, folders: [...prev.folders, folder] }
    })

    return folder.id
  }, [state.folders])

  const renameFolder = useCallback((id: string, name: string) => {
    const normalizedName = normalizeFolderName(name)
    if (
      !normalizedName ||
      isReservedFolderName(normalizedName) ||
      !state.folders.some((folder) => folder.id === id) ||
      folderNameExists(state.folders, normalizedName, id)
    ) {
      return false
    }

    setState((prev) => ({
      ...prev,
      folders: prev.folders.map((folder) =>
        folder.id === id ? { ...folder, name: normalizedName } : folder,
      ),
    }))

    return true
  }, [state.folders])

  const deleteFolder = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      folders: prev.folders.filter((folder) => folder.id !== id),
      notes: prev.notes.map((note) =>
        note.folderId === id ? { ...note, folderId: null } : note,
      ),
    }))
  }, [])

  const deleteFolderAndNotes = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      folders: prev.folders.filter((folder) => folder.id !== id),
      notes: prev.notes.filter((note) => note.folderId !== id),
    }))
  }, [])

  const deleteNote = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== id),
    }))
  }, [])

  const deleteNotes = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idsToDelete = new Set(ids)
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => !idsToDelete.has(note.id)),
    }))
  }, [])

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
