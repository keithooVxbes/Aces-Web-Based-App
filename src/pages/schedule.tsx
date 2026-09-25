import { useMemo } from "react"
import { CalendarDays, Clock3, Sparkles } from "lucide-react"

import { AddScheduleDialog } from "@/components/add-schedule-dialog"
import { ScheduleGrid } from "@/components/schedule-grid"
import { Card, CardContent } from "@/components/ui/card"
import { useSchedule } from "@/lib/schedule-store"
import { daysOfWeek, formatDuration, timeToMinutes } from "@/lib/schedule-data"

export default function SchedulePage() {
  const { classes } = useSchedule()
  const stats = useMemo(() => {
    const totalMinutes = classes.reduce((total, scheduleClass) => {
      const start = timeToMinutes(scheduleClass.startTime)
      const end = timeToMinutes(scheduleClass.endTime)
      return total + Math.max(0, end - start)
    }, 0)
    const busiestDay = daysOfWeek.reduce((busiest, day) => {
      const dayCount = classes.filter((scheduleClass) => scheduleClass.day === day).length
      return dayCount > busiest.count ? { day, count: dayCount } : busiest
    }, { day: null as string | null, count: 0 })
    return { totalMinutes, busiestDay }
  }, [classes])

  return (
    <div className="motion-stagger flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Weekly schedule</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Keep recurring classes in one calm, readable week. Add details once, then use your schedule every day.
          </p>
        </div>
        <AddScheduleDialog />
      </div>

      <div className="motion-stagger grid gap-3 sm:grid-cols-3">
        <Card size="sm" className="motion-card">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Classes this week</p>
              <p className="mt-0.5 text-xl font-semibold tracking-tight">{classes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="motion-card">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock3 />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Scheduled time</p>
              <p className="mt-0.5 text-xl font-semibold tracking-tight">{formatDuration(stats.totalMinutes)}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm" className="motion-card">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Busiest day</p>
              <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">
                {stats.busiestDay.day ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ScheduleGrid />
    </div>
  )
}
