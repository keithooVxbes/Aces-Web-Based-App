import { supabase } from "./supabase"

const SETTINGS_KEYS = [
  "aces-weather-city",
  "vite-ui-theme",
  "aces-dashboard-layout",
] as const

const SYNC_META_KEY = "aces-last-sync"
const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"

export interface ImportSummary {
  assignments: number
  notes: number
  folders: number
  transactions: number
  cashflowSubscriptions: number
  scheduleClasses: number
  hasProfile: boolean
  hasSettings: boolean
}

export async function exportToFile(): Promise<{
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      return { success: false, error: "You must be logged in to export data." }
    }

    const res = await fetch(`${API_URL}/export`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!res.ok) {
      return { success: false, error: "Failed to fetch export data from server." }
    }

    const exportPayload = await res.json()

    // Add UI settings to the payload
    const settings: Record<string, string | null> = {}
    for (const key of SETTINGS_KEYS) {
      settings[key] = localStorage.getItem(key)
    }
    exportPayload.settings = settings

    const jsonString = JSON.stringify(exportPayload, null, 2)

    // Send to Electron for saving
    const result = await window.ipcRenderer.dataSync.exportData(jsonString)

    if (result.success) {
      localStorage.setItem(
        SYNC_META_KEY,
        JSON.stringify({ type: "export", at: new Date().toISOString() })
      )
    }

    return result
  } catch (error: any) {
    console.error("Export error:", error)
    return { success: false, error: error.message || "An unexpected error occurred." }
  }
}

export async function importFromFile(): Promise<{
  success: boolean
  canceled?: boolean
  summary?: ImportSummary
  error?: string
}> {
  // TODO: Implementation for future restore/merge strategy.
  // 
  // Rationale for disabling:
  // Since ACES has migrated to a Cloud API-first architecture with relational databases, 
  // directly importing legacy local JSON backups may cause:
  // 1. UUID conflicts
  // 2. Foreign Key constraints failure (e.g. category_id mapping)
  // 3. Accidental overwriting of more recent cloud data.
  // 
  // Future solution: Create a dedicated Merge Resolver UI or endpoint that gracefully upserts
  // historical records to the current user's Supabase account.
  
  return { 
    success: false, 
    error: "Import functionality is temporarily disabled due to cloud migration. Your data is safely stored in the cloud." 
  }
}

export function getLastSyncInfo(): { type: string; at: string } | null {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
