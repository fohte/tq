import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks/')({
  component: TaskList,
})

function TaskList() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <p className="text-muted-foreground">All tasks</p>
    </div>
  )
}
