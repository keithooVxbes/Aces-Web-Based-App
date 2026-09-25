import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScheduleClassDialog } from "@/components/schedule-class-dialog"

interface AddScheduleDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  showTrigger?: boolean
}

export function AddScheduleDialog({ open, onOpenChange, title, showTrigger = true }: AddScheduleDialogProps) {
  return (
    <ScheduleClassDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      trigger={
        showTrigger ? (
          <Button size="sm">
            <Plus data-icon="inline-start" />
            Add class
          </Button>
        ) : undefined
      }
    />
  )
}
