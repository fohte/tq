import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/today')({
  component: TodayFocus,
})

function TodayFocus() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Today Focus</h1>
      <p className="text-muted-foreground">Focus on one task at a time</p>
    </div>
  )
}
