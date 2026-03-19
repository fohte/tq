import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/search')({
  component: Search,
})

function Search() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Search</h1>
      <p className="text-muted-foreground">Search tasks</p>
    </div>
  )
}
