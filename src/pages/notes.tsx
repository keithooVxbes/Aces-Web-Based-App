import {
  forwardRef,
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Archive,
  Bold,
  Check,
  Code,
  DownloadCloud,
  FileDown,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Heading1,
  Inbox,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Quote,
  Square,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react"

import { useNotes, type Note, type NoteFolder } from "@/lib/notes-store"
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const INBOX_DROP_TARGET = "__inbox__"

type NoteView = "all" | "pinned" | "inbox" | { folderId: string }

function isFolderView(view: NoteView): view is { folderId: string } {
  return typeof view === "object"
}

function getNoteTitle(content: string) {
  if (!content.trim()) return "New Note"

  const firstLine = content.split("\n").find((line) => line.trim()) ?? ""
  const strippedFirstLine = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim()
  const title = strippedFirstLine || firstLine.trim()

  return title.substring(0, 40) + (title.length > 40 ? "..." : "")
}

function getNotePreview(content: string) {
  const preview = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~()]/g, " ")
    .replace(/\[/g, " ")
    .replace(/\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!preview) return "Empty note"
  return preview.length > 150 ? `${preview.substring(0, 150)}…` : preview
}

function getFormattedDate(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  })
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function folderDropTarget(folderId: string | null) {
  return folderId === null ? INBOX_DROP_TARGET : `folder:${folderId}`
}

export default function NotesPage() {
  const {
    notes,
    folders,
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
  } = useNotes()

  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const selectionRef = useRef({ start: 0, end: 0 })
  const [activeView, setActiveView] = useState<NoteView>("all")
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropFolderTarget, setDropFolderTarget] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [contextDeleteNoteId, setContextDeleteNoteId] = useState<string | null>(null)
  const [editorDeleteNoteId, setEditorDeleteNoteId] = useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [folderName, setFolderName] = useState("")
  const [folderError, setFolderError] = useState("")
  const [folderToDelete, setFolderToDelete] = useState<NoteFolder | null>(null)
  const [editorView, setEditorView] = useState<"edit" | "preview">("edit")
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const selectedNoteIdSet = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds])
  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  )

  const filteredNotes = useMemo(() => {
    if (activeView === "pinned") return notes.filter((note) => note.pinned)
    if (activeView === "inbox") return notes.filter((note) => note.folderId === null)
    if (isFolderView(activeView)) {
      return notes.filter((note) => note.folderId === activeView.folderId)
    }
    return notes
  }, [activeView, notes])

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((note) => note.pinned),
    [filteredNotes],
  )
  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((note) => !note.pinned),
    [filteredNotes],
  )
  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId),
    [notes, activeNoteId],
  )
  const contextDeleteNote = useMemo(
    () => notes.find((note) => note.id === contextDeleteNoteId),
    [notes, contextDeleteNoteId],
  )
  const editorDeleteNote = useMemo(
    () => notes.find((note) => note.id === editorDeleteNoteId),
    [notes, editorDeleteNoteId],
  )
  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedNoteIdSet.has(note.id)),
    [notes, selectedNoteIdSet],
  )
  const allVisibleNotesSelected = filteredNotes.length > 0 && filteredNotes.every((note) => selectedNoteIdSet.has(note.id))
  const folderDeleteNoteCount = folderToDelete
    ? notes.filter((note) => note.folderId === folderToDelete.id).length
    : 0
  const deferredPreviewContent = useDeferredValue(activeNote?.content ?? "")
  const viewLabel = activeView === "pinned"
    ? "Pinned notes"
    : activeView === "inbox"
      ? "Inbox"
      : isFolderView(activeView)
        ? folderNames.get(activeView.folderId) ?? "Folder"
        : "All notes"
  const viewDescription = activeView === "pinned"
    ? "Notes you want to keep close."
    : activeView === "inbox"
      ? "Notes without a folder."
      : isFolderView(activeView)
        ? "Notes organized in this folder."
        : "Your notes, pinned and organized."

  const markdownComponents = useMemo<Components>(
    () => ({
      a: ({ href, children, ...props }) => (
        <a {...props} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    }),
    [],
  )

  useEffect(() => {
    setSelectedNoteIds((previous) => previous.filter((id) => notes.some((note) => note.id === id)))
  }, [notes])

  useEffect(() => {
    if (isFolderView(activeView) && !folders.some((folder) => folder.id === activeView.folderId)) {
      setActiveView("inbox")
    }
  }, [activeView, folders])

  useEffect(() => {
    if (activeNoteId && filteredNotes.some((note) => note.id === activeNoteId)) return
    setActiveNoteId(filteredNotes[0]?.id ?? null)
  }, [activeNoteId, activeView, filteredNotes, setActiveNoteId])

  useEffect(() => {
    if (isEditorOpen && !activeNote) setIsEditorOpen(false)
  }, [activeNote, isEditorOpen])

  const getCreationFolderId = useCallback(() => {
    return isFolderView(activeView) ? activeView.folderId : null
  }, [activeView])

  const handleSelectView = useCallback((view: NoteView) => {
    setIsEditorOpen(false)
    setActiveView(view)
  }, [])

  const handleOpenNote = useCallback((id: string) => {
    setActiveNoteId(id)
    setEditorView("edit")
    setIsEditorOpen(true)
  }, [setActiveNoteId])

  const handleCreateNote = useCallback(() => {
    if (activeView === "pinned") setActiveView("inbox")
    createNote(getCreationFolderId())
    setEditorView("edit")
    setIsEditorOpen(true)
  }, [activeView, createNote, getCreationFolderId])

  const topView = isFolderView(activeView) ? "all" : activeView
  const handleTopViewChange = useCallback((value: string) => {
    if (value === "all" || value === "pinned" || value === "inbox") {
      handleSelectView(value)
    }
  }, [handleSelectView])

  const exportSingleNote = () => {
    if (!activeNote) return
    const title = getNoteTitle(activeNote.content).replace(/[^a-z0-9]/gi, "_").toLowerCase() || "untitled"
    downloadTextFile(`${title}.md`, activeNote.content)
  }

  const exportAllNotes = () => {
    if (notes.length === 0) return
    const content = notes
      .map((note) => `## ${getNoteTitle(note.content)} (${getFormattedDate(note.lastModified)})\n\n${note.content}\n`)
      .join("\n\n")
    downloadTextFile("aces_notes_backup.md", content)
  }

  const exportSelectedNotes = () => {
    if (selectedNotes.length === 0) return
    const content = selectedNotes
      .map((note) => `## ${getNoteTitle(note.content)} (${getFormattedDate(note.lastModified)})\n\n${note.content}\n`)
      .join("\n\n")
    downloadTextFile("aces_selected_notes.md", content)
  }

  const resetDragState = useCallback(() => {
    setDraggedNoteId(null)
    setDropTargetId(null)
    setDropFolderTarget(null)
  }, [])

  const handleCardDragStart = (event: DragEvent<HTMLDivElement>, noteId: string) => {
    setDraggedNoteId(noteId)
    setDropTargetId(noteId)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", noteId)
  }

  const handleCardDragOver = (event: DragEvent<HTMLDivElement>, noteId: string) => {
    const sourceNoteId = draggedNoteId ?? event.dataTransfer.getData("text/plain")
    if (!sourceNoteId || sourceNoteId === noteId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropTargetId(noteId)
  }

  const handleCardDrop = (event: DragEvent<HTMLDivElement>, noteId: string) => {
    event.preventDefault()
    const sourceNoteId = draggedNoteId ?? event.dataTransfer.getData("text/plain")
    if (!sourceNoteId || sourceNoteId === noteId) {
      resetDragState()
      return
    }

    moveNote(sourceNoteId, noteId)
    resetDragState()
  }

  const handleFolderDragOver = (event: DragEvent<HTMLButtonElement>, folderId: string | null) => {
    const sourceNoteId = draggedNoteId ?? event.dataTransfer.getData("text/plain")
    if (!sourceNoteId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropFolderTarget(folderDropTarget(folderId))
  }

  const handleFolderDrop = (event: DragEvent<HTMLButtonElement>, folderId: string | null) => {
    event.preventDefault()
    const sourceNoteId = draggedNoteId ?? event.dataTransfer.getData("text/plain")
    if (sourceNoteId) setNoteFolder(sourceNoteId, folderId)
    resetDragState()
  }

  const toggleSelectionMode = () => {
    if (isSelectionMode) setSelectedNoteIds([])
    setIsSelectionMode(!isSelectionMode)
    resetDragState()
  }

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds((previous) =>
      previous.includes(noteId)
        ? previous.filter((id) => id !== noteId)
        : [...previous, noteId],
    )
  }

  const toggleSelectAllVisibleNotes = () => {
    const visibleIds = filteredNotes.map((note) => note.id)
    setSelectedNoteIds((previous) => {
      if (allVisibleNotesSelected) return previous.filter((id) => !visibleIds.includes(id))
      return Array.from(new Set([...previous, ...visibleIds]))
    })
  }

  const handleBulkDelete = () => {
    deleteNotes(selectedNoteIds)
    setSelectedNoteIds([])
    setIsSelectionMode(false)
    setIsEditorOpen(false)
  }

  const openCreateFolderDialog = () => {
    setEditingFolderId(null)
    setFolderName("")
    setFolderError("")
    setFolderDialogOpen(true)
  }

  const openRenameFolderDialog = (folder: NoteFolder) => {
    setEditingFolderId(folder.id)
    setFolderName(folder.name)
    setFolderError("")
    setFolderDialogOpen(true)
  }

  const handleFolderDialogSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = folderName.trim().replace(/\s+/g, " ")
    if (!normalizedName) {
      setFolderError("Enter a folder name.")
      return
    }
    if (normalizedName.toLocaleLowerCase() === "inbox") {
      setFolderError("Inbox is reserved for notes without a folder.")
      return
    }

    if (editingFolderId) {
      if (!renameFolder(editingFolderId, normalizedName)) {
        setFolderError("A folder with that name already exists.")
        return
      }
    } else {
      const folderId = createFolder(normalizedName)
      if (!folderId) {
        setFolderError("A folder with that name already exists.")
        return
      }
      handleSelectView({ folderId })
    }

    setFolderDialogOpen(false)
    setFolderError("")
  }

  const finishFolderDeletion = () => {
    if (folderToDelete && isFolderView(activeView) && activeView.folderId === folderToDelete.id) {
      setActiveView("inbox")
    }
    setIsEditorOpen(false)
    setFolderToDelete(null)
  }

  const handleDeleteFolder = () => {
    if (!folderToDelete) return
    deleteFolder(folderToDelete.id)
    finishFolderDeletion()
  }

  const handleDeleteFolderAndNotes = () => {
    if (!folderToDelete) return
    deleteFolderAndNotes(folderToDelete.id)
    finishFolderDeletion()
  }

  const syncSelectionFromEditor = useCallback(() => {
    if (!editorRef.current) return
    selectionRef.current = {
      start: editorRef.current.selectionStart,
      end: editorRef.current.selectionEnd,
    }
  }, [])

  const handleToolbarAction = useCallback(
    (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
      event.preventDefault()
      event.stopPropagation()
      syncSelectionFromEditor()
      action()
    },
    [syncSelectionFromEditor],
  )

  const getEditorSnapshot = () => {
    const textarea = editorRef.current
    if (!textarea) return null

    const source = textarea.value
    const isFocused = document.activeElement === textarea
    const rawStart = isFocused ? textarea.selectionStart : selectionRef.current.start
    const rawEnd = isFocused ? textarea.selectionEnd : selectionRef.current.end
    const selectionStart = Math.max(0, Math.min(rawStart, source.length))
    const selectionEnd = Math.max(selectionStart, Math.min(rawEnd, source.length))

    return { textarea, source, selectionStart, selectionEnd }
  }

  const applyInlineFormat = useCallback((prefix: string, suffix: string, placeholder: string) => {
    if (!activeNote) return
    const snapshot = getEditorSnapshot()
    if (!snapshot) return

    const { textarea, source, selectionStart, selectionEnd } = snapshot
    const selectedText = source.slice(selectionStart, selectionEnd)
    const textToInsert = selectedText || placeholder
    const nextContent = source.slice(0, selectionStart) + prefix + textToInsert + suffix + source.slice(selectionEnd)
    updateNote(activeNote.id, nextContent)

    requestAnimationFrame(() => {
      textarea.focus()
      const contentStart = selectionStart + prefix.length
      const contentEnd = contentStart + textToInsert.length
      textarea.setSelectionRange(contentStart, contentEnd)
      selectionRef.current = { start: contentStart, end: contentEnd }
    })
  }, [activeNote, updateNote])

  const applyLinePrefix = useCallback((prefix: string, fallback: string) => {
    if (!activeNote) return
    const snapshot = getEditorSnapshot()
    if (!snapshot) return

    const { textarea, source, selectionStart, selectionEnd } = snapshot
    const hasSelection = selectionStart !== selectionEnd
    const selectedText = hasSelection ? source.slice(selectionStart, selectionEnd) : fallback
    const transformed = selectedText
      .split("\n")
      .map((line) => (line.trim().length > 0 ? `${prefix}${line}` : line))
      .join("\n")
    const nextContent = source.slice(0, selectionStart) + transformed + source.slice(selectionEnd)
    updateNote(activeNote.id, nextContent)

    requestAnimationFrame(() => {
      textarea.focus()
      const selectStart = selectionStart + (hasSelection ? 0 : prefix.length)
      const selectEnd = hasSelection ? selectionStart + transformed.length : selectStart + fallback.length
      textarea.setSelectionRange(selectStart, selectEnd)
      selectionRef.current = { start: selectStart, end: selectEnd }
    })
  }, [activeNote, updateNote])

  const applyNumberedList = useCallback(() => {
    if (!activeNote) return
    const snapshot = getEditorSnapshot()
    if (!snapshot) return

    const { textarea, source, selectionStart, selectionEnd } = snapshot
    const hasSelection = selectionStart !== selectionEnd
    const selectedText = hasSelection ? source.slice(selectionStart, selectionEnd) : "First item"
    const transformed = selectedText
      .split("\n")
      .map((line, index) => (line.trim().length > 0 ? `${index + 1}. ${line}` : line))
      .join("\n")
    const nextContent = source.slice(0, selectionStart) + transformed + source.slice(selectionEnd)
    updateNote(activeNote.id, nextContent)

    requestAnimationFrame(() => {
      textarea.focus()
      const selectStart = selectionStart + (hasSelection ? 0 : 3)
      const selectEnd = hasSelection ? selectionStart + transformed.length : selectStart + "First item".length
      textarea.setSelectionRange(selectStart, selectEnd)
      selectionRef.current = { start: selectStart, end: selectEnd }
    })
  }, [activeNote, updateNote])

  return (
    <>
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFolderId ? "Rename folder" : "Create folder"}</DialogTitle>
            <DialogDescription>
              {editingFolderId ? "Give this folder a new name." : "Keep related notes together."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFolderDialogSubmit}>
            <FieldGroup>
              <Field data-invalid={Boolean(folderError)}>
                <FieldLabel htmlFor="folder-name">Folder name</FieldLabel>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(event) => {
                    setFolderName(event.target.value)
                    if (folderError) setFolderError("")
                  }}
                  placeholder="e.g. Project ideas"
                  autoFocus
                  aria-invalid={Boolean(folderError)}
                />
                {folderError ? <FieldError>{folderError}</FieldError> : <FieldDescription>Use a short, specific name.</FieldDescription>}
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingFolderId ? "Save changes" : "Create folder"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={contextDeleteNoteId !== null}
        onOpenChange={(open) => {
          if (!open) setContextDeleteNoteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This note will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (contextDeleteNote) deleteNote(contextDeleteNote.id)
                setContextDeleteNoteId(null)
                setIsEditorOpen(false)
              }}
            >
              Delete note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={editorDeleteNoteId !== null}
        onOpenChange={(open) => {
          if (!open) setEditorDeleteNoteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This note will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (editorDeleteNote) deleteNote(editorDeleteNote.id)
                setEditorDeleteNoteId(null)
                setIsEditorOpen(false)
              }}
            >
              Delete note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={folderToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFolderToDelete(null)
        }}
      >
        <AlertDialogContent className="data-[size=default]:max-w-md data-[size=default]:sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{folderToDelete?.name ?? "folder"}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {folderDeleteNoteCount === 0
                ? "This folder is empty. Choose whether to delete only the folder or its contents too."
                : `${folderDeleteNoteCount} ${folderDeleteNoteCount === 1 ? "note" : "notes"} will be affected. Choose whether to move them to Inbox or delete them permanently.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex sm:flex-wrap">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="w-fit whitespace-nowrap" onClick={handleDeleteFolder}>
              Delete folder only
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              className="w-fit whitespace-nowrap"
              onClick={handleDeleteFolderAndNotes}
            >
              Delete folder and notes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="motion-stagger grid min-h-[calc(100dvh-6rem)] gap-4 overflow-visible lg:h-[calc(100dvh-6rem)] lg:min-h-[28rem] lg:grid-cols-[14rem_minmax(0,1fr)] lg:overflow-hidden">
        <FolderRail
          folders={folders}
          notes={notes}
          activeView={activeView}
          draggedNoteId={draggedNoteId}
          dropFolderTarget={dropFolderTarget}
          onSelectView={handleSelectView}
          onCreateFolder={openCreateFolderDialog}
          onRenameFolder={openRenameFolderDialog}
          onDeleteFolder={setFolderToDelete}
          onFolderDragOver={handleFolderDragOver}
          onFolderDrop={handleFolderDrop}
          onDragEnd={resetDragState}
        />

        <section className="motion-card @container/notes-grid flex min-h-[26rem] min-w-0 flex-col overflow-hidden rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <Tabs
              value={topView}
              onValueChange={handleTopViewChange}
              className="min-w-0 flex-1 sm:max-w-md"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="all"
                  className="min-w-0 gap-1.5"
                  onClick={() => handleSelectView("all")}
                >
                  <Archive data-icon="inline-start" />
                  <span className="truncate">All notes</span>
                  <Badge variant="secondary">{notes.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pinned" className="min-w-0 gap-1.5">
                  <Pin data-icon="inline-start" />
                  <span className="truncate">Pinned</span>
                  <Badge variant="secondary">{notes.filter((note) => note.pinned).length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="inbox"
                  className={cn(
                    "min-w-0 gap-1.5",
                    dropFolderTarget === INBOX_DROP_TARGET && "bg-primary/10 text-primary ring-1 ring-primary/30",
                  )}
                  onDragOver={(event) => handleFolderDragOver(event, null)}
                  onDrop={(event) => handleFolderDrop(event, null)}
                >
                  <Inbox data-icon="inline-start" />
                  <span className="truncate">Inbox</span>
                  <Badge variant="secondary">{notes.filter((note) => note.folderId === null).length}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportAllNotes} disabled={notes.length === 0}>
                <DownloadCloud data-icon="inline-start" />
                Export
              </Button>
              <Button
                type="button"
                variant={isSelectionMode ? "secondary" : "outline"}
                size="sm"
                onClick={toggleSelectionMode}
                disabled={notes.length === 0}
                aria-pressed={isSelectionMode}
              >
                {isSelectionMode ? <X data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                {isSelectionMode ? "Done" : "Select"}
              </Button>
              <Button type="button" size="sm" onClick={handleCreateNote}>
                <Plus data-icon="inline-start" />
                New note
              </Button>
            </div>
          </header>

          {isSelectionMode && (
            <div className="flex flex-wrap items-center gap-2 bg-muted/30 px-4 py-2">
              <Button type="button" variant="ghost" size="sm" onClick={toggleSelectAllVisibleNotes}>
                {allVisibleNotesSelected ? "Clear visible" : "Select visible"}
              </Button>
              <span className="text-xs text-muted-foreground">{selectedNoteIds.length} selected</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={exportSelectedNotes}
                  disabled={selectedNoteIds.length === 0}
                  title="Export selected notes"
                  aria-label="Export selected notes"
                >
                  <FileDown />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      disabled={selectedNoteIds.length === 0}
                      title="Delete selected notes"
                      aria-label="Delete selected notes"
                    >
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete selected notes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {selectedNoteIds.length} {selectedNoteIds.length === 1 ? "note" : "notes"} will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={handleBulkDelete}>
                        Delete notes
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1">
            <div key={isFolderView(activeView) ? activeView.folderId : activeView} className="motion-content-swap flex flex-col gap-6 p-4">
              {isFolderView(activeView) && (
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Folder</p>
                    <h1 className="mt-1 text-xl font-semibold tracking-tight">{viewLabel}</h1>
                  </div>
                  <p className="text-sm text-muted-foreground">{viewDescription}</p>
                </div>
              )}
              {filteredNotes.length === 0 ? (
                <NotesEmptyState
                  view={activeView}
                  onCreateNote={handleCreateNote}
                />
              ) : (
                <>
                  {activeView !== "pinned" && pinnedNotes.length > 0 && (
                    <NoteSection
                      title="Pinned"
                      notes={pinnedNotes}
                      folders={folderNames}
                      availableFolders={folders}
                      activeNoteId={activeNoteId}
                      isSelectionMode={isSelectionMode}
                      selectedNoteIds={selectedNoteIdSet}
                      draggedNoteId={draggedNoteId}
                      dropTargetId={dropTargetId}
                      onSelect={handleOpenNote}
                      onToggleSelection={toggleNoteSelection}
                      onTogglePinned={setNotePinned}
                      onMoveToFolder={setNoteFolder}
                      onDelete={setContextDeleteNoteId}
                      onDragStart={handleCardDragStart}
                      onDragOver={handleCardDragOver}
                      onDrop={handleCardDrop}
                      onDragEnd={resetDragState}
                    />
                  )}
                  <NoteSection
                    title={activeView === "pinned" ? "Pinned notes" : "Notes"}
                    notes={activeView === "pinned" ? filteredNotes : unpinnedNotes}
                    folders={folderNames}
                    availableFolders={folders}
                    activeNoteId={activeNoteId}
                    isSelectionMode={isSelectionMode}
                    selectedNoteIds={selectedNoteIdSet}
                    draggedNoteId={draggedNoteId}
                    dropTargetId={dropTargetId}
                    onSelect={handleOpenNote}
                    onToggleSelection={toggleNoteSelection}
                    onTogglePinned={setNotePinned}
                    onMoveToFolder={setNoteFolder}
                    onDelete={setContextDeleteNoteId}
                    onDragStart={handleCardDragStart}
                    onDragOver={handleCardDragOver}
                    onDrop={handleCardDrop}
                    onDragEnd={resetDragState}
                  />
                </>
              )}
            </div>
          </ScrollArea>
        </section>

      </div>

      <NoteEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        activeNote={activeNote}
        activeFolderId={activeNote?.folderId ?? null}
        folderNames={folderNames}
        markdownComponents={markdownComponents}
        editorView={editorView}
        editorRef={editorRef}
        deferredPreviewContent={deferredPreviewContent}
        onEditorViewChange={setEditorView}
        onEditorSelectionSync={syncSelectionFromEditor}
        onEditorToolbarAction={handleToolbarAction}
        onApplyInlineFormat={applyInlineFormat}
        onApplyLinePrefix={applyLinePrefix}
        onApplyNumberedList={applyNumberedList}
        onUpdateNote={updateNote}
        onTogglePinned={setNotePinned}
        onExport={exportSingleNote}
        onDelete={setEditorDeleteNoteId}
        onCreateNote={handleCreateNote}
      />
    </>
  )
}

function NotesEmptyState({ view, onCreateNote }: { view: NoteView; onCreateNote: () => void }) {
  const isPinned = view === "pinned"
  const isInbox = view === "inbox"
  const title = isPinned ? "No pinned notes" : isInbox ? "Inbox is empty" : isFolderView(view) ? "Folder is empty" : "No notes yet"
  const description = isPinned
    ? "Pin important notes to keep them close."
    : isInbox
      ? "Create a note here or move one from another folder."
      : isFolderView(view)
        ? "Create a note to start building this folder."
        : "Create your first note and start writing."

  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isPinned ? <Pin /> : isInbox ? <Inbox /> : <FileText />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" onClick={onCreateNote}>
          <Plus data-icon="inline-start" />
          Create note
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function NoteSection({
  title,
  notes,
  folders,
  availableFolders,
  activeNoteId,
  isSelectionMode,
  selectedNoteIds,
  draggedNoteId,
  dropTargetId,
  onSelect,
  onToggleSelection,
  onTogglePinned,
  onMoveToFolder,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  title: string
  notes: Note[]
  folders: Map<string, string>
  availableFolders: NoteFolder[]
  activeNoteId: string | null
  isSelectionMode: boolean
  selectedNoteIds: Set<string>
  draggedNoteId: string | null
  dropTargetId: string | null
  onSelect: (id: string) => void
  onToggleSelection: (id: string) => void
  onTogglePinned: (id: string, pinned: boolean) => void
  onMoveToFolder: (id: string, folderId: string | null) => void
  onDelete: (id: string) => void
  onDragStart: (event: DragEvent<HTMLDivElement>, id: string) => void
  onDragOver: (event: DragEvent<HTMLDivElement>, id: string) => void
  onDrop: (event: DragEvent<HTMLDivElement>, id: string) => void
  onDragEnd: () => void
}) {
  if (notes.length === 0) return null

  return (
    <section aria-labelledby={`notes-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-3 flex items-center gap-2">
        <h2 id={`notes-section-${title.toLowerCase().replace(/\s+/g, "-")}`} className="text-sm font-semibold">
          {title}
        </h2>
        <Badge variant="secondary">{notes.length}</Badge>
      </div>
      <div className="motion-list grid grid-cols-1 gap-3 @xs/notes-grid:grid-cols-2 @2xl/notes-grid:grid-cols-3">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            folderName={note.folderId ? folders.get(note.folderId) ?? "Folder" : "Inbox"}
            availableFolders={availableFolders}
            isActive={activeNoteId === note.id}
            isSelectionMode={isSelectionMode}
            isSelected={selectedNoteIds.has(note.id)}
            isDragged={draggedNoteId === note.id}
            isDropTarget={dropTargetId === note.id}
            onSelect={onSelect}
            onToggleSelection={onToggleSelection}
            onTogglePinned={onTogglePinned}
            onMoveToFolder={onMoveToFolder}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </section>
  )
}

const NoteCard = memo(function NoteCard({
  note,
  folderName,
  availableFolders,
  isActive,
  isSelectionMode,
  isSelected,
  isDragged,
  isDropTarget,
  onSelect,
  onToggleSelection,
  onTogglePinned,
  onMoveToFolder,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  note: Note
  folderName: string
  availableFolders: NoteFolder[]
  isActive: boolean
  isSelectionMode: boolean
  isSelected: boolean
  isDragged: boolean
  isDropTarget: boolean
  onSelect: (id: string) => void
  onToggleSelection: (id: string) => void
  onTogglePinned: (id: string, pinned: boolean) => void
  onMoveToFolder: (id: string, folderId: string | null) => void
  onDelete: (id: string) => void
  onDragStart: (event: DragEvent<HTMLDivElement>, id: string) => void
  onDragOver: (event: DragEvent<HTMLDivElement>, id: string) => void
  onDrop: (event: DragEvent<HTMLDivElement>, id: string) => void
  onDragEnd: () => void
}) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return
    if (isSelectionMode) onToggleSelection(note.id)
    else onSelect(note.id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (isSelectionMode) onToggleSelection(note.id)
      else onSelect(note.id)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          size="sm"
          role="button"
          tabIndex={0}
          draggable={!isSelectionMode}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragStart={(event) => onDragStart(event, note.id)}
          onDragOver={(event) => onDragOver(event, note.id)}
          onDrop={(event) => onDrop(event, note.id)}
          onDragEnd={onDragEnd}
          aria-pressed={isSelectionMode ? isSelected : isActive}
          aria-grabbed={isDragged}
          className={cn(
            "motion-card min-h-52 cursor-pointer text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isActive && !isSelectionMode && "ring-2 ring-primary/40",
            isDragged && "opacity-60",
            isDropTarget && !isDragged && "ring-2 ring-primary/50",
            isSelectionMode && isSelected && "bg-accent ring-2 ring-primary/40",
          )}
        >
          <CardHeader className="gap-2 pb-2">
            <CardTitle className="line-clamp-2 text-sm leading-snug">{getNoteTitle(note.content)}</CardTitle>
            <CardAction>
              {isSelectionMode ? (
                <span className="flex size-7 items-center justify-center text-muted-foreground">
                  {isSelected ? <Check className="text-primary" /> : <Square />}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePinned(note.id, !note.pinned)
                  }}
                  title={note.pinned ? "Unpin note" : "Pin note"}
                  aria-label={note.pinned ? "Unpin note" : "Pin note"}
                >
                  {note.pinned ? <PinOff /> : <Pin />}
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{getNotePreview(note.content)}</p>
          </CardContent>
          <CardFooter className="justify-between gap-2 px-3 py-2">
            <Badge variant="outline" className="max-w-[60%] truncate">
              <Folder data-icon="inline-start" />
              {folderName}
            </Badge>
            <span className="shrink-0 text-xs text-muted-foreground">{getFormattedDate(note.lastModified)}</span>
          </CardFooter>
        </Card>
      </ContextMenuTrigger>
      {!isSelectionMode && (
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem onSelect={() => onTogglePinned(note.id, !note.pinned)}>
              {note.pinned ? <PinOff /> : <Pin />}
              {note.pinned ? "Unpin note" : "Pin note"}
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderOpen />
                Move to folder
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuGroup>
                  <ContextMenuItem disabled={note.folderId === null} onSelect={() => onMoveToFolder(note.id, null)}>
                    <Inbox />
                    Inbox
                  </ContextMenuItem>
                  {availableFolders.map((folder) => (
                    <ContextMenuItem
                      key={folder.id}
                      disabled={note.folderId === folder.id}
                      onSelect={() => onMoveToFolder(note.id, folder.id)}
                    >
                      <Folder />
                      {folder.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={() => onDelete(note.id)}>
              <Trash2 />
              Delete note
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
})

function FolderRail({
  folders,
  notes,
  activeView,
  draggedNoteId,
  dropFolderTarget,
  onSelectView,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onFolderDragOver,
  onFolderDrop,
  onDragEnd,
}: {
  folders: NoteFolder[]
  notes: Note[]
  activeView: NoteView
  draggedNoteId: string | null
  dropFolderTarget: string | null
  onSelectView: (view: NoteView) => void
  onCreateFolder: () => void
  onRenameFolder: (folder: NoteFolder) => void
  onDeleteFolder: (folder: NoteFolder) => void
  onFolderDragOver: (event: DragEvent<HTMLButtonElement>, folderId: string | null) => void
  onFolderDrop: (event: DragEvent<HTMLButtonElement>, folderId: string | null) => void
  onDragEnd: () => void
}) {
  const noteCount = (predicate: (note: Note) => boolean) => notes.filter(predicate).length

  return (
    <aside className="motion-card flex max-h-72 min-h-0 flex-col overflow-hidden rounded-xl border bg-card/50 shadow-sm backdrop-blur-sm lg:max-h-none">
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderOpen className="size-5" />
          </div>
          <p className="text-sm font-semibold">Folders</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCreateFolder} title="Create folder" aria-label="Create folder">
          <FolderPlus />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="motion-list flex flex-col gap-1 p-2">
          {folders.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No folders yet.</p>
          ) : (
            folders.map((folder) => (
              <ContextMenu key={folder.id}>
                <ContextMenuTrigger asChild>
                  <FolderNavButton
                    icon={Folder}
                    label={folder.name}
                    count={noteCount((note) => note.folderId === folder.id)}
                    active={isFolderView(activeView) && activeView.folderId === folder.id}
                    onClick={() => onSelectView({ folderId: folder.id })}
                    folderId={folder.id}
                    onDragOver={onFolderDragOver}
                    onDrop={onFolderDrop}
                    onDragEnd={onDragEnd}
                    dropTarget={dropFolderTarget === folderDropTarget(folder.id)}
                  />
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuGroup>
                    <ContextMenuItem onSelect={() => onRenameFolder(folder)}>
                      <MoreHorizontal />
                      Rename folder
                    </ContextMenuItem>
                    <ContextMenuItem variant="destructive" onSelect={() => onDeleteFolder(folder)}>
                      <Trash2 />
                      Delete folder...
                    </ContextMenuItem>
                  </ContextMenuGroup>
                </ContextMenuContent>
              </ContextMenu>
            ))
          )}
        </div>
      </ScrollArea>
      {draggedNoteId && (
        <>
          <Separator />
          <div className="bg-muted/30 p-2 text-center text-xs text-muted-foreground">
            Drop on a folder to move
          </div>
        </>
      )}
    </aside>
  )
}

type FolderNavButtonProps = {
  icon: LucideIcon
  label: string
  count: number
  active: boolean
  folderId?: string | null
  onClick: () => void
  onDragOver?: (event: DragEvent<HTMLButtonElement>, folderId: string | null) => void
  onDrop?: (event: DragEvent<HTMLButtonElement>, folderId: string | null) => void
  onDragEnd?: () => void
  dropTarget?: boolean
} & Omit<
  ComponentProps<"button">,
  "children" | "onClick" | "onDragOver" | "onDrop" | "onDragEnd"
>

const FolderNavButton = forwardRef<HTMLButtonElement, FolderNavButtonProps>(
  function FolderNavButton(
    {
      icon: Icon,
      label,
      count,
      active,
      folderId,
      onClick,
      onDragOver,
      onDrop,
      onDragEnd,
      dropTarget,
      className,
      ...buttonProps
    },
    ref,
  ) {
    return (
      <Button
        {...buttonProps}
        ref={ref}
        type="button"
        variant={active ? "secondary" : "ghost"}
        className={cn(
          "h-9 w-full justify-start gap-2 px-2",
          dropTarget && "bg-primary/10 text-primary ring-1 ring-primary/30",
          className,
        )}
        onClick={onClick}
        onDragOver={onDragOver && folderId !== undefined ? (event) => onDragOver(event, folderId) : undefined}
        onDrop={onDrop && folderId !== undefined ? (event) => onDrop(event, folderId) : undefined}
        onDragEnd={onDragEnd}
        title={label}
      >
        <Icon data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </Button>
    )
  },
)

function NoteEditorDialog({
  open,
  onOpenChange,
  ...props
}: ComponentProps<typeof EditorContent> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80vh] max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-none gap-0 overflow-hidden p-0 sm:w-full sm:max-w-4xl">
        <DialogTitle className="sr-only">Note editor</DialogTitle>
        <DialogDescription className="sr-only">Edit note in Markdown.</DialogDescription>
        <EditorContent {...props} />
      </DialogContent>
    </Dialog>
  )
}

function EditorContent({
  activeNote,
  activeFolderId,
  folderNames,
  markdownComponents,
  editorView,
  editorRef,
  deferredPreviewContent,
  onEditorViewChange,
  onEditorSelectionSync,
  onEditorToolbarAction,
  onApplyInlineFormat,
  onApplyLinePrefix,
  onApplyNumberedList,
  onUpdateNote,
  onTogglePinned,
  onExport,
  onDelete,
  onCreateNote,
}: {
  activeNote: Note | undefined
  activeFolderId: string | null
  folderNames: Map<string, string>
  markdownComponents: Components
  editorView: "edit" | "preview"
  editorRef: RefObject<HTMLTextAreaElement>
  deferredPreviewContent: string
  onEditorViewChange: (view: "edit" | "preview") => void
  onEditorSelectionSync: () => void
  onEditorToolbarAction: (event: MouseEvent<HTMLButtonElement>, action: () => void) => void
  onApplyInlineFormat: (prefix: string, suffix: string, placeholder: string) => void
  onApplyLinePrefix: (prefix: string, fallback: string) => void
  onApplyNumberedList: () => void
  onUpdateNote: (id: string, content: string) => void
  onTogglePinned: (id: string, pinned: boolean) => void
  onExport: () => void
  onDelete: (id: string) => void
  onCreateNote: () => void
}) {
  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-none border-0 bg-background">
      {activeNote ? (
        <>
          <header className="flex items-center gap-2 border-b p-3 pr-10">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{getNoteTitle(activeNote.content)}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Folder />
                <span className="truncate">{activeFolderId ? folderNames.get(activeFolderId) ?? "Folder" : "Inbox"}</span>
                <span>·</span>
                <span>{getFormattedDate(activeNote.lastModified)}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onTogglePinned(activeNote.id, !activeNote.pinned)}
              title={activeNote.pinned ? "Unpin note" : "Pin note"}
              aria-label={activeNote.pinned ? "Unpin note" : "Pin note"}
            >
              {activeNote.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onExport} title="Export note" aria-label="Export note">
              <FileDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onDelete(activeNote.id)} title="Delete note" aria-label="Delete note">
              <Trash2 />
            </Button>
          </header>

          <Tabs
            value={editorView}
            onValueChange={(value) => onEditorViewChange(value as "edit" | "preview")}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              {editorView === "edit" && (
                <NoteToolbar
                  onApplyInlineFormat={onApplyInlineFormat}
                  onApplyLinePrefix={onApplyLinePrefix}
                  onApplyNumberedList={onApplyNumberedList}
                  onHandleAction={onEditorToolbarAction}
                />
              )}
            </div>
            <TabsContent value="edit" className="mt-0 flex min-h-0 flex-1">
              <textarea
                ref={editorRef}
                className="min-h-0 w-full flex-1 resize-none border-none bg-transparent p-5 text-[15px] leading-relaxed text-foreground outline-none shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
                placeholder="Write your note in Markdown..."
                value={activeNote.content}
                onChange={(event) => onUpdateNote(activeNote.id, event.target.value)}
                onSelect={onEditorSelectionSync}
                onKeyUp={onEditorSelectionSync}
                onMouseUp={onEditorSelectionSync}
                onBlur={onEditorSelectionSync}
                autoFocus
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-0 flex min-h-0 flex-1">
              <ScrollArea className="h-full w-full">
                {deferredPreviewContent.trim() ? (
                  <article className="max-w-none p-5 text-[15px] leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {deferredPreviewContent}
                    </ReactMarkdown>
                  </article>
                ) : (
                  <div className="flex h-full min-h-60 items-center justify-center px-5 text-center text-sm text-muted-foreground">
                    Markdown preview will appear here once you start typing.
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Empty className="m-4 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>Select a note</EmptyTitle>
            <EmptyDescription>Choose a note from the grid or create a new one.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={onCreateNote}>
              <Plus data-icon="inline-start" />
              Create note
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </aside>
  )
}

const NoteToolbar = memo(function NoteToolbar({
  onApplyInlineFormat,
  onApplyLinePrefix,
  onApplyNumberedList,
  onHandleAction,
}: {
  onApplyInlineFormat: (prefix: string, suffix: string, placeholder: string) => void
  onApplyLinePrefix: (prefix: string, fallback: string) => void
  onApplyNumberedList: () => void
  onHandleAction: (event: MouseEvent<HTMLButtonElement>, action: () => void) => void
}) {
  return (
    <div className="scrollbar-none ml-auto flex items-center gap-1 overflow-x-auto overflow-y-hidden px-1 py-1">
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyInlineFormat("**", "**", "bold text"))} title="Bold" aria-label="Bold"><Bold /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyInlineFormat("*", "*", "italic text"))} title="Italic" aria-label="Italic"><Italic /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyLinePrefix("# ", "Heading"))} title="Heading" aria-label="Heading"><Heading1 /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyLinePrefix("- ", "List item"))} title="Bulleted list" aria-label="Bulleted list"><List /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, onApplyNumberedList)} title="Numbered list" aria-label="Numbered list"><ListOrdered /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyLinePrefix("- [ ] ", "Task"))} title="Checklist" aria-label="Checklist"><ListChecks /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyLinePrefix("> ", "Quote"))} title="Quote" aria-label="Quote"><Quote /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyInlineFormat("`", "`", "code"))} title="Inline code" aria-label="Inline code"><Code /></Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={(event) => onHandleAction(event, () => onApplyInlineFormat("[", "](https://)", "link text"))} title="Insert link" aria-label="Insert link"><Link2 /></Button>
    </div>
  )
})
