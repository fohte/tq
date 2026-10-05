import { List, ListItem } from '@fohte/ui/list'

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
    <List>
      <ListItem
        selected={selectedProjectId == null || selectedProjectId === ''}
        onSelect={() => {
          onProjectIdChange('')
        }}
      >
        All projects
      </ListItem>
      {projects.map((project) => (
        <ListItem
          key={project.id}
          selected={selectedProjectId === project.id}
          onSelect={() => {
            onProjectIdChange(project.id)
          }}
        >
          {project.title}
        </ListItem>
      ))}
    </List>
  )
}
