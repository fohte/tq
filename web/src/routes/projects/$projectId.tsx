import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetail,
})

function ProjectDetail() {
  const { projectId } = Route.useParams()
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Project {projectId}</h1>
      <p className="text-muted-foreground">Project details</p>
    </div>
  )
}
