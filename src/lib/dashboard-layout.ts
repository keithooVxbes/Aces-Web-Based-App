import { useCallback, useEffect, useMemo, useState } from "react"

export const DASHBOARD_CARD_IDS = [
  "cashflow",
  "weather",
  "focus",
  "assignments",
  "schedule",
] as const

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number]
export type DashboardCardWidth = number
export type DashboardCardHeight = number | null

export const MIN_DASHBOARD_CARD_WIDTH = 3
export const MAX_DASHBOARD_CARD_WIDTH = 12

export const DASHBOARD_COLUMN_COUNT = 12
export const DASHBOARD_GRID_GAP = 16
export const DASHBOARD_DESKTOP_MIN_WIDTH = 1024
export const DASHBOARD_FALLBACK_CARD_HEIGHT = 240

export const MIN_DASHBOARD_CARD_HEIGHT = 160
export const MAX_DASHBOARD_CARD_HEIGHT = 1600
export const DASHBOARD_CARD_HEIGHT_STEP = 16

export interface DashboardLayout {
  order: DashboardCardId[]
  hidden: DashboardCardId[]
  widths: Record<DashboardCardId, DashboardCardWidth>
  heights: Record<DashboardCardId, DashboardCardHeight>
}

const STORAGE_KEY = "aces-dashboard-layout"

const DEFAULT_WIDTHS: Record<DashboardCardId, DashboardCardWidth> = {
  cashflow: MAX_DASHBOARD_CARD_WIDTH,
  weather: 6,
  focus: 6,
  assignments: 6,
  schedule: 6,
}

const DEFAULT_HEIGHTS: Record<DashboardCardId, DashboardCardHeight> = {
  cashflow: null,
  weather: null,
  focus: null,
  assignments: null,
  schedule: null,
}

function createDefaultLayout(): DashboardLayout {
  return {
    order: [...DASHBOARD_CARD_IDS],
    hidden: [],
    widths: { ...DEFAULT_WIDTHS },
    heights: { ...DEFAULT_HEIGHTS },
  }
}

export function isDashboardCardId(value: unknown): value is DashboardCardId {
  return typeof value === "string" && DASHBOARD_CARD_IDS.includes(value as DashboardCardId)
}

function normalizeCardHeight(height: number): number {
  const clamped = Math.min(MAX_DASHBOARD_CARD_HEIGHT, Math.max(MIN_DASHBOARD_CARD_HEIGHT, height))
  return Math.round(clamped / DASHBOARD_CARD_HEIGHT_STEP) * DASHBOARD_CARD_HEIGHT_STEP
}

function normalizeLayout(value: unknown): DashboardLayout {
  const defaultLayout = createDefaultLayout()

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultLayout
  }

  const candidate = value as Partial<DashboardLayout>
  const order: DashboardCardId[] = []
  const seen = new Set<DashboardCardId>()

  if (Array.isArray(candidate.order)) {
    for (const cardId of candidate.order) {
      if (isDashboardCardId(cardId) && !seen.has(cardId)) {
        order.push(cardId)
        seen.add(cardId)
      }
    }
  }

  for (const cardId of DASHBOARD_CARD_IDS) {
    if (!seen.has(cardId)) {
      order.push(cardId)
    }
  }

  const hidden: DashboardCardId[] = []
  const hiddenSet = new Set<DashboardCardId>()
  if (Array.isArray(candidate.hidden)) {
    for (const cardId of candidate.hidden) {
      if (isDashboardCardId(cardId) && !hiddenSet.has(cardId)) {
        hidden.push(cardId)
        hiddenSet.add(cardId)
      }
    }
  }

  const widths = { ...DEFAULT_WIDTHS }
  const heights = { ...DEFAULT_HEIGHTS }
  const rawLayout = value as Record<string, unknown>
  if (rawLayout.widths && typeof rawLayout.widths === "object") {
    const storedWidths = rawLayout.widths as Record<string, unknown>
    for (const cardId of DASHBOARD_CARD_IDS) {
      const width = storedWidths[cardId]
      if (width === "full") {
        widths[cardId] = MAX_DASHBOARD_CARD_WIDTH
      } else if (width === "half") {
        widths[cardId] = 6
      } else if (typeof width === "number" && Number.isFinite(width)) {
        widths[cardId] = Math.min(
          MAX_DASHBOARD_CARD_WIDTH,
          Math.max(MIN_DASHBOARD_CARD_WIDTH, Math.round(width)),
        )
      }
    }
  }

  if (rawLayout.heights && typeof rawLayout.heights === "object") {
    const storedHeights = rawLayout.heights as Record<string, unknown>
    for (const cardId of DASHBOARD_CARD_IDS) {
      const height = storedHeights[cardId]
      if (typeof height === "number" && Number.isFinite(height)) {
        heights[cardId] = normalizeCardHeight(height)
      }
    }
  }

  return { order, hidden, widths, heights }
}

function loadLayout(): DashboardLayout {
  if (typeof window === "undefined") return createDefaultLayout()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeLayout(JSON.parse(stored)) : createDefaultLayout()
  } catch {
    return createDefaultLayout()
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // Local storage can be unavailable in restricted browser contexts.
    }
  }, [layout])

  const moveCard = useCallback((sourceId: DashboardCardId, targetId: DashboardCardId) => {
    if (sourceId === targetId) return

    setLayout((current) => {
      if (!current.order.includes(sourceId) || !current.order.includes(targetId)) return current

      const order = [...current.order]
      const sourceIndex = order.indexOf(sourceId)
      const targetIndex = order.indexOf(targetId)
      order.splice(sourceIndex, 1)
      order.splice(targetIndex, 0, sourceId)
      return { ...current, order }
    })
  }, [])

  const setCardHeight = useCallback((cardId: DashboardCardId, height: number | null) => {
    setLayout((current) => ({
      ...current,
      heights: {
        ...current.heights,
        [cardId]: height === null ? null : normalizeCardHeight(height),
      },
    }))
  }, [])

  const toggleCardVisibility = useCallback((cardId: DashboardCardId) => {
    setLayout((current) => {
      const isHidden = current.hidden.includes(cardId)
      return {
        ...current,
        hidden: isHidden
          ? current.hidden.filter((hiddenId) => hiddenId !== cardId)
          : [...current.hidden, cardId],
      }
    })
  }, [])

  const setCardWidth = useCallback((cardId: DashboardCardId, width: number) => {
    setLayout((current) => ({
      ...current,
      widths: {
        ...current.widths,
        [cardId]: Math.min(
          MAX_DASHBOARD_CARD_WIDTH,
          Math.max(MIN_DASHBOARD_CARD_WIDTH, Math.round(width)),
        ),
      },
    }))
  }, [])

  const toggleCardWidth = useCallback((cardId: DashboardCardId) => {
    setLayout((current) => ({
      ...current,
      widths: {
        ...current.widths,
        [cardId]: current.widths[cardId] >= MAX_DASHBOARD_CARD_WIDTH ? 6 : MAX_DASHBOARD_CARD_WIDTH,
      },
    }))
  }, [])

  const resetLayout = useCallback(() => {
    setLayout(createDefaultLayout())
  }, [])

  const visibleOrder = useMemo(
    () => layout.order.filter((cardId) => !layout.hidden.includes(cardId)),
    [layout.hidden, layout.order],
  )

  return {
    layout,
    visibleOrder,
    moveCard,
    setCardWidth,
    setCardHeight,
    toggleCardVisibility,
    toggleCardWidth,
    resetLayout,
  }
}
