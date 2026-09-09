import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Button } from '#components/ui/button'

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
    <AnchoredPopup
      open={feedback != null}
      onOpenChange={onOpenChange}
      anchor={anchor}
      initialFocus={false}
      className="flex items-center gap-2 px-3 py-1.5 text-xs whitespace-nowrap"
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
    </AnchoredPopup>
  )
}
