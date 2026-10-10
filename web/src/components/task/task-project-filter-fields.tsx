import { List, ListItem } from '@fohte/ui/list'

import { ALL_PROJECTS_FILTER, useProjects } from '#hooks/use-projects'

export function TaskProjectFilterFields({
  selectedProjectId,
  onProjectIdChange,
}: {
  selectedProjectId: string | undefined
  onProjectIdChange: (id: string) => void
}) {
  const { data: projects = [] } = useProjects(ALL_PROJECTS_FILTER)

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
