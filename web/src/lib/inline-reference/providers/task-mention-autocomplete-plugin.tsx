import { SlashProvider } from '@milkdown/kit/plugin/slash'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'

import { TaskMentionAutocompleteMenu } from '#components/task/task-mention-autocomplete-menu'
import { findActiveMentionQuery } from '#lib/inline-reference/providers/task-mention-autocomplete-query'
import { createMentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'
import { queryClient } from '#lib/query-client'

function insertMention(
  view: EditorView,
  range: { from: number; to: number },
  number: number,
): void {
  view.dispatch(
    view.state.tr.insertText(`#${String(number)} `, range.from, range.to),
  )
  view.focus()
}

// Backs the editor's `#` mention autocomplete: SlashProvider (from
// @milkdown/plugin-slash, which despite the name supports any trigger
// character) handles show/hide and floating position, keyed off whether
// findActiveMentionQuery finds an in-progress `#<query>` before the cursor.
export const taskMentionAutocompletePlugin = $prose(() => {
  const store = createMentionAutocompleteStore()

  return new Plugin({
    key: new PluginKey('task-mention-autocomplete'),
    props: {
      handleKeyDown(view, event) {
        if (!store.getSnapshot().open) return false

        if (event.key === 'ArrowDown') {
          store.moveHighlight(1)
          return true
        }
        if (event.key === 'ArrowUp') {
          store.moveHighlight(-1)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = store.highlightedItem()
          const { range } = store.getSnapshot()
          if (item != null && range != null)
            insertMention(view, range, item.number)
          store.hide()
          return true
        }
        if (event.key === 'Escape') {
          store.hide()
          return true
        }
        return false
      },
    },
    view(editorView) {
      const content = document.createElement('div')
      content.className = 'task-mention-autocomplete'

      const slashProvider = new SlashProvider({
        content,
        trigger: '#',
        debounce: 50,
        shouldShow: (view) => findActiveMentionQuery(view.state) != null,
      })

      const root = createRoot(content)
      root.render(
        <QueryClientProvider client={queryClient}>
          <TaskMentionAutocompleteMenu
            store={store}
            onSelect={(item) => {
              const { range } = store.getSnapshot()
              if (range != null) insertMention(editorView, range, item.number)
              store.hide()
            }}
          />
        </QueryClientProvider>,
      )

      return {
        update: (view, prevState) => {
          slashProvider.update(view, prevState)

          const active = findActiveMentionQuery(view.state)
          if (active != null) {
            store.show(active.query, { from: active.from, to: active.to })
          } else {
            store.hide()
          }
        },
        destroy: () => {
          slashProvider.destroy()
          root.unmount()
          content.remove()
        },
      }
    },
  })
})
