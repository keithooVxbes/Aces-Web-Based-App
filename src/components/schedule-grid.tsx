import { useMemo, useState } from "react"
import { CalendarDays, Clock3, MapPin, Plus } from "lucide-react"

import { useSchedule } from "@/lib/schedule-store"
import {
  buildTimeSlots,
  daysOfWeek,
  formatTime,
  getCurrentDay,
  getScheduleBounds,
  scheduleEventBackgroundClasses,
  scheduleEventClasses,
  scheduleThemeClasses,
  timeToMinutes,
  type DayOfWeek,
  type ScheduleClass,
} from "@/lib/schedule-data"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AddScheduleDialog } from "@/components/add-schedule-dialog"
import { EditScheduleDialog } from "@/components/edit-schedule-dialog"

const GRID_HEIGHT = 36 * 24
const MIN_COLUMN_WIDTH = 148

function getEventLayout(
  scheduleClasses: ScheduleClass[],
  startMinutes: number,
  endMinutes: number,
) {
  const totalMinutes = endMinutes - startMinutes
  const sorted = [...scheduleClasses].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.name.localeCompare(b.name),
  )

  return sorted.map((scheduleClass, index) => {
    const rawStart = timeToMinutes(scheduleClass.startTime)
    const rawEnd = timeToMinutes(scheduleClass.endTime)
    const start = Math.max(startMinutes, Math.min(rawStart, endMinutes))
    const end = Math.max(start + 15, Math.min(rawEnd, endMinutes))
    const top = ((start - startMinutes) / totalMinutes) * 100
    const height = Math.max(((end - start) / totalMinutes) * 100, 4)

      const overlapping = sorted.filter(
      (candidate) =>
        candidate.id !== scheduleClass.id &&
        timeToMinutes(candidate.startTime) < rawEnd &&
        timeToMinutes(candidate.endTime) > rawStart,
    )
    const overlappingIndex = sorted
      .slice(0, index)
      .filter(
        (candidate) =>
          timeToMinutes(candidate.startTime) < rawEnd &&
          timeToMinutes(candidate.endTime) > rawStart,
      ).length
    const column = Math.max(0, overlappingIndex)
    const columns = Math.max(1, overlapping.length + 1)
    const width = 100 / columns
    const left = column * width

    return {
      scheduleClass,
      top,
      height,
      left,
      width,
      index,
    }
  })
}

function ScheduleEvent({
  scheduleClass,
  top,
  height,
  left,
  width,
  onOpen,
}: {
  scheduleClass: ScheduleClass
  top: number
  height: number
  left: number
  width: number
  onOpen: () => void
}) {
  const eventTheme = scheduleEventClasses[scheduleClass.colorTheme]
  const eventBackground = scheduleEventBackgroundClasses[scheduleClass.colorTheme]
  const compact = height < 11

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "motion-event group/event absolute z-10 flex min-h-12 flex-col overflow-hidden rounded-lg border bg-card p-2 text-left shadow-sm transition-[transform,box-shadow,background-color] active:translate-y-px active:scale-[0.98] hover:z-20 hover:shadow-md focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            eventTheme,
          )}
          style={{
            top: `${top}%`,
            height: `${height}%`,
            left: `${left}%`,
            width: `calc(${width}% - 4px)`,
          }}
          onClick={onOpen}
          onContextMenu={(event) => {
            event.preventDefault()
            onOpen()
          }}
          aria-label={`${scheduleClass.name}, ${scheduleClass.startTime} to ${scheduleClass.endTime}, ${scheduleClass.room}`}
        >
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute inset-0 rounded-lg", eventBackground)}
          />
          <span className="relative line-clamp-2 text-xs font-semibold leading-tight tracking-tight">
            {scheduleClass.name}
          </span>
          {!compact ? (
            <>
              <span className="relative mt-1 flex items-center gap-1 truncate text-[10px] font-medium opacity-80">
                <Clock3 className="size-3" data-icon="inline-start" />
                <span className="truncate">
                  {formatTime(scheduleClass.startTime)} – {formatTime(scheduleClass.endTime)}
                </span>
              </span>
              <span className="relative mt-auto flex items-center gap-1 truncate text-[10px] font-medium opacity-80">
                <MapPin className="size-3" data-icon="inline-start" />
                <span className="truncate">{scheduleClass.room}</span>
              </span>
            </>
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span className="font-medium">{scheduleClass.name}</span>
        <span>{formatTime(scheduleClass.startTime)} – {formatTime(scheduleClass.endTime)}</span>
        <span>{scheduleClass.room}</span>
      </TooltipContent>
    </Tooltip>
  )
}

function ScheduleAgenda({
  classesByDay,
  onOpenClass,
}: {
  classesByDay: Record<DayOfWeek, ScheduleClass[]>
  onOpenClass: (scheduleClass: ScheduleClass) => void
}) {
  return (
    <div className="motion-list flex flex-col gap-3">
      {daysOfWeek.map((day) => {
        const dayClasses = classesByDay[day]
        return (
          <Card key={day} size="sm" className="motion-card overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-4 py-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{day}</span>
                <Badge variant="outline" className="font-normal">
                  {dayClasses.length} {dayClasses.length === 1 ? "class" : "classes"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-3">
              {dayClasses.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No classes scheduled.</p>
              ) : (
                dayClasses.map((scheduleClass) => (
                  <button
                    key={scheduleClass.id}
                    type="button"
                    className={cn(
                      "motion-card motion-event flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors active:translate-y-px active:scale-[0.98] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      scheduleThemeClasses[scheduleClass.colorTheme],
                    )}
                    onClick={() => onOpenClass(scheduleClass)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{scheduleClass.name}</p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs opacity-80">
                        <MapPin className="size-3" data-icon="inline-start" />
                        <span className="truncate">{scheduleClass.room}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs font-medium opacity-80">
                      <p>{formatTime(scheduleClass.startTime)}</p>
                      <p className="mt-0.5">to {formatTime(scheduleClass.endTime)}</p>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function ScheduleGrid() {
  const { classes } = useSchedule()
  const [editingClass, setEditingClass] = useState<ScheduleClass | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const bounds = useMemo(() => getScheduleBounds(classes), [classes])
  const slots = useMemo(
    () => buildTimeSlots(bounds.startMinutes, bounds.endMinutes),
    [bounds.endMinutes, bounds.startMinutes],
  )
  const currentDay = getCurrentDay()

  const classesByDay = useMemo(() => {
    const grouped = {} as Record<DayOfWeek, ScheduleClass[]>
    daysOfWeek.forEach((day) => {
      grouped[day] = []
    })
    classes.forEach((scheduleClass) => {
      grouped[scheduleClass.day].push(scheduleClass)
    })
    return grouped
  }, [classes])

  const openClass = (scheduleClass: ScheduleClass) => setEditingClass(scheduleClass)
  const openAdd = () => setAddOpen(true)

  if (classes.length === 0) {
    return (
      <>
        <Card className="motion-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays />
              Weekly schedule
            </CardTitle>
            <CardDescription>Build recurring week around classes that matter.</CardDescription>
          </CardHeader>
          <CardContent>
            <Empty className="min-h-72 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>No classes yet</EmptyTitle>
                <EmptyDescription>
                  Add your first recurring class to see your week at a glance.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" onClick={openAdd}>
                  <Plus data-icon="inline-start" />
                  Add first class
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
        <AddScheduleDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          title="Add first class"
          showTrigger={false}
        />
        <EditScheduleDialog classToEdit={editingClass} onClose={() => setEditingClass(null)} />
      </>
    )
  }

  return (
    <>
      <Card className="motion-card min-w-0 overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays />
                Weekly schedule
              </CardTitle>
              <CardDescription className="mt-1">
                Click a class to edit. Right-click for quick access.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentDay ? <Badge variant="secondary">Today: {currentDay}</Badge> : null}
              <Badge variant="outline">{classes.length} classes</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <ScrollArea orientation="both" className="h-[min(72vh,760px)] min-h-[560px] w-full">
              <div className="min-w-[calc(4.5rem+5*var(--schedule-column-width))]" style={{ "--schedule-column-width": `${MIN_COLUMN_WIDTH}px` } as React.CSSProperties}>
                <div className="sticky top-0 z-30 grid grid-cols-[4.5rem_repeat(5,minmax(var(--schedule-column-width),1fr))] border-b bg-card/95 backdrop-blur">
                  <div className="sticky left-0 z-40 flex items-end border-r bg-card/95 px-3 py-3 text-xs font-medium text-muted-foreground">
                    Time
                  </div>
                  {daysOfWeek.map((day) => (
                    <div
                      key={day}
                      className="border-r px-3 py-3 text-center last:border-r-0"
                    >
                      <p className="text-sm font-semibold">{day}</p>
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                        {classesByDay[day].length} {classesByDay[day].length === 1 ? "class" : "classes"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[4.5rem_repeat(5,minmax(var(--schedule-column-width),1fr))]">
                  <div className="sticky left-0 z-20 border-r bg-card/95">
                    <div className="relative" style={{ height: GRID_HEIGHT }}>
                      {slots.slice(0, -1).map((time, index) => (
                        <span
                          key={time}
                          className={cn(
                            "absolute right-3 text-[11px] font-medium tabular-nums text-muted-foreground",
                            index === 0 ? "translate-y-0" : "-translate-y-1/2",
                          )}
                          style={{ top: `${(index / (slots.length - 1)) * 100}%` }}
                        >
                          {formatTime(time)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {daysOfWeek.map((day) => {
                    const dayLayouts = getEventLayout(classesByDay[day], bounds.startMinutes, bounds.endMinutes)
                    return (
                      <div
                        key={day}
                        className="relative border-r border-border/40 last:border-r-0"
                        style={{ height: GRID_HEIGHT }}
                      >
                        {slots.slice(0, -1).map((time, index) => (
                          <div
                            key={time}
                            className="pointer-events-none absolute inset-x-0 border-t border-border/40"
                            style={{ top: `${(index / (slots.length - 1)) * 100}%` }}
                          />
                        ))}
                        {dayLayouts.map((layout) => (
                          <ScheduleEvent
                            key={layout.scheduleClass.id}
                            scheduleClass={layout.scheduleClass}
                            top={layout.top}
                            height={layout.height}
                            left={layout.left}
                            width={layout.width}
                            onOpen={() => openClass(layout.scheduleClass)}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>

          <div className="p-3 md:hidden">
            <ScheduleAgenda classesByDay={classesByDay} onOpenClass={openClass} />
          </div>
        </CardContent>
      </Card>

      <AddScheduleDialog open={addOpen} onOpenChange={setAddOpen} showTrigger={false} />
      <EditScheduleDialog classToEdit={editingClass} onClose={() => setEditingClass(null)} />
    </>
  )
}
