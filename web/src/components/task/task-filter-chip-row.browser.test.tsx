import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { makeProject } from '#components/project/project-test-fixtures'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { makeParsedQuery } from '#components/task/task-filter-test-fixtures'
import type { Project } from '#hooks/use-projects'
import { waitForFocus } from '#lib/test-utils'

vi.mock('#hooks/use-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...actual,
    useSearchSuggestions: () => ({ data: undefined }),
  }
})

vi.mock('#hooks/use-labels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-labels')>()
  return {
    ...actual,
    useLabels: () => ({ data: [] }),
  }
})

vi.mock('#hooks/use-task-queries', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#hooks/use-task-queries')>()
  return {
    ...actual,
    useTask: () => ({
      data: { title: 'Version bump the home cluster' },
      isLoading: false,
    }),
  }
})

const projectA: Project = makeProject({
  id: 'proj-1',
  title: 'Website Redesign',
})
const projectB: Project = makeProject({ id: 'proj-2', title: 'Mobile App' })
const projects = [projectA, projectB]

const defaultParsed = makeParsedQuery()

function renderRow(
  props: Partial<ComponentProps<typeof TaskFilterChipRow>> = {},
) {
  const onQueryChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <TaskFilterChipRow
        onQueryChange={onQueryChange}
        parsed={defaultParsed}
        projects={projects}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onQueryChange }
}

describe('TaskFilterChipRow', () => {
  it('hides the project chip when disableProjectFilter is set', () => {
    renderRow({
      parsed: { ...defaultParsed, projectId: 'proj-1' },
      disableProjectFilter: true,
    })

    expect(
      screen.queryByRole('button', { name: /^project / }),
    ).not.toBeInTheDocument()
  })

  it('drops a typed project token while disableProjectFilter is set', async () => {
    const { onQueryChange } = renderRow({ disableProjectFilter: true })
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'project:proj-1')
    await user.keyboard('{Enter}')

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:updated')
  })

  it('unchecking a status in its menu reports the updated query', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, status: ['todo', 'completed'] },
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'is todo, done' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Todo' }))

    expect(onQueryChange).toHaveBeenCalledWith('is:completed sort:updated')
  })

  it('changing the project in its menu reports the updated query', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, projectId: 'proj-1' },
    })
    const user = userEvent.setup()

    await user.click(
      screen.getByRole('button', { name: 'project Website Redesign' }),
    )
    await waitForFocus(
      await screen.findByRole('button', { name: 'All projects' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Mobile App' }))

    expect(onQueryChange).toHaveBeenCalledWith(
      'is:todo project:proj-2 sort:updated',
    )
  })

  it('clearing the label in its menu reports the updated query', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, label: 'dev:tq' },
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'label #dev:tq' }))
    await user.click(await screen.findByRole('button', { name: 'No label' }))

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:updated')
  })

  it('unchecking has:pages in its menu reports the updated query', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, hasPages: true },
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'has pages' }))
    await user.click(await screen.findByRole('checkbox', { name: 'has pages' }))

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:updated')
  })

  it('clearing the parent filter in its menu reports the updated query', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, parentId: 'parent-abc' },
    })
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', {
        name: 'parent Version bump the home cluster',
      }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Clear parent filter' }),
    )

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:updated')
  })

  it('changing the sort order in its menu reports the updated query', async () => {
    const { onQueryChange } = renderRow()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Sort by/ }))
    await waitForFocus(await screen.findByRole('button', { name: 'Updated' }))
    await user.click(await screen.findByRole('button', { name: 'Created' }))

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:created')
  })

  it('commits an edited free-text value merged with the applied query', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, freeText: 'foo bar' },
    })
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    // Overwrite the whole value instead of appending, so the result doesn't
    // depend on where the browser places the caret after a click.
    await user.clear(input)
    await user.type(input, 'foo')
    await user.tab()

    expect(onQueryChange).toHaveBeenCalledWith('foo is:todo sort:updated')
  })

  it('lifts a typed structured token out of free text into its own chip', async () => {
    const { onQueryChange } = renderRow({
      parsed: { freeText: '', sortBy: 'updated' },
    })
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'has:pages')
    await user.keyboard('{Enter}')

    expect(onQueryChange).toHaveBeenCalledWith('has:pages sort:updated')
  })

  it('does not duplicate a typed token already applied to the query', async () => {
    const { onQueryChange } = renderRow()
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'is:todo')
    await user.keyboard('{Enter}')

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:updated')
  })

  it('clears the free-text input on Escape', async () => {
    renderRow()
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'has:pages')
    await user.keyboard('{Escape}')

    expect(input).toHaveValue('')
  })

  it('does not commit on Escape', async () => {
    const { onQueryChange } = renderRow()
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'has:pages')
    await user.keyboard('{Escape}')

    expect(onQueryChange).not.toHaveBeenCalled()
  })

  it('removes the last applied chip on Backspace in the empty free-text input', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, label: 'dev:tq' },
    })
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.click(input)
    await user.keyboard('{Backspace}')

    expect(onQueryChange).toHaveBeenCalledWith('is:todo sort:updated')
  })

  it('removes the parent chip before the label chip on Backspace', async () => {
    const { onQueryChange } = renderRow({
      parsed: { ...defaultParsed, parentId: 'parent-abc', label: 'dev:tq' },
    })
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.click(input)
    await user.keyboard('{Backspace}')

    expect(onQueryChange).toHaveBeenCalledWith(
      'is:todo label:dev:tq sort:updated',
    )
  })
})
