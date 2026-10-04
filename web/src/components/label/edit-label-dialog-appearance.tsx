import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import {
  contextLabels,
  type ContextValue,
} from '#components/task/create-task-modal-fields'
import { selectValueHandler } from '#lib/form-utils'

const contextValues = [
  'work',
  'personal',
] as const satisfies readonly ContextValue[]

export function EditLabelDialogAppearance({
  open,
  onOpenChange,
  name,
  context,
  errorMessage,
  saveDisabled,
  onNameChange,
  onContextChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  context: ContextValue
  errorMessage: string | null
  saveDisabled: boolean
  onNameChange: (name: string) => void
  onContextChange: (context: ContextValue) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tag</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
        <Select
          value={context}
          onValueChange={selectValueHandler(onContextChange, contextValues)}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {contextValues.map((value) => (
              <SelectItem key={value} value={value}>
                {contextLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Renaming does not update saved views that filter by this tag name.
        </p>
        {errorMessage != null && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={onSubmit} disabled={saveDisabled}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
