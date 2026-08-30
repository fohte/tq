import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/$projectId_/board')({
  component: RedirectToProjectDetail,
})

function RedirectToProjectDetail() {
  const { projectId } = Route.useParams()
  return <Navigate to="/projects/$projectId" params={{ projectId }} replace />
}
