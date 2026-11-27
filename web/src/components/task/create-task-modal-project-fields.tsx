import { Button } from '@fohte/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { CircleDot } from 'lucide-react'

import {
  ExpandableFieldChip,
  InlineFieldGroup,
} from '#components/ui/modal-field'
import type { ProjectField } from '#hooks/use-project-fields'

export function CreateTaskModalProjectFields({
  fields,
  values,
  onValueChange,
  loadError = false,
  onRetry,
  recurring = false,
  compact = false,
}: {
  fields: ProjectField[]
  values: Record<string, string>
  onValueChange: (fieldId: string, optionId: string) => void
  loadError?: boolean
  onRetry?: () => void
  recurring?: boolean
  compact?: boolean
}) {
  if (fields.length === 0 && !loadError) return null

  return (
    <>
      {loadError && (
        <div
          role="alert"
          className="flex items-center gap-2 text-xs text-destructive"
        >
          <span>Could not load project fields.</span>
          {onRetry != null && (
            <Button type="button" variant="plain" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}
      {fields.length > 0 && (
        <div
          className={
            compact
              ? 'flex gap-2 overflow-x-auto'
              : 'flex flex-wrap items-end gap-4'
          }
        >
          {fields.map((field) => {
            const value = values[field.id] ?? ''
            const selectedOption = field.options.find(({ id }) => id === value)
            const select = (close?: () => void) => (
              <Select
                value={value}
                onValueChange={(optionId) => {
                  onValueChange(field.id, optionId ?? '')
                  close?.()
                }}
              >
                <SelectTrigger
                  aria-label={field.name}
                  variant="ghost"
                  size="sm"
                  autoFocus={compact}
                >
                  <SelectValue>{selectedOption?.name ?? '—'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )

            return compact ? (
              <ExpandableFieldChip
                key={field.id}
                icon={<CircleDot className="size-3.5" />}
                label={
                  selectedOption == null
                    ? field.name
                    : `${field.name}: ${selectedOption.name}`
                }
                active={selectedOption != null}
                expanded={(close) => select(close)}
              />
            ) : (
              <InlineFieldGroup
                key={field.id}
                label={field.name}
                icon={<CircleDot className="size-3.5" />}
              >
                {select()}
              </InlineFieldGroup>
            )
          })}
        </div>
      )}
      {recurring && fields.length > 0 && (
        <p className="text-xs text-muted-foreground">
          These values apply to this task only. Future recurring tasks start
          without them.
        </p>
      )}
    </>
  )
}
