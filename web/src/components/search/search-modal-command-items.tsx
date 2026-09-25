import {
  createOptionItem,
  type ListItem,
} from '#components/search/search-modal-result-items'
import type { Project } from '#hooks/use-projects'
import type { TaskDetail } from '#hooks/use-tasks'
import {
  type Keybinding,
  type NavKeybinding,
  navKeybindings,
  newTaskKeybinding,
} from '#lib/keybindings'

export function createCommandItems(
  query: string,
  openRoute: (to: NavKeybinding['to']) => void,
  openNewTask?: () => void,
): ListItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  const commands: { keybinding: Keybinding; select: () => void }[] =
    Object.values(navKeybindings).map((keybinding) => ({
      keybinding,
      select: () => {
        openRoute(keybinding.to)
      },
    }))
  if (openNewTask != null) {
    commands.push({ keybinding: newTaskKeybinding, select: openNewTask })
  }

  return commands
    .filter(({ keybinding }) =>
      keybinding.description.toLowerCase().includes(normalizedQuery),
    )
    .map(({ keybinding, select }) => {
      return createOptionItem(
        `command:${keybinding.id}`,
        select,
        <>
          <span className="flex-1 font-mono text-sm text-foreground">
            {keybinding.description}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">
            {keybinding.keys}
          </span>
        </>,
      )
    })
}

export function createTaskCommandItems(
  query: string,
  parentTask: Pick<TaskDetail, 'id' | 'number' | 'title'> | undefined,
  project: Pick<Project, 'id' | 'title'> | undefined,
  openTask: (task: Pick<TaskDetail, 'id'>) => void,
  openProject: (project: Pick<Project, 'id'>) => void,
): ListItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  const commands = [
    ...(parentTask == null
      ? []
      : [
          {
            id: 'parent',
            description: `Go to parent: #${String(parentTask.number)} ${parentTask.title}`,
            select: () => {
              openTask(parentTask)
            },
          },
        ]),
    ...(project == null
      ? []
      : [
          {
            id: 'project',
            description: `Go to project: ${project.title}`,
            select: () => {
              openProject(project)
            },
          },
        ]),
  ]

  return commands
    .filter(({ description }) =>
      description.toLowerCase().includes(normalizedQuery),
    )
    .map(({ id, description, select }) =>
      createOptionItem(
        `command:task:${id}`,
        select,
        <span className="flex-1 font-mono text-sm text-foreground">
          {description}
        </span>,
      ),
    )
}

export function createTaskScopeItems(
  currentTask: Pick<TaskDetail, 'id' | 'number' | 'title'>,
  parentTask: Pick<TaskDetail, 'id' | 'number' | 'title'> | undefined,
  applyScope: (scopeToken: string) => void,
): ListItem[] {
  const scopes = [
    {
      key: `scope:children:${currentTask.id}`,
      label: `children of #${String(currentTask.number)} ${currentTask.title}`,
      taskId: currentTask.id,
    },
    ...(parentTask == null
      ? []
      : [
          {
            key: `scope:siblings:${parentTask.id}`,
            label: `siblings (children of #${String(parentTask.number)} ${parentTask.title})`,
            taskId: parentTask.id,
          },
        ]),
  ]

  return scopes.map(({ key, label, taskId }) => {
    const applyTaskScope = () => {
      applyScope(`parent:${taskId}`)
    }

    return createOptionItem(
      key,
      applyTaskScope,
      <span className="font-mono text-sm text-foreground">{label}</span>,
      { selectOnTab: applyTaskScope },
    )
  })
}
