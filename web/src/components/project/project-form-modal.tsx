import { Calendar, CalendarPlus, ChevronLeft, Palette, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { Textarea } from '#components/ui/textarea'
import type { Project } from '#hooks/use-projects'
import {
  PROJECT_COLOR_PRESETS,
  useCreateProject,
  useUpdateProject,
} from '#hooks/use-projects'
import { selectValueHandler } from '#lib/form-utils'
import { cn } from '#lib/utils'

interface ProjectFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
}

type StatusValue = 'active' | 'paused' | 'completed' | 'archived'
const statusValues = [
  'active',
  'paused',
  'completed',
  'archived',
] as const satisfies readonly StatusValue[]

const statusLabels: Record<StatusValue, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}

function isValidStatus(value: string | undefined): value is StatusValue {
  return (
    value !== undefined && (statusValues as readonly string[]).includes(value)
  )
}

export function ProjectFormModal({
  open,
  onOpenChange,
  project,
}: ProjectFormModalProps) {
  const isEditing = !!project

  const [title, setTitle] = useState(project?.title ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState<StatusValue>(
    isValidStatus(project?.status) ? project.status : 'active',
  )
  const [startDate, setStartDate] = useState(project?.startDate ?? '')
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? '')
  const [color, setColor] = useState(
    project?.color ?? PROJECT_COLOR_PRESETS[0].hex,
  )

  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const isPending = createProject.isPending || updateProject.isPending

  const resetForm = useCallback(() => {
    setTitle(project?.title ?? '')
    setDescription(project?.description ?? '')
    setStatus(isValidStatus(project?.status) ? project.status : 'active')
    setStartDate(project?.startDate ?? '')
    setTargetDate(project?.targetDate ?? '')
    setColor(project?.color ?? PROJECT_COLOR_PRESETS[0].hex)
  }, [project])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      resetForm()
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  const handleSubmit = () => {
    if (!title.trim() || isPending) return

    if (isEditing) {
      updateProject.mutate(
        {
          id: project.id,
          input: {
            title: title.trim(),
            description: description.trim() || null,
            status,
            startDate: startDate || null,
            targetDate: targetDate || null,
            color,
          },
        },
        {
          onSuccess: () => {
            onOpenChange(false)
          },
        },
      )
    } else {
      createProject.mutate(
        {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          status,
          ...(startDate ? { startDate } : {}),
          ...(targetDate ? { targetDate } : {}),
          color,
        },
        {
          onSuccess: () => {
            resetForm()
            onOpenChange(false)
          },
        },
      )
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const formContent = (
    <>
      {/* Title */}
      <Input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
        }}
        placeholder="Project name"
        className="h-auto border-0 bg-transparent p-0 text-xl font-medium shadow-none focus-visible:border-0 focus-visible:ring-0"
      />

      {/* Description */}
      <Textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value)
        }}
        placeholder="What is this project about?"
        rows={3}
      />

      {/* Option fields */}
      <div className="flex flex-col gap-3">
        <FieldRow label="Status">
          <Select
            value={status}
            onValueChange={selectValueHandler(setStatus, statusValues)}
          >
            <SelectTrigger
              size="sm"
              className="h-auto border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusValues.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow
          label="Start date"
          icon={<CalendarPlus className="size-3.5" />}
        >
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
            }}
            className="bg-transparent text-sm text-foreground outline-none"
          />
        </FieldRow>

        <FieldRow label="Target date" icon={<Calendar className="size-3.5" />}>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => {
              setTargetDate(e.target.value)
            }}
            className="bg-transparent text-sm text-foreground outline-none"
          />
        </FieldRow>

        <FieldRow label="Color" icon={<Palette className="size-3.5" />}>
          <div className="flex gap-2">
            {PROJECT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => {
                  setColor(preset.hex)
                }}
                className={cn(
                  'size-6 border-2 transition-all',
                  color === preset.hex
                    ? 'scale-110 border-foreground'
                    : 'border-transparent hover:scale-110',
                )}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
          </div>
        </FieldRow>
      </div>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />

        <DialogPopup onKeyDown={handleKeyDown}>
          {/* PC Modal */}
          <div className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
            <div className="flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10">
              {/* Header */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
                <span className="text-base font-semibold text-foreground">
                  {isEditing ? 'Edit Project' : 'New Project'}
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
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
                {formContent}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || isPending}
                  className="h-9 rounded-lg px-4"
                >
                  {isEditing ? 'Save' : 'Create Project'}
                </Button>
              </div>
            </div>
          </div>

          {/* SP Full-screen form */}
          <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
            {/* Header */}
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
                {isEditing ? 'Edit Project' : 'New Project'}
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || isPending}
                size="sm"
              >
                {isEditing ? 'Save' : 'Create'}
              </Button>
            </div>

            {/* Body */}
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
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-24 shrink-0 items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] text-muted-foreground-faint">
        {icon}
        {label}
      </span>
      {children}
    </div>
  )
}
