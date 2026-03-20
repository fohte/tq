import { Button } from '@web/components/ui/button'
import { Dialog, DialogOverlay, DialogPortal } from '@web/components/ui/dialog'
import type { CreateTaskInput } from '@web/hooks/use-tasks'
import { useCreateTask } from '@web/hooks/use-tasks'
import { cn } from '@web/lib/utils'
import { Calendar, Clock, GitBranch, Layers, Tag, X } from 'lucide-react'
import { useCallback, useState } from 'react'

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStartDate?: string
}

type ContextValue = 'work' | 'personal' | 'dev'

const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
  dev: 'Dev',
}

export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStartDate,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [context, setContext] = useState<ContextValue | ''>('')
  const createTask = useCreateTask()

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setDueDate('')
    setEstimatedMinutes('')
    setContext('')
  }, [])

  const handleSubmit = () => {
    if (!title.trim() || createTask.isPending) return

    const input: CreateTaskInput = {
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(defaultStartDate ? { startDate: defaultStartDate } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(estimatedMinutes
        ? { estimatedMinutes: Number(estimatedMinutes) }
        : {}),
      ...(context ? { context } : {}),
    }

    createTask.mutate(input, {
      onSuccess: () => {
        resetForm()
        onOpenChange(false)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        {/* PC Modal */}
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center md:flex"
          onKeyDown={handleKeyDown}
        >
          <div className="w-full max-w-[600px] overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10">
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-border px-6">
              <span className="text-base font-semibold text-foreground">
                New Task
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-5 p-6">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                className="w-full bg-transparent text-xl font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />

              {/* Description */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={'## Why\n\n## What'}
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-transparent p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
              />

              {/* Option chips */}
              <div className="flex flex-wrap gap-3">
                <OptionChip
                  icon={<Clock className="size-3.5" />}
                  label={estimatedMinutes ? `${estimatedMinutes}m` : 'Estimate'}
                  active={!!estimatedMinutes}
                >
                  <input
                    type="number"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    placeholder="Minutes"
                    min={1}
                    className="w-20 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  />
                </OptionChip>

                <OptionChip
                  icon={<Calendar className="size-3.5" />}
                  label={dueDate || 'Due date'}
                  active={!!dueDate}
                >
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-32 bg-transparent text-xs outline-none"
                  />
                </OptionChip>

                <OptionChip
                  icon={<Layers className="size-3.5" />}
                  label={context ? contextLabels[context] : 'Context'}
                  active={!!context}
                >
                  <select
                    value={context}
                    onChange={(e) =>
                      setContext(e.target.value as ContextValue | '')
                    }
                    className="bg-transparent text-xs outline-none"
                  >
                    <option value="">None</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="dev">Dev</option>
                  </select>
                </OptionChip>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || createTask.isPending}
                className="h-9 rounded-lg px-4"
              >
                Create Task
              </Button>
            </div>
          </div>
        </div>

        {/* SP Modal (bottom sheet) */}
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          onKeyDown={handleKeyDown}
        >
          <div className="w-full rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10">
            {/* Header */}
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <span className="text-base font-semibold text-foreground">
                New Task
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-5 pt-4">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="タスクのタイトル"
                autoFocus
                className="w-full bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />

              {/* Description */}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="詳細を追加..."
                className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
              />

              <div className="h-px bg-border" />

              {/* Chip row */}
              <div className="flex gap-2 overflow-x-auto">
                <SpChip
                  icon={<GitBranch className="size-3.5" />}
                  label="Parent"
                />
                <SpChip
                  icon={<Clock className="size-3.5" />}
                  label={estimatedMinutes ? `${estimatedMinutes}m` : 'Estimate'}
                  active={!!estimatedMinutes}
                  onClick={() => {
                    const val = prompt('Estimated minutes:')
                    if (val) setEstimatedMinutes(val)
                  }}
                />
                <SpChip
                  icon={<Calendar className="size-3.5" />}
                  label={dueDate || 'Due'}
                  active={!!dueDate}
                  onClick={() => {
                    const val = prompt('Due date (YYYY-MM-DD):')
                    if (val) setDueDate(val)
                  }}
                />
                <SpChip icon={<Tag className="size-3.5" />} label="Label" />
              </div>

              {/* Create button */}
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || createTask.isPending}
                className="h-12 w-full rounded-lg text-base font-semibold"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

function OptionChip({
  icon,
  label,
  active,
  children,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {isEditing ? (
        <div onBlur={() => setIsEditing(false)}>{children}</div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="outline-none"
        >
          {label}
        </button>
      )}
    </div>
  )
}

function SpChip({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
