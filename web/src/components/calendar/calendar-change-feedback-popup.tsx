import { Button } from '@fohte/ui/button'
import { Popover, PopoverContent } from '@fohte/ui/popover'

export type CalendarChangeFeedback =
  { kind: 'undo'; onUndo: () => void } | { kind: 'error' }

interface CalendarChangeFeedbackPopupProps {
  anchor: React.RefObject<Element | null>
  feedback: CalendarChangeFeedback | null
  onOpenChange: (open: boolean) => void
}

export function CalendarChangeFeedbackPopup({
  anchor,
  feedback,
  onOpenChange,
}: CalendarChangeFeedbackPopupProps) {
  return (
    <Popover
      anchor={anchor}
      open={feedback != null}
      onOpenChange={onOpenChange}
    >
      <PopoverContent
        initialFocus={false}
        padding="sm"
        className="flex items-center gap-2 text-xs whitespace-nowrap"
      >
        {feedback?.kind === 'error' ? (
          <span className="text-destructive">
            Couldn't save — reverted to the original time
          </span>
        ) : feedback?.kind === 'undo' ? (
          <>
            <span className="text-muted-foreground">Moved</span>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0"
              onClick={feedback.onUndo}
            >
              Undo
            </Button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
