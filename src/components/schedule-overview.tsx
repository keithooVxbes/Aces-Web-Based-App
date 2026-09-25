import { useMemo } from "react"
import { Calendar, Clock3, MapPin } from "lucide-react"

import { useSchedule } from "@/lib/schedule-store"
import {
  formatTime,
  getCurrentDay,
  scheduleThemeClasses,
  type ScheduleClass,
} from "@/lib/schedule-data"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function ScheduleOverview() {
  const { classes } = useSchedule()
  const currentDay = getCurrentDay()

  const todaysClasses = useMemo(() => {
    if (!currentDay) return []
    return classes
      .filter((scheduleClass) => scheduleClass.day === currentDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [classes, currentDay])

  return (
    <Card className="motion-card flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Calendar />
            Today&apos;s schedule
          </span>
          {currentDay ? <Badge variant="secondary">{currentDay}</Badge> : <Badge variant="outline">Weekend</Badge>}
        </CardTitle>
        <CardDescription>
          {currentDay ? "Your classes for today." : "No weekday classes on weekends."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {todaysClasses.length === 0 ? (
          <Empty className="min-h-48 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calendar />
              </EmptyMedia>
              <EmptyTitle>{currentDay ? "No classes today" : "Enjoy your day"}</EmptyTitle>
              <EmptyDescription>
                {currentDay ? "Your schedule is clear for today." : "Your recurring week starts on Monday."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : (
          <div className="motion-list flex flex-col gap-3">
            {todaysClasses.map((scheduleClass) => (
              <OverviewClass key={scheduleClass.id} scheduleClass={scheduleClass} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OverviewClass({ scheduleClass }: { scheduleClass: ScheduleClass }) {
  return (
    <div className={cn("motion-card flex flex-col gap-2 rounded-lg border p-3", scheduleThemeClasses[scheduleClass.colorTheme])}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-tight">{scheduleClass.name}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-background/50 px-1.5 py-1 text-xs font-medium">
          <Clock3 className="size-3" data-icon="inline-start" />
          {formatTime(scheduleClass.startTime)} – {formatTime(scheduleClass.endTime)}
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium opacity-80">
        <MapPin className="size-3" data-icon="inline-start" />
        <span className="truncate">{scheduleClass.room}</span>
      </div>
    </div>
  )
}
