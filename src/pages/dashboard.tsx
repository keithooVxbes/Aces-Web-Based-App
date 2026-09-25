import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import { WeatherCard } from "@/components/weather-card"
import { FocusTimer } from "@/components/focus-timer"
import { AssignmentOverview } from "@/components/assignment-overview"
import { ScheduleOverview } from "@/components/schedule-overview"
import { CashflowOverview } from "@/components/cashflow-overview"
import { Button } from "@/components/ui/button"
import {
  Check,
  Eye,
  EyeOff,
  GripVertical,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  MoveHorizontal,
  MoveVertical,
  RotateCcw,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DASHBOARD_CARD_HEIGHT_STEP,
  DASHBOARD_CARD_IDS,
  DASHBOARD_COLUMN_COUNT,
  DASHBOARD_DESKTOP_MIN_WIDTH,
  DASHBOARD_FALLBACK_CARD_HEIGHT,
  DASHBOARD_GRID_GAP,
  isDashboardCardId,
  MAX_DASHBOARD_CARD_HEIGHT,
  MAX_DASHBOARD_CARD_WIDTH,
  MIN_DASHBOARD_CARD_HEIGHT,
  MIN_DASHBOARD_CARD_WIDTH,
  useDashboardLayout,
  type DashboardCardHeight,
  type DashboardCardId,
  type DashboardCardWidth,
} from "@/lib/dashboard-layout"

const DASHBOARD_CARD_LABELS: Record<DashboardCardId, string> = {
  cashflow: "Cashflow",
  weather: "Weather",
  focus: "Focus Timer",
  assignments: "Assignments",
  schedule: "Schedule",
}

type CardResizeAxis = "x" | "y"

interface DashboardCardBox {
  x: number
  y: number
  width: number
  height: number
}

function findLeftmostX(
  placed: DashboardCardBox[],
  y: number,
  width: number,
  height: number,
  containerWidth: number,
): number | null {
  const blockers = placed.filter((rect) => rect.y < y + height && rect.y + rect.height > y)
  const candidates = new Set<number>([0, ...blockers.map((rect) => rect.x + rect.width + DASHBOARD_GRID_GAP)])
  const sorted = [...candidates].sort((a, b) => a - b)

  for (const x of sorted) {
    if (x + width > containerWidth + 0.01) continue
    const collides = blockers.some((rect) => x < rect.x + rect.width && x + width > rect.x)
    if (!collides) return x
  }

  return null
}

function layoutDashboardCards(
  order: DashboardCardId[],
  containerWidth: number,
  isDesktop: boolean,
  widths: Record<DashboardCardId, DashboardCardWidth>,
  heights: Record<DashboardCardId, DashboardCardHeight>,
  contentHeights: Partial<Record<DashboardCardId, number>>,
  chromeHeight: number,
): { boxes: Partial<Record<DashboardCardId, DashboardCardBox>>; totalHeight: number } {
  const boxes: Partial<Record<DashboardCardId, DashboardCardBox>> = {}
  if (containerWidth <= 0) return { boxes, totalHeight: 0 }

  const columnWidth = isDesktop
    ? (containerWidth - DASHBOARD_GRID_GAP * (DASHBOARD_COLUMN_COUNT - 1)) / DASHBOARD_COLUMN_COUNT
    : containerWidth

  const placed: DashboardCardBox[] = []
  let totalHeight = 0

  for (const cardId of order) {
    const span = isDesktop
      ? Math.min(DASHBOARD_COLUMN_COUNT, Math.max(1, Math.round(widths[cardId])))
      : 1
    const width = isDesktop
      ? Math.min(containerWidth, span * columnWidth + DASHBOARD_GRID_GAP * (span - 1))
      : containerWidth
    const storedHeight = heights[cardId]
    const height =
      (storedHeight ?? contentHeights[cardId] ?? DASHBOARD_FALLBACK_CARD_HEIGHT) + chromeHeight

    const candidateYs = new Set<number>([0])
    for (const rect of placed) candidateYs.add(rect.y + rect.height + DASHBOARD_GRID_GAP)
    const sortedYs = [...candidateYs].sort((a, b) => a - b)

    let x = 0
    let y = 0
    let placedOk = false
    for (const candidateY of sortedYs) {
      const candidateX = findLeftmostX(placed, candidateY, width, height, containerWidth)
      if (candidateX !== null) {
        x = candidateX
        y = candidateY
        placedOk = true
        break
      }
    }
    if (!placedOk) {
      y = sortedYs[sortedYs.length - 1] ?? 0
      x = 0
    }

    const box = { x, y, width, height }
    placed.push(box)
    boxes[cardId] = box
    totalHeight = Math.max(totalHeight, y + height)
  }

  return { boxes, totalHeight }
}

interface CardResizeState {
  cardId: DashboardCardId
  axis: CardResizeAxis
  pointerId: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  columnStep: number
}

function renderDashboardCard(cardId: DashboardCardId): ReactNode {
  switch (cardId) {
    case "cashflow":
      return <CashflowOverview />
    case "weather":
      return <WeatherCard />
    case "focus":
      return <FocusTimer />
    case "assignments":
      return <AssignmentOverview />
    case "schedule":
      return <ScheduleOverview />
  }
}

export default function DashboardPage() {
  const [isEditing, setIsEditing] = useState(false)
  const [draggingCardId, setDraggingCardId] = useState<DashboardCardId | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<DashboardCardId | null>(null)
  const [resizingCardId, setResizingCardId] = useState<DashboardCardId | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isDesktopLayout, setIsDesktopLayout] = useState(true)
  const [contentHeights, setContentHeights] = useState<Partial<Record<DashboardCardId, number>>>({})
  const [chromeHeight, setChromeHeight] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Partial<Record<DashboardCardId, HTMLDivElement | null>>>({})
  const bodyRefs = useRef<Partial<Record<DashboardCardId, HTMLDivElement | null>>>({})
  const toolbarRefs = useRef<Partial<Record<DashboardCardId, HTMLDivElement | null>>>({})
  const resizeStateRef = useRef<CardResizeState | null>(null)
  const {
    layout,
    visibleOrder,
    moveCard,
    setCardWidth,
    setCardHeight,
    toggleCardVisibility,
    toggleCardWidth,
    resetLayout,
  } = useDashboardLayout()

  const { boxes, totalHeight } = useMemo(
    () => layoutDashboardCards(
      visibleOrder,
      containerWidth,
      isDesktopLayout,
      layout.widths,
      layout.heights,
      contentHeights,
      chromeHeight,
    ),
    [
      visibleOrder,
      containerWidth,
      isDesktopLayout,
      layout.widths,
      layout.heights,
      contentHeights,
      chromeHeight,
    ],
  )

  const measureContentHeights = useCallback(() => {
    let measuredChrome = 0

    if (isEditing) {
      for (const cardId of DASHBOARD_CARD_IDS) {
        const toolbar = toolbarRefs.current[cardId]
        const card = cardRefs.current[cardId]
        if (!toolbar || !card) continue

        const toolbarStyles = window.getComputedStyle(toolbar)
        const cardStyles = window.getComputedStyle(card)
        const margin = Number.parseFloat(toolbarStyles.marginBottom) || 0
        const padding = Number.parseFloat(cardStyles.paddingTop) + Number.parseFloat(cardStyles.paddingBottom)
        const border =
          Number.parseFloat(cardStyles.borderTopWidth) + Number.parseFloat(cardStyles.borderBottomWidth)
        measuredChrome = Math.max(measuredChrome, toolbar.offsetHeight + margin + padding + border)
      }
    }

    setChromeHeight((current) => (Math.abs(current - measuredChrome) < 0.5 ? current : measuredChrome))

    setContentHeights((current) => {
      let changed = false
      const next: Partial<Record<DashboardCardId, number>> = { ...current }

      for (const cardId of DASHBOARD_CARD_IDS) {
        if (layout.heights[cardId] !== null) continue
        const body = bodyRefs.current[cardId]
        const measured = body?.getBoundingClientRect().height ?? 0
        if (measured <= 0) continue
        if (Math.abs((next[cardId] ?? 0) - measured) > 0.5) {
          next[cardId] = measured
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [isEditing, layout.heights])

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    setContainerWidth(grid.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth((current) => (Math.abs(current - width) < 0.5 ? current : width))
    })
    observer.observe(grid)

    // Must mirror the `lg` breakpoint used to show the width handle, otherwise the handle
    // is visible while every card is pinned to full width and resizing does nothing.
    const desktopQuery = window.matchMedia(`(min-width: ${DASHBOARD_DESKTOP_MIN_WIDTH}px)`)
    const syncDesktopLayout = () => setIsDesktopLayout(desktopQuery.matches)
    syncDesktopLayout()
    desktopQuery.addEventListener("change", syncDesktopLayout)

    return () => {
      observer.disconnect()
      desktopQuery.removeEventListener("change", syncDesktopLayout)
    }
  }, [])

  useLayoutEffect(() => {
    measureContentHeights()
  }, [measureContentHeights, visibleOrder, containerWidth])

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => measureContentHeights())

    for (const cardId of visibleOrder) {
      const body = bodyRefs.current[cardId]
      if (body) observer.observe(body)
    }

    return () => observer.disconnect()
  }, [visibleOrder, measureContentHeights])

  const handleDragStart = (event: DragEvent<HTMLElement>, cardId: DashboardCardId) => {
    if (!isEditing) return

    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", cardId)
    setDraggingCardId(cardId)
  }

  const handleDragOver = (event: DragEvent<HTMLElement>, cardId: DashboardCardId) => {
    if (!isEditing || !draggingCardId || draggingCardId === cardId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverCardId(cardId)
  }

  const handleDrop = (event: DragEvent<HTMLElement>, targetId: DashboardCardId) => {
    event.preventDefault()

    const sourceId = draggingCardId ?? event.dataTransfer.getData("text/plain")
    if (isDashboardCardId(sourceId) && sourceId !== targetId) {
      moveCard(sourceId, targetId)
    }

    setDraggingCardId(null)
    setDragOverCardId(null)
  }

  const handleDragEnd = () => {
    setDraggingCardId(null)
    setDragOverCardId(null)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cardId: DashboardCardId) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return

    event.preventDefault()
    const currentIndex = visibleOrder.indexOf(cardId)
    const targetIndex = currentIndex + (event.key === "ArrowUp" ? -1 : 1)
    const targetId = visibleOrder[targetIndex]
    if (targetId) moveCard(cardId, targetId)
  }

  const handleCardHeightKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    cardId: DashboardCardId,
  ) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return

    event.preventDefault()
    const body = bodyRefs.current[cardId]
    const currentHeight = layout.heights[cardId] ?? body?.getBoundingClientRect().height
    if (currentHeight === undefined || currentHeight === null) return

    const delta = event.key === "ArrowDown" ? DASHBOARD_CARD_HEIGHT_STEP : -DASHBOARD_CARD_HEIGHT_STEP
    setCardHeight(cardId, currentHeight + delta)
  }

  const startCardResize = (
    event: PointerEvent<HTMLButtonElement>,
    cardId: DashboardCardId,
    axis: CardResizeAxis,
  ) => {
    if (event.button !== 0) return

    const grid = gridRef.current
    const card = cardRefs.current[cardId]
    if (!grid || !card) return

    event.preventDefault()
    event.stopPropagation()

    const startWidth = layout.widths[cardId]
    const cardRect = card.getBoundingClientRect()
    const bodyRect = bodyRefs.current[cardId]?.getBoundingClientRect()
    const columnStep = Math.max(1, (cardRect.width + DASHBOARD_GRID_GAP) / startWidth)

    resizeStateRef.current = {
      cardId,
      axis,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth,
      startHeight: bodyRect?.height ?? cardRect.height,
      columnStep,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizingCardId(cardId)
  }

  const handleResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId) return

    event.preventDefault()

    if (resizeState.axis === "x") {
      const columnDelta = Math.round((event.clientX - resizeState.startX) / resizeState.columnStep)
      const nextWidth = Math.min(
        MAX_DASHBOARD_CARD_WIDTH,
        Math.max(MIN_DASHBOARD_CARD_WIDTH, resizeState.startWidth + columnDelta),
      )
      setCardWidth(resizeState.cardId, nextWidth)
      return
    }

    const rawHeight = resizeState.startHeight + (event.clientY - resizeState.startY)
    const snappedHeight = Math.round(rawHeight / DASHBOARD_CARD_HEIGHT_STEP) * DASHBOARD_CARD_HEIGHT_STEP
    const nextHeight = Math.min(
      MAX_DASHBOARD_CARD_HEIGHT,
      Math.max(MIN_DASHBOARD_CARD_HEIGHT, snappedHeight),
    )
    setCardHeight(resizeState.cardId, nextHeight)
  }

  const handleResizePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const resizeState = resizeStateRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    resizeStateRef.current = null
    setResizingCardId(null)
  }

  return (
    <div className="motion-stagger flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LayoutDashboard className="size-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Your personal overview at a glance.
          </p>
        </div>

        <Button
          type="button"
          variant={isEditing ? "default" : "outline"}
          onClick={() => setIsEditing((current) => !current)}
          aria-pressed={isEditing}
        >
          {isEditing ? <Check data-icon="inline-start" /> : <Settings2 data-icon="inline-start" />}
          {isEditing ? "Done" : "Customize"}
        </Button>
      </div>

      {isEditing && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Customize dashboard</p>
              <p className="text-xs text-muted-foreground">
                Drag cards to reorder them. Drag the side handle to change width, the bottom handle to change
                height. Shorter cards leave room for the next card to fill.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={resetLayout}>
              <RotateCcw data-icon="inline-start" />
              Reset layout
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {DASHBOARD_CARD_IDS.map((cardId) => {
              const isHidden = layout.hidden.includes(cardId)
              return (
                <Button
                  key={cardId}
                  type="button"
                  size="sm"
                  variant={isHidden ? "outline" : "secondary"}
                  onClick={() => toggleCardVisibility(cardId)}
                  aria-pressed={!isHidden}
                >
                  {isHidden ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                  {DASHBOARD_CARD_LABELS[cardId]}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {visibleOrder.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">All dashboard cards are hidden</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Customize to show cards again.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={resetLayout}>
            <RotateCcw data-icon="inline-start" />
            Show all cards
          </Button>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="dashboard-card-grid motion-stagger relative"
          style={{ height: totalHeight > 0 ? totalHeight + DASHBOARD_GRID_GAP : undefined }}
        >
          {visibleOrder.map((cardId) => {
            const isFullWidth = layout.widths[cardId] >= MAX_DASHBOARD_CARD_WIDTH
            const isDragging = draggingCardId === cardId
            const isDragTarget = dragOverCardId === cardId
            const isResizing = resizingCardId === cardId
            const height = layout.heights[cardId]
            const isSized = height !== null
            const box = boxes[cardId]
            const isMeasured = box !== undefined
            const label = DASHBOARD_CARD_LABELS[cardId]

            return (
              <div
                key={cardId}
                ref={(element) => {
                  cardRefs.current[cardId] = element
                }}
                style={{
                  left: box?.x ?? 0,
                  top: box?.y ?? 0,
                  width: box?.width,
                  height: box?.height,
                  visibility: isMeasured ? undefined : "hidden",
                }}
                className={cn(
                  "dashboard-card absolute min-w-0 transition-[left,top,width,height] duration-200 ease-out motion-reduce:transition-none",
                  isResizing && "transition-none",
                  isSized && "dashboard-card-sized",
                  isEditing && "rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-1",
                  isDragging && "opacity-60",
                  isDragTarget && "border-primary bg-primary/5 ring-2 ring-primary/30",
                  isResizing && "ring-2 ring-primary/40",
                )}
                onDragOver={(event) => handleDragOver(event, cardId)}
                onDrop={(event) => handleDrop(event, cardId)}
                onDragEnd={handleDragEnd}
              >
                {isEditing && (
                  <div
                    ref={(element) => {
                      toolbarRefs.current[cardId] = element
                    }}
                    className="mb-2 flex items-center justify-between gap-2 rounded-lg border bg-background/80 px-2 py-1"
                  >
                    <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        draggable
                        className="cursor-grab text-muted-foreground active:cursor-grabbing"
                        onDragStart={(event) => handleDragStart(event, cardId)}
                        onDragEnd={handleDragEnd}
                        onKeyDown={(event) => handleCardKeyDown(event, cardId)}
                        aria-label={`Drag ${label}`}
                        aria-keyshortcuts="ArrowUp ArrowDown"
                        title={`Drag ${label}. Use arrow keys to reorder.`}
                      >
                        <GripVertical />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleCardWidth(cardId)}
                        aria-label={isFullWidth ? `Make ${label} half width` : `Make ${label} full width`}
                        title={isFullWidth ? `Make ${label} half width` : `Make ${label} full width`}
                      >
                        {isFullWidth ? <Minimize2 /> : <Maximize2 />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleCardVisibility(cardId)}
                        aria-label={`Hide ${label}`}
                        title={`Hide ${label}`}
                      >
                        <EyeOff />
                      </Button>
                    </div>
                  </div>
                )}
                {isEditing && (
                  <>
                    <button
                      type="button"
                      className="absolute -right-1.5 top-1/2 z-20 hidden size-5 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
                      onPointerDown={(event) => startCardResize(event, cardId, "x")}
                      onPointerMove={handleResizePointerMove}
                      onPointerUp={handleResizePointerEnd}
                      onPointerCancel={handleResizePointerEnd}
                      onLostPointerCapture={handleResizePointerEnd}
                      aria-label={`Resize width of ${label}`}
                      title={`Resize width of ${label}`}
                    >
                      <MoveHorizontal className="size-3" />
                    </button>
                    <button
                      type="button"
                      className="absolute -bottom-1.5 -right-1.5 z-20 flex size-5 cursor-ns-resize touch-none items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onPointerDown={(event) => startCardResize(event, cardId, "y")}
                      onPointerMove={handleResizePointerMove}
                      onPointerUp={handleResizePointerEnd}
                      onPointerCancel={handleResizePointerEnd}
                      onLostPointerCapture={handleResizePointerEnd}
                      onDoubleClick={() => setCardHeight(cardId, null)}
                      onKeyDown={(event) => handleCardHeightKeyDown(event, cardId)}
                      aria-label={`Resize height of ${label}`}
                      aria-keyshortcuts="ArrowUp ArrowDown"
                      title={
                        isSized
                          ? `Resize height of ${label}. Double-click to auto-fit.`
                          : `Resize height of ${label}`
                      }
                    >
                      <MoveVertical className="size-3" />
                    </button>
                  </>
                )}
                <div
                  ref={(element) => {
                    bodyRefs.current[cardId] = element
                  }}
                  className="dashboard-card-body min-h-0 flex-1"
                >
                  {renderDashboardCard(cardId)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
