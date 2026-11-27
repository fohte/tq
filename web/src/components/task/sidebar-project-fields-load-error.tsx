import { ProjectFieldsLoadError } from '#components/project/project-fields-load-error'

export function SidebarProjectFieldsLoadError({
  mobile = false,
  onRetry,
}: {
  mobile?: boolean
  onRetry: () => void
}) {
  return <ProjectFieldsLoadError mobile={mobile} onRetry={onRetry} />
}
