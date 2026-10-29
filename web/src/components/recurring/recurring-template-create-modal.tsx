import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogHeaderBar,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { ChevronLeft, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { RecurrenceRuleFields } from '#components/recurring/recurrence-rule-fields'
import { useRecurrenceRuleDraft } from '#components/recurring/use-recurrence-rule-draft'
import {
  contextLabels,
  type ContextValue,
  contextValues,
} from '#components/task/create-task-modal-fields'
import { TagsInput } from '#components/task/tags-input'
import { DesktopModalFrame } from '#components/ui/desktop-modal-frame'
import { Textarea } from '#components/ui/textarea'
import { useCurrentContext } from '#hooks/use-current-context'
import {
  type CreateRecurringTemplateInput,
  useCreateRecurringTemplate,
} from '#hooks/use-recurring-templates'
import { formatLocalDate } from '#lib/date-range'
import { selectValueHandler } from '#lib/form-utils'
import { anchorDateForFirstOccurrence } from '#lib/recurrence'

interface RecurringTemplateCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  today?: string
}

const contextOptions = contextValues.filter(
  (value): value is ContextValue => value !== '',
)

export function RecurringTemplateCreateModal({
  open,
  onOpenChange,
  today: todayOverride,
}: RecurringTemplateCreateModalProps) {
  const currentContext = useCurrentContext()
  const today = todayOverride ?? formatLocalDate(new Date())

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const recurrenceDraft = useRecurrenceRuleDraft({
    type: 'daily',
    intervalInput: '1',
  })
  const {
    type,
    setType,
    intervalInput,
    setIntervalInput,
    intervalValue,
    daysOfWeek,
    toggleDay,
    dayOfMonth,
    setDayOfMonth,
  } = recurrenceDraft
  const [firstDate, setFirstDate] = useState(today)
  const [context, setContext] = useState<ContextValue>(currentContext)
  const [labels, setLabels] = useState<string[]>([])
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!open) setContext(currentContext)
  }, [currentContext, open])

  useEffect(() => {
    if (open && !wasOpen.current) setFirstDate(today)
    wasOpen.current = open
  }, [open, today])

  const createTemplate = useCreateRecurringTemplate()
  const isPending = createTemplate.isPending

  const parsedDayOfMonth = Number(dayOfMonth)
  const validDayOfMonth =
    dayOfMonth === '' ||
    (Number.isInteger(parsedDayOfMonth) &&
      parsedDayOfMonth >= 1 &&
      parsedDayOfMonth <= 31)

  const recurrenceRule = useMemo(
    () => (validDayOfMonth ? recurrenceDraft.recurrenceRule : null),
    [recurrenceDraft.recurrenceRule, validDayOfMonth],
  )
  const displayedDaysOfWeek =
    type === 'weekly' && daysOfWeek.length === 0 && firstDate
      ? [new Date(`${firstDate}T00:00:00`).getDay()]
      : daysOfWeek
  const anchorResult = useMemo(
    () =>
      firstDate && recurrenceRule != null
        ? anchorDateForFirstOccurrence(firstDate, recurrenceRule)
        : null,
    [firstDate, recurrenceRule],
  )

  const isPastDate = firstDate !== '' && firstDate < today
  const canSubmit =
    title.trim() !== '' &&
    !isPending &&
    !isPastDate &&
    recurrenceRule != null &&
    anchorResult?.isOk() === true

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    recurrenceDraft.reset()
    setFirstDate(today)
    setContext(currentContext)
    setLabels([])
  }, [currentContext, recurrenceDraft.reset, today])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      resetForm()
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  const handleSubmit = () => {
    if (!canSubmit) return

    const { anchorDate, recurrenceRule: normalizedRule } = anchorResult.value
    const descriptionValue = description.trim()
    const input: CreateRecurringTemplateInput = {
      title: title.trim(),
      ...(descriptionValue ? { description: descriptionValue } : {}),
      context,
      ...(labels.length > 0 ? { labels } : {}),
      recurrenceRule: {
        type: normalizedRule.type,
        interval: normalizedRule.interval,
        ...(normalizedRule.daysOfWeek == null
          ? {}
          : { daysOfWeek: normalizedRule.daysOfWeek }),
        ...(normalizedRule.dayOfMonth == null
          ? {}
          : { dayOfMonth: normalizedRule.dayOfMonth }),
      },
      anchorDate,
    }

    createTemplate.mutate(input, {
      onSuccess: () => {
        resetForm()
        onOpenChange(false)
      },
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const formContent = (
    <>
      <Input
        type="text"
        variant="ghost"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value)
        }}
        placeholder="Template title"
        autoFocus
      />

      <Textarea
        value={description}
        onChange={(event) => {
          setDescription(event.target.value)
        }}
        placeholder="Description"
        rows={3}
      />

      <div className="flex flex-col gap-3">
        <FieldRow label="REPEAT">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <RecurrenceRuleFields
              type={type}
              onTypeChange={setType}
              intervalInput={intervalInput}
              intervalValue={intervalValue}
              onIntervalInputChange={setIntervalInput}
              daysOfWeek={displayedDaysOfWeek}
              onToggleDay={toggleDay}
              dayOfMonth={dayOfMonth}
              onDayOfMonthChange={setDayOfMonth}
            />
          </div>
        </FieldRow>

        <FieldRow label="First task date">
          <Input
            aria-label="First task date"
            type="date"
            variant="ghost"
            value={firstDate}
            min={today}
            onChange={(event) => {
              setFirstDate(event.target.value)
            }}
            className="w-auto min-w-0"
          />
        </FieldRow>
        {isPastDate ? (
          <p role="alert" className="text-xs text-destructive">
            First task date must be today or later.
          </p>
        ) : anchorResult?.isErr() === true ? (
          <p role="alert" className="text-xs text-destructive">
            {anchorResult.error}
          </p>
        ) : null}

        <FieldRow label="Context">
          <Select
            value={context}
            onValueChange={selectValueHandler(setContext, contextOptions)}
          >
            <SelectTrigger variant="ghost" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contextOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {contextLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Tags">
          <TagsInput
            labels={labels}
            onLabelsChange={setLabels}
            context={context}
          />
        </FieldRow>
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay />

        <DialogPopup onKeyDown={handleKeyDown}>
          <DesktopModalFrame>
            <DialogHeaderBar>
              <span className="text-base font-semibold text-foreground">
                New Recurring Template
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  handleOpenChange(false)
                }}
              >
                <X />
                <span className="sr-only">Close</span>
              </Button>
            </DialogHeaderBar>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              {formContent}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false)
                }}
              >
                Cancel
              </Button>
              <Button size="lg" onClick={handleSubmit} disabled={!canSubmit}>
                Create Template
              </Button>
            </div>
          </DesktopModalFrame>

          <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleOpenChange(false)
                }}
              >
                <ChevronLeft data-icon="inline-start" />
                Back
              </Button>
              <span className="text-base font-semibold text-foreground">
                New Recurring Template
              </span>
              <Button onClick={handleSubmit} disabled={!canSubmit} size="sm">
                Create
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {formContent}
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-24 shrink-0 items-center font-mono text-2xs tracking-widest text-muted-foreground-faint">
        {label}
      </span>
      {children}
    </div>
  )
}
