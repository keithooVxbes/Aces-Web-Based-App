import { useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import { Trash2 } from "lucide-react"

import { useSchedule } from "@/lib/schedule-store"
import {
  daysOfWeek,
  formatDuration,
  scheduleThemeDotClasses,
  timeToMinutes,
  type DayOfWeek,
  type ScheduleClass,
  type ScheduleColorTheme,
} from "@/lib/schedule-data"
import { cn } from "@/lib/utils"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const colorOptions: Array<{ value: ScheduleColorTheme; label: string }> = [
  { value: "default", label: "Neutral" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
  { value: "teal", label: "Teal" },
]

type FormState = Omit<ScheduleClass, "id">

const initialFormState: FormState = {
  name: "",
  room: "",
  day: "Monday",
  startTime: "08:00",
  endTime: "10:00",
  colorTheme: "default",
}

interface ScheduleClassDialogProps {
  children?: ReactNode
  classToEdit?: ScheduleClass | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  onDelete?: (id: string) => void
  onSuccess?: () => void
  title?: string
}

export function ScheduleClassDialog({
  children,
  classToEdit = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onDelete,
  onSuccess,
  title,
}: ScheduleClassDialogProps) {
  const { addClass, updateClass, removeClass } = useSchedule()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const [form, setForm] = useState<FormState>(initialFormState)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isEditing = Boolean(classToEdit)

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    controlledOnOpenChange?.(nextOpen)
  }

  useEffect(() => {
    if (!open) return

    if (classToEdit) {
      setForm({
        name: classToEdit.name,
        room: classToEdit.room,
        day: classToEdit.day,
        startTime: classToEdit.startTime,
        endTime: classToEdit.endTime,
        colorTheme: classToEdit.colorTheme,
      })
    } else {
      setForm(initialFormState)
    }
    setErrors({})
    setDeleteOpen(false)
  }, [classToEdit, open])

  const duration = useMemo(() => {
    const start = timeToMinutes(form.startTime)
    const end = timeToMinutes(form.endTime)
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0
  }, [form.endTime, form.startTime])

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {}
    const start = timeToMinutes(form.startTime)
    const end = timeToMinutes(form.endTime)

    if (!form.name.trim()) nextErrors.name = "Enter a class name."
    if (!form.room.trim()) nextErrors.room = "Enter a room or location."
    if (!Number.isFinite(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime)) {
      nextErrors.startTime = "Use a valid 24-hour time."
    }
    if (!Number.isFinite(end) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.endTime)) {
      nextErrors.endTime = "Use a valid 24-hour time."
    }
    if (!nextErrors.startTime && !nextErrors.endTime && end <= start) {
      nextErrors.endTime = "End time must be after start time."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    const values = {
      ...form,
      name: form.name.trim(),
      room: form.room.trim(),
    }

    setIsSubmitting(true)
    try {
      if (classToEdit) {
        await updateClass(classToEdit.id, values)
      } else {
        await addClass(values)
      }
      onSuccess?.()
      setOpen(false)
    } catch (err: any) {
      // For now we'll just log and let the store or UI handle it, 
      // but ideally we show the specific overlap error on the form.
      setErrors((prev) => ({ ...prev, name: err.message || "Something went wrong" }))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!classToEdit) return
    setIsSubmitting(true)
    try {
      await removeClass(classToEdit.id)
      onDelete?.(classToEdit.id)
      setDeleteOpen(false)
      setOpen(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const triggerContent = trigger ?? children

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {triggerContent ? <DialogTrigger asChild>{triggerContent}</DialogTrigger> : null}
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-0">
            <DialogHeader>
              <DialogTitle>{title ?? (isEditing ? "Edit class" : "Add class")}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update class details or remove it from your recurring week."
                  : "Add a class to your recurring weekly schedule."}
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-5">
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="schedule-class-name">Class name</FieldLabel>
                <Input
                  id="schedule-class-name"
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  placeholder="e.g. Data Structures"
                  autoComplete="off"
                />
                {errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(errors.room)}>
                <FieldLabel htmlFor="schedule-class-room">Room or location</FieldLabel>
                <Input
                  id="schedule-class-room"
                  value={form.room}
                  onChange={(event) => setField("room", event.target.value)}
                  aria-invalid={Boolean(errors.room)}
                  placeholder="e.g. Science Hall 204"
                  autoComplete="off"
                />
                {errors.room ? <FieldError>{errors.room}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="schedule-class-day">Day</FieldLabel>
                <Select value={form.day} onValueChange={(value) => setField("day", value as DayOfWeek)}>
                  <SelectTrigger id="schedule-class-day" className="w-full">
                    <SelectValue placeholder="Choose a day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.startTime)}>
                  <FieldLabel htmlFor="schedule-class-start">Starts</FieldLabel>
                  <Input
                    id="schedule-class-start"
                    type="time"
                    step={1800}
                    value={form.startTime}
                    onChange={(event) => setField("startTime", event.target.value)}
                    aria-invalid={Boolean(errors.startTime)}
                  />
                  {errors.startTime ? <FieldError>{errors.startTime}</FieldError> : null}
                </Field>

                <Field data-invalid={Boolean(errors.endTime)}>
                  <FieldLabel htmlFor="schedule-class-end">Ends</FieldLabel>
                  <Input
                    id="schedule-class-end"
                    type="time"
                    step={1800}
                    value={form.endTime}
                    onChange={(event) => setField("endTime", event.target.value)}
                    aria-invalid={Boolean(errors.endTime)}
                  />
                  {duration > 0 ? <FieldDescription>{formatDuration(duration)}</FieldDescription> : null}
                  {errors.endTime ? <FieldError>{errors.endTime}</FieldError> : null}
                </Field>
              </div>

              <Field>
                <FieldLabel>Color</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={form.colorTheme}
                  onValueChange={(value) => value && setField("colorTheme", value as ScheduleColorTheme)}
                  className="flex w-full flex-wrap justify-start"
                  spacing={1}
                >
                  {colorOptions.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      aria-label={option.label}
                      className={cn(
                        "size-7 rounded-full border-2 border-border bg-background p-1 transition-transform hover:scale-105 data-[state=on]:!bg-background",
                        form.colorTheme === option.value && "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                    >
                      <span className={cn("size-full rounded-full", scheduleThemeDotClasses[option.value])} />
                      <span className="sr-only">{option.label}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldDescription>Use color to scan your week quickly.</FieldDescription>
              </Field>
            </FieldGroup>

            <DialogFooter className={cn(isEditing && "sm:justify-between")}>
              {isEditing ? (
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={isSubmitting}>
                  <Trash2 data-icon="inline-start" />
                  Delete class
                </Button>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>{isEditing ? "Save changes" : "Add class"}</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this class?</AlertDialogTitle>
            <AlertDialogDescription>
              “{classToEdit?.name}” will be removed from your weekly schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Keep class</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              Delete class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
