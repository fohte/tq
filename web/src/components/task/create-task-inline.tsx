import { Button } from '@web/components/ui/button'
import { useCreateTask } from '@web/hooks/use-tasks'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

export function CreateTaskInline({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const createTask = useCreateTask()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || createTask.isPending) return

    createTask.mutate(
      { title: title.trim() },
      {
        onSuccess: () => {
          setTitle('')
          onClose()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task..."
        autoFocus
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <Button
        type="submit"
        size="icon-xs"
        disabled={!title.trim() || createTask.isPending}
      >
        <Plus className="h-3 w-3" />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onClose}>
        <X className="h-3 w-3" />
      </Button>
    </form>
  )
}

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
