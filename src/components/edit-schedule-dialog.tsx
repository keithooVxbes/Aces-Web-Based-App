import type { ScheduleClass } from "@/lib/schedule-data"
import { ScheduleClassDialog } from "@/components/schedule-class-dialog"

interface EditScheduleDialogProps {
  classToEdit: ScheduleClass | null
  onClose: () => void
}

export function EditScheduleDialog({ classToEdit, onClose }: EditScheduleDialogProps) {
  return (
    <ScheduleClassDialog
      classToEdit={classToEdit}
      open={Boolean(classToEdit)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    />
  )
}
