import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: DayView,
})

function DayView() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Day View</h1>
      <p className="text-muted-foreground">Today's schedule and tasks</p>
    </div>
  )
}
