import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tasks/$taskId')({
  component: TaskPage,
})

function TaskPage() {
  const { taskId } = Route.useParams()
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Task #{taskId}</h1>
      <p className="text-muted-foreground">Task details</p>
    </div>
  )
}
