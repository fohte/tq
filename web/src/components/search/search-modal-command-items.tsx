import {
  createOptionItem,
  type ListItem,
} from '#components/search/search-modal-result-items'
import {
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
  const keybindings = [
    ...Object.values(navKeybindings),
    ...(openNewTask == null ? [] : [newTaskKeybinding]),
  ]

  return keybindings
    .filter((keybinding) =>
      keybinding.description.toLowerCase().includes(normalizedQuery),
    )
    .map((keybinding) => {
      const select = () => {
        if ('to' in keybinding) {
          openRoute(keybinding.to)
        } else {
          openNewTask?.()
        }
      }

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
