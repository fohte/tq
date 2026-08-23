import { FilterOptionButton } from '#components/ui/filter-option-button'
import type { Project } from '#hooks/use-projects'

export function TaskProjectFilterFields({
  projects,
  selectedProjectId,
  onProjectIdChange,
}: {
  projects: Project[]
  selectedProjectId: string | undefined
  onProjectIdChange: (id: string) => void
}) {
  return (
    <div>
      <FilterOptionButton
        active={selectedProjectId == null || selectedProjectId === ''}
        onClick={() => {
          onProjectIdChange('')
        }}
      >
        All projects
      </FilterOptionButton>
      {projects.map((project) => (
        <FilterOptionButton
          key={project.id}
          active={selectedProjectId === project.id}
          onClick={() => {
            onProjectIdChange(project.id)
          }}
        >
          {project.title}
        </FilterOptionButton>
      ))}
    </div>
  )
}
