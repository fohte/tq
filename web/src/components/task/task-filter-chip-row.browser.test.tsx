import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KanbanFilterRow } from '#components/day-view/kanban-filter-row'
import {
  makeProject,
  makeProjectDetail,
} from '#components/project/project-test-fixtures'
import { TaskFilterChipRow } from '#components/task/task-filter-chip-row'
import { makeParsedQuery } from '#components/task/task-filter-test-fixtures'
import {
  ALL_PROJECTS_FILTER,
  projectKeys,
  useProject,
  useProjects,
} from '#hooks/use-projects'
import { partialMutation, waitForFocus } from '#lib/test-utils'

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

const mockUseProject = vi.fn<typeof useProject>()
const mockUseProjects = vi.fn<typeof useProjects>()

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...actual,
    useProject: (...args: Parameters<typeof useProject>) =>
      mockUseProject(...args),
    useProjects: (...args: Parameters<typeof useProjects>) =>
      mockUseProjects(...args),
  }
})

const projectA = makeProject({
  id: 'proj-1',
  title: 'Website Redesign',
})
const projectB = makeProject({ id: 'proj-2', title: 'Mobile App' })
const projects = [projectA, projectB]

const defaultParsed = makeParsedQuery()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseProject.mockImplementation((id) =>
    partialMutation<ReturnType<typeof useProject>>({
      data: id === projectA.id ? makeProjectDetail(projectA) : undefined,
    }),
  )
  mockUseProjects.mockReturnValue(
    partialMutation<ReturnType<typeof useProjects>>({ data: projects }),
  )
})

function renderRow(
  props: Partial<ComponentProps<typeof TaskFilterChipRow>> = {},
) {
  const onQueryChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(projectKeys.list(ALL_PROJECTS_FILTER), projects)
  const rowProps = {
    onQueryChange,
    parsed: defaultParsed,
    ...props,
  }
  const renderWithParsed = (
    parsed: ComponentProps<typeof TaskFilterChipRow>['parsed'],
  ) => (
    <QueryClientProvider client={queryClient}>
      <TaskFilterChipRow {...rowProps} parsed={parsed} />
    </QueryClientProvider>
  )
  const view = render(renderWithParsed(rowProps.parsed))
  return {
    onQueryChange,
    rerenderWithParsed: (
      parsed: ComponentProps<typeof TaskFilterChipRow>['parsed'],
    ) => {
      view.rerender(renderWithParsed(parsed))
    },
  }
}

function getProjectFilterSnapshot(
  projectListCallsBeforeOpen: Parameters<typeof useProjects>[],
) {
  return {
    selectedProjectQuery: mockUseProject.mock.calls[0],
    projectListCallsBeforeOpen,
    projectListCallsAfterOpen: mockUseProjects.mock.calls,
    selectedProjectLabel: screen
      .getByRole('button', { name: 'project Website Redesign' })
      .getAttribute('aria-label'),
  }
}

function getProjectSelectionSnapshot(queryChanges: unknown) {
  return {
    queryChanges,
    selectedProjectLabel: screen
      .getByRole('button', { name: 'project Mobile App' })
      .getAttribute('aria-label'),
    openMenuOption: screen.getByRole('button', { name: 'All projects' })
      .textContent,
  }
}

function getUnavailableProjectSnapshot() {
  return {
    projectChipLabel: screen
      .getByRole('button', { name: 'project Unavailable (missing-project)' })
      .getAttribute('aria-label'),
    removeButtonLabel: screen
      .getByRole('button', { name: 'Remove project filter' })
      .getAttribute('aria-label'),
  }
}

describe('TaskFilterChipRow', () => {
  it('does not commit status or sort tokens in the kanban filter row', async () => {
    const onQueryChange = vi.fn()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <KanbanFilterRow query="" onQueryChange={onQueryChange} />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()

    const input = screen.getByRole('textbox', { name: 'Filter query' })
    await user.type(input, 'is:completed sort:due')
    await user.keyboard('{Enter}')

    expect(onQueryChange.mock.calls).toEqual([['']])
  })

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
    const { onQueryChange, rerenderWithParsed } = renderRow({
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
    rerenderWithParsed({ ...defaultParsed, projectId: 'proj-2' })

    expect(getProjectSelectionSnapshot(onQueryChange.mock.calls)).toEqual({
      queryChanges: [['is:todo project:proj-2 sort:updated']],
      selectedProjectLabel: 'project Mobile App',
      openMenuOption: 'All projects',
    })
  })

  it('loads the selected project label separately and lists projects only while the menu is open', async () => {
    renderRow({ parsed: { ...defaultParsed, projectId: projectA.id } })
    const user = userEvent.setup()
    const projectListCallsBeforeOpen = [...mockUseProjects.mock.calls]

    await user.click(
      screen.getByRole('button', { name: 'project Website Redesign' }),
    )

    expect(getProjectFilterSnapshot(projectListCallsBeforeOpen)).toEqual({
      selectedProjectQuery: [projectA.id, { enabled: true }],
      projectListCallsBeforeOpen: [],
      projectListCallsAfterOpen: [[ALL_PROJECTS_FILTER]],
      selectedProjectLabel: 'project Website Redesign',
    })
  })

  it('keeps an unavailable project filter visible and removable', () => {
    mockUseProject.mockReturnValue(
      partialMutation<ReturnType<typeof useProject>>({
        isError: true,
        error: new Error('project not found'),
      }),
    )
    renderRow({
      parsed: { ...defaultParsed, projectId: 'missing-project' },
    })

    expect(getUnavailableProjectSnapshot()).toEqual({
      projectChipLabel: 'project Unavailable (missing-project)',
      removeButtonLabel: 'Remove project filter',
    })
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
