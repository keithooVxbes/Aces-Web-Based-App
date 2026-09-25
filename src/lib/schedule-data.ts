export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday"

export type ScheduleColorTheme =
  | "green"
  | "red"
  | "blue"
  | "teal"
  | "purple"
  | "yellow"
  | "default"

export interface ScheduleClass {
  id: string
  name: string
  room: string
  day: DayOfWeek
  startTime: string // HH:MM
  endTime: string // HH:MM
  colorTheme: ScheduleColorTheme
}

export const daysOfWeek: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
]

export const scheduleThemeClasses: Record<ScheduleColorTheme, string> = {
  default: "border-border bg-muted/60 text-foreground hover:bg-muted",
  green: "border-schedule-green/30 bg-schedule-green/10 text-schedule-green hover:bg-schedule-green/15",
  red: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
  blue: "border-schedule-blue/30 bg-schedule-blue/10 text-schedule-blue hover:bg-schedule-blue/15",
  teal: "border-schedule-teal/30 bg-schedule-teal/10 text-schedule-teal hover:bg-schedule-teal/15",
  purple: "border-schedule-purple/30 bg-schedule-purple/10 text-schedule-purple hover:bg-schedule-purple/15",
  yellow: "border-schedule-yellow/30 bg-schedule-yellow/10 text-schedule-yellow hover:bg-schedule-yellow/15",
}

export const scheduleThemeDotClasses: Record<ScheduleColorTheme, string> = {
  default: "bg-foreground/35",
  green: "bg-schedule-green",
  red: "bg-destructive",
  blue: "bg-schedule-blue",
  teal: "bg-schedule-teal",
  purple: "bg-schedule-purple",
  yellow: "bg-schedule-yellow",
}

export const scheduleEventClasses: Record<ScheduleColorTheme, string> = {
  default: "border-border text-foreground",
  green: "border-schedule-green/30 text-schedule-green",
  red: "border-destructive/30 text-destructive",
  blue: "border-schedule-blue/30 text-schedule-blue",
  teal: "border-schedule-teal/30 text-schedule-teal",
  purple: "border-schedule-purple/30 text-schedule-purple",
  yellow: "border-schedule-yellow/30 text-schedule-yellow",
}

export const scheduleEventBackgroundClasses: Record<ScheduleColorTheme, string> = {
  default: "bg-muted/60",
  green: "bg-schedule-green/10",
  red: "bg-destructive/10",
  blue: "bg-schedule-blue/10",
  teal: "bg-schedule-teal/10",
  purple: "bg-schedule-purple/10",
  yellow: "bg-schedule-yellow/10",
}

export const SCHEDULE_START_MINUTES = 6 * 60
export const SCHEDULE_END_MINUTES = 18 * 60
export const SCHEDULE_SLOT_MINUTES = 30

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function buildTimeSlots(
  startMinutes = SCHEDULE_START_MINUTES,
  endMinutes = SCHEDULE_END_MINUTES,
): string[] {
  const slots: string[] = []
  for (
    let current = startMinutes;
    current <= endMinutes;
    current += SCHEDULE_SLOT_MINUTES
  ) {
    slots.push(minutesToTime(current))
  }
  return slots
}

// 30-minute slots from 06:00 to 18:00.
export const timeSlots = buildTimeSlots()

export interface ScheduleBounds {
  startMinutes: number
  endMinutes: number
}

export function getScheduleBounds(
  classes: Pick<ScheduleClass, "startTime" | "endTime">[],
): ScheduleBounds {
  let startMinutes = SCHEDULE_START_MINUTES
  let endMinutes = SCHEDULE_END_MINUTES

  for (const scheduleClass of classes) {
    const classStart = timeToMinutes(scheduleClass.startTime)
    const classEnd = timeToMinutes(scheduleClass.endTime)

    if (Number.isFinite(classStart)) {
      startMinutes = Math.min(
        startMinutes,
        Math.floor(classStart / SCHEDULE_SLOT_MINUTES) * SCHEDULE_SLOT_MINUTES,
      )
    }

    if (Number.isFinite(classEnd)) {
      endMinutes = Math.max(
        endMinutes,
        Math.ceil(classEnd / SCHEDULE_SLOT_MINUTES) * SCHEDULE_SLOT_MINUTES,
      )
    }
  }

  if (endMinutes <= startMinutes) {
    endMinutes = startMinutes + 60
  }

  return { startMinutes, endMinutes }
}

export function formatTime(time: string): string {
  const totalMinutes = timeToMinutes(time)
  if (!Number.isFinite(totalMinutes)) return time

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}

export function formatDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m"

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function getCurrentDay(date = new Date()): DayOfWeek | null {
  const dayIndex = date.getDay()
  return dayIndex >= 1 && dayIndex <= 5 ? daysOfWeek[dayIndex - 1] : null
}

export const initialScheduleData: ScheduleClass[] = []
