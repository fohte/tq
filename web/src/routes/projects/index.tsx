import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/')({
  component: ProjectList,
})

function ProjectList() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="text-muted-foreground">All projects</p>
    </div>
  )
}
