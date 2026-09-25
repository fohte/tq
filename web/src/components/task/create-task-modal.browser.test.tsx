import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreateTaskModal } from '#components/task/create-task-modal'
import {
  makeGithubLink,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import { useLinkTaskToGithub } from '#hooks/use-github-link'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { DAY_QUEUE_KEY, queueKeys, useSetQueueItems } from '#hooks/use-queues'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import type { CreateTaskInput, Task } from '#hooks/use-tasks'
import { useCreateTask } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { renderControlledModal } from '#lib/render-controlled-modal'
import { assertDefined, atIndex, partialMutation } from '#lib/test-utils'

// Mutation hooks are mocked (see the module-level vi.mock calls below) so a
// test can assert on their call args directly instead of round-tripping
// through a real network layer; the query hooks below stay real, fed via
// setQueryData on a per-test QueryClient instead.
vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return { ...original, useCreateTask: vi.fn() }
})
vi.mock('#hooks/use-github-link', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-github-link')>()
  return { ...original, useLinkTaskToGithub: vi.fn() }
})
vi.mock('#hooks/use-queues', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-queues')>()
  return { ...original, useSetQueueItems: vi.fn() }
})

const mockUseCreateTask = vi.mocked(useCreateTask)
const mockUseLinkTaskToGithub = vi.mocked(useLinkTaskToGithub)
const mockUseSetQueueItems = vi.mocked(useSetQueueItems)

const githubIssueUrl = 'https://github.com/fohte/tq/issues/123'

// The component reads `task.id` (and passes the whole task to `onCreated`)
// once `mutate`'s `onSuccess` fires, so the mock must actually invoke it
// synchronously — unlike the other two mutation mocks below, whose callers
// never depend on their outcome within the same test.
function mockCreateTaskSuccess(task: Task) {
  const mutate = vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: CreateTaskModal only ever calls mutate(input, { onSuccess }), so the exact mutate overload signature doesn't matter here
    ((
      _input: CreateTaskInput,
      options?: { onSuccess?: (task: Task) => void },
    ) => {
      options?.onSuccess?.(task)
    }) as ReturnType<typeof useCreateTask>['mutate'],
  )
  mockUseCreateTask.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateTask>>({
      mutate,
      isPending: false,
    }),
  )
  return mutate
}

function mockCreateTaskPendingSuccess() {
  let onSuccess: ((task: Task) => void) | undefined
  const mutate = vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double stores the callback to simulate an in-flight mutation
    ((
      _input: CreateTaskInput,
      options?: { onSuccess?: (task: Task) => void },
    ) => {
      onSuccess = options?.onSuccess
    }) as ReturnType<typeof useCreateTask>['mutate'],
  )
  mockUseCreateTask.mockReturnValue(
    partialMutation<ReturnType<typeof useCreateTask>>({
      mutate,
      isPending: false,
    }),
  )
  return {
    mutate,
    succeed: (task: Task) => {
      assertDefined(onSuccess)(task)
    },
  }
}

const titleInputPlaceholder = /task title|タスクのタイトル/i

function titleInputValue() {
  const input = atIndex(
    screen.getAllByPlaceholderText(titleInputPlaceholder),
    0,
  )
  return input instanceof HTMLInputElement ? input.value : null
}

function isDiscardConfirmationOpen() {
  return screen.queryByRole('dialog', { name: 'Discard task draft?' }) !== null
}

async function clickDiscardConfirmation(
  user: UserEvent,
  label: 'Cancel' | 'Discard',
) {
  const confirmation = screen.getByRole('dialog', {
    name: 'Discard task draft?',
  })
  await user.click(within(confirmation).getByRole('button', { name: label }))
}

function closeState(
  calls: readonly unknown[][],
  values: Record<string, unknown> = {},
) {
  return {
    ...values,
    onOpenChange: calls,
    confirmationOpen: isDiscardConfirmationOpen(),
  }
}

describe('CreateTaskModal', () => {
  beforeEach(() => {
    mockUseCreateTask.mockReturnValue(
      partialMutation<ReturnType<typeof useCreateTask>>({
        mutate: vi.fn(),
        isPending: false,
      }),
    )
    mockUseLinkTaskToGithub.mockReturnValue(
      partialMutation<ReturnType<typeof useLinkTaskToGithub>>({
        mutate: vi.fn(),
      }),
    )
    mockUseSetQueueItems.mockReturnValue(
      partialMutation<ReturnType<typeof useSetQueueItems>>({
        mutate: vi.fn(),
      }),
    )
  })

  it('removes the modal from the DOM when the close (X) button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateTaskModal, {})

    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    await user.click(atIndex(closeButtons, 0))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Task title'),
      ).not.toBeInTheDocument()
    })
  })

  it('keeps a title draft when closing is canceled', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderControlledModal(CreateTaskModal, {})

    const titleInput = atIndex(
      screen.getAllByPlaceholderText(titleInputPlaceholder),
      0,
    )
    await user.type(titleInput, 'A draft task')
    await user.click(
      atIndex(screen.getAllByRole('button', { name: 'Close' }), 0),
    )

    await clickDiscardConfirmation(user, 'Cancel')

    await waitFor(() => {
      expect(
        closeState(onOpenChange.mock.calls, { title: titleInputValue() }),
      ).toEqual({
        title: 'A draft task',
        onOpenChange: [],
        confirmationOpen: false,
      })
    })
  })

  it('asks before closing when the description has content', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderControlledModal(CreateTaskModal, {
      defaultDescription: '',
    })

    const editor = await waitFor(() =>
      atIndex(
        Array.from(document.body.querySelectorAll('[contenteditable="true"]')),
        0,
      ),
    )
    await user.click(editor)
    await user.keyboard('A draft description')
    await user.keyboard('{Escape}')

    await clickDiscardConfirmation(user, 'Cancel')

    await waitFor(() => {
      expect(
        closeState(onOpenChange.mock.calls, {
          description: editor.textContent,
        }),
      ).toEqual({
        description: 'A draft description',
        onOpenChange: [],
        confirmationOpen: false,
      })
    })
  })

  it('closes and resets the draft when discard is confirmed', async () => {
    const user = userEvent.setup()
    const { onOpenChange, setOpen } = renderControlledModal(CreateTaskModal, {})

    const titleInput = atIndex(
      screen.getAllByPlaceholderText(titleInputPlaceholder),
      0,
    )
    await user.type(titleInput, 'A draft task')
    await user.click(
      atIndex(screen.getAllByRole('button', { name: 'Close' }), 0),
    )

    await clickDiscardConfirmation(user, 'Discard')
    setOpen(false)
    setOpen(true)

    await waitFor(() => {
      expect(
        closeState(onOpenChange.mock.calls, { title: titleInputValue() }),
      ).toEqual({
        title: '',
        onOpenChange: [[false]],
        confirmationOpen: false,
      })
    })
  })

  it('closes a discard confirmation when task creation succeeds', async () => {
    const user = userEvent.setup()
    const pendingCreate = mockCreateTaskPendingSuccess()
    const { onOpenChange } = renderControlledModal(CreateTaskModal, {})

    const titleInput = atIndex(
      screen.getAllByPlaceholderText(titleInputPlaceholder),
      0,
    )
    await user.type(titleInput, 'A draft task')
    await user.keyboard('{Meta>}{Enter}{/Meta}')
    await user.click(
      atIndex(screen.getAllByRole('button', { name: 'Close' }), 0),
    )
    pendingCreate.succeed(makeTask())

    await waitFor(() => {
      const actual = closeState(onOpenChange.mock.calls)
      expect(actual).toEqual({
        onOpenChange: [[false]],
        confirmationOpen: false,
      })
    })
  })

  it('removes the modal from the DOM when the Cancel button is clicked', async () => {
    const user = userEvent.setup()
    renderControlledModal(CreateTaskModal, {})

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Task title'),
      ).not.toBeInTheDocument()
    })
  })

  it('prefills the estimate field from defaultEstimateMinutes', () => {
    renderControlledModal(CreateTaskModal, { defaultEstimateMinutes: 90 })

    const estimateInputs = screen.getAllByPlaceholderText('1h30m')
    for (const input of estimateInputs) {
      expect(input).toHaveValue('1h30m')
    }
  })

  describe('tags', () => {
    it('adds a tag typed into the tag input', async () => {
      const user = userEvent.setup()
      renderControlledModal(CreateTaskModal, {})

      const addTagButtons = screen.getAllByRole('button', {
        name: '+ add tag',
      })
      await user.click(atIndex(addTagButtons, 0))
      const tagInput = atIndex(screen.getAllByPlaceholderText('tag name'), 0)
      await user.type(tagInput, 'urgent')
      await user.keyboard('{Enter}')

      expect(screen.getAllByText('urgent').length).toBeGreaterThan(0)
    })

    it('does not close the modal when Escape is pressed inside the tag input', async () => {
      const user = userEvent.setup()
      const { onOpenChange } = renderControlledModal(CreateTaskModal, {})

      const addTagButtons = screen.getAllByRole('button', {
        name: '+ add tag',
      })
      await user.click(atIndex(addTagButtons, 0))
      const tagInput = atIndex(screen.getAllByPlaceholderText('tag name'), 0)
      await user.type(tagInput, 'urgent')
      await user.keyboard('{Escape}')

      // The tag input closes on Escape, but the event must not bubble up to
      // the Dialog and close the whole modal (and discard the in-progress
      // task).
      expect(screen.queryByPlaceholderText('tag name')).not.toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalled()
    })
  })

  describe('title shorthand menu', () => {
    it('does not close the modal when Escape is pressed inside the shorthand suggestion menu', async () => {
      const user = userEvent.setup()
      const { onOpenChange } = renderControlledModal(CreateTaskModal, {})

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Buy milk @')
      await expect(screen.findAllByText('@today')).resolves.not.toHaveLength(0)

      await user.keyboard('{Escape}')

      // The suggestion menu closes on Escape, but the event must not bubble
      // up to the Dialog and close the whole modal (and discard the
      // in-progress task).
      expect(
        closeState(onOpenChange.mock.calls, {
          suggestionMenuOpen: screen.queryByText('@today') !== null,
        }),
      ).toEqual({
        suggestionMenuOpen: false,
        onOpenChange: [],
        confirmationOpen: false,
      })
    })
  })

  describe('shorthand syntax', () => {
    it('applies parsed shorthand tokens (estimate, dates, label, context) to their respective fields', async () => {
      const user = userEvent.setup()
      renderControlledModal(CreateTaskModal, {})

      const today = formatLocalDate(new Date())
      const tomorrowDate = new Date()
      tomorrowDate.setDate(tomorrowDate.getDate() + 1)
      const tomorrow = formatLocalDate(tomorrowDate)

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(
        titleInput,
        'Buy milk @30m >today @tomorrow #groceries %work ',
      )

      await waitFor(() => {
        expect(
          atIndex(screen.getAllByPlaceholderText(titleInputPlaceholder), 0),
        ).toHaveValue('Buy milk ')
      })
      expect(screen.getAllByDisplayValue('30m').length).toBeGreaterThan(0)
      expect(screen.getAllByDisplayValue(today).length).toBeGreaterThan(0)
      expect(screen.getAllByDisplayValue(tomorrow).length).toBeGreaterThan(0)
      expect(screen.getAllByText('groceries').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Work').length).toBeGreaterThan(0)
    })

    it('activates the "today" plan tab via the !today shorthand', async () => {
      const user = userEvent.setup()
      renderControlledModal(CreateTaskModal, {})

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Ship it !today ')

      await waitFor(() => {
        expect(
          atIndex(screen.getAllByPlaceholderText(titleInputPlaceholder), 0),
        ).toHaveValue('Ship it ')
      })
      for (const button of screen.getAllByText('today')) {
        expect(button).toHaveAttribute('aria-pressed', 'true')
      }
    })

    it('activates commitment and appends the task to the day queue when "today" is selected', async () => {
      const user = userEvent.setup()
      const today = formatLocalDate(new Date())
      const existingQueueItem = makeQueueItem({
        id: 'existing-item',
        taskId: 'existing-task',
        periodStart: today,
      })
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, today), [
        existingQueueItem,
      ])
      const mutateCreateTask = mockCreateTaskSuccess(
        makeTask({ id: 'new-task-id', number: 2 }),
      )
      const mutateSetQueueItems = vi.fn()
      mockUseSetQueueItems.mockReturnValue(
        partialMutation<ReturnType<typeof useSetQueueItems>>({
          mutate: mutateSetQueueItems,
        }),
      )

      renderControlledModal(CreateTaskModal, {}, { queryClient })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Ship it %personal ')
      await user.click(atIndex(screen.getAllByText('today'), 0))

      const enabledCreateButton = assertDefined(
        screen
          .getAllByRole('button', { name: /create/i })
          .find((btn) => !btn.hasAttribute('disabled')),
      )
      await user.click(enabledCreateButton)

      expect(mutateCreateTask).toHaveBeenCalledWith(
        { title: 'Ship it', context: 'personal', commitment: 'active' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
        { onSuccess: expect.any(Function) },
      )
      expect(mutateSetQueueItems).toHaveBeenCalledWith(
        {
          key: 'day',
          date: today,
          taskIds: ['existing-task', 'new-task-id'],
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
        { onError: expect.any(Function) },
      )
    })

    // Regression test: each `*` token is stripped from the title once
    // completed, so a second `*weekday` typed afterward is parsed from a
    // string that no longer contains the first one. create-task-modal.tsx
    // must merge the parsed rule into the previous recurrenceRule state
    // instead of replacing it, or the first weekday silently gets lost.
    it('accumulates sequentially typed weekday shorthand tokens into one recurrence rule', async () => {
      const user = userEvent.setup()
      const mutate = mockCreateTaskSuccess(makeTask())

      renderControlledModal(CreateTaskModal, { defaultContext: 'work' })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      // Two separate user.type calls, not one — each triggers its own
      // handleTitleChange call, matching how a real keystroke-by-keystroke
      // typing session (rather than a paste) reaches the component.
      await user.type(titleInput, 'Write blog post *mon ')
      await user.type(titleInput, '*thu ')
      await user.keyboard('{Meta>}{Enter}{/Meta}')

      expect(mutate).toHaveBeenCalledWith(
        {
          title: 'Write blog post',
          context: 'work',
          recurrenceRule: { type: 'weekly', interval: 1, daysOfWeek: [1, 4] },
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
        { onSuccess: expect.any(Function) },
      )
    })
  })

  describe('submitting with Cmd+Enter', () => {
    it('closes the modal on Cmd+Enter from the title field', async () => {
      const user = userEvent.setup()
      mockCreateTaskSuccess(makeTask())
      const { onOpenChange } = renderControlledModal(CreateTaskModal, {})

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Cmd enter from title')
      await user.keyboard('{Meta>}{Enter}{/Meta}')

      const actual = closeState(onOpenChange.mock.calls)
      expect(actual).toEqual({
        onOpenChange: [[false]],
        confirmationOpen: false,
      })
    })

    it('calls onCreated with the created task after submit', async () => {
      const user = userEvent.setup()
      const createdTask = makeTask({ id: 'temp-id' })
      mockCreateTaskSuccess(createdTask)
      const onCreated = vi.fn()
      renderControlledModal(CreateTaskModal, { onCreated })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Notify on created')
      await user.keyboard('{Meta>}{Enter}{/Meta}')

      expect(onCreated).toHaveBeenCalledWith(createdTask)
    })

    it('closes the modal on Cmd+Enter from the description field', async () => {
      const user = userEvent.setup()
      mockCreateTaskSuccess(makeTask())
      const { onOpenChange } = renderControlledModal(CreateTaskModal, {})

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Cmd enter from description')

      const editor = atIndex(
        Array.from(document.body.querySelectorAll('[contenteditable="true"]')),
        0,
      )
      await user.click(editor)
      await user.keyboard('some description text')
      await user.keyboard('{Meta>}{Enter}{/Meta}')

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('parent shorthand (^N)', () => {
    it('overrides the parent prop when a valid ^N token is typed', async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      })
      queryClient.setQueryData(
        taskMentionKeys.preview(34),
        makeTaskDetail({ number: 34, title: 'Refactor auth module' }),
      )
      // TaskTitleInput's own suggestion popup (separate from the
      // parent-preview lookup above) also queries on '^' — useDebounce
      // settles once per keystroke in this real-browser test environment,
      // so '', '3', and '34' each fire their own query. Seed every partial,
      // or an un-cached key falls through to a real (failing) network fetch.
      queryClient.setQueryData(taskMentionKeys.suggestions(''), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('3'), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('34'), [])

      renderControlledModal(
        CreateTaskModal,
        {
          parentId: 'parent-task-id',
          parentTaskNumber: 12,
          parentTaskTitle: 'Fix login bug',
        },
        { queryClient },
      )

      expect(
        screen.getAllByText(/subtask of #12 Fix login bug/).length,
      ).toBeGreaterThan(0)

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )

      await user.type(titleInput, '^34 ')

      await waitFor(() => {
        expect(
          screen.getAllByText(/subtask of #34 Refactor auth module/).length,
        ).toBeGreaterThan(0)
      })
      expect(
        screen.queryByText(/subtask of #12 Fix login bug/),
      ).not.toBeInTheDocument()
    })

    it('submits the raw shorthand number as parentId, not the resolved task id', async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      })
      queryClient.setQueryData(
        taskMentionKeys.preview(34),
        makeTaskDetail({ number: 34, title: 'Refactor auth module' }),
      )
      queryClient.setQueryData(taskMentionKeys.suggestions(''), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('3'), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('34'), [])
      // `parentId` is intentionally sent as the raw shorthand number ('34'),
      // not the resolved task's UUID — see the comment on
      // `effectiveParentId` in create-task-modal.tsx.
      const mutate = mockCreateTaskSuccess(makeTask())

      renderControlledModal(
        CreateTaskModal,
        { defaultContext: 'work' },
        { queryClient },
      )

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Fix bug ^34 ')

      await waitFor(() => {
        expect(
          screen.getAllByText(/subtask of #34 Refactor auth module/).length,
        ).toBeGreaterThan(0)
      })

      await user.keyboard('{Meta>}{Enter}{/Meta}')

      expect(mutate).toHaveBeenCalledWith(
        { title: 'Fix bug', context: 'work', parentId: '34' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
        { onSuccess: expect.any(Function) },
      )
    })

    it('disables submit when the ^N parent is not found, until the override is removed', async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      })
      queryClient.setQueryData(taskMentionKeys.preview(999), null)
      queryClient.setQueryData(taskMentionKeys.suggestions(''), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('9'), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('99'), [])
      queryClient.setQueryData(taskMentionKeys.suggestions('999'), [])

      renderControlledModal(CreateTaskModal, {}, { queryClient })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, 'Buy milk ^999 ')

      await waitFor(() => {
        expect(
          screen.getAllByText('parent #999 not found').length,
        ).toBeGreaterThan(0)
      })
      for (const btn of screen.getAllByRole('button', { name: /create/i })) {
        expect(btn).toBeDisabled()
      }

      // Dismissing the override falls back to no parent at all (this test
      // passes no parentId/parentTaskNumber props), re-enabling Create.
      const dismissButtons = screen.getAllByRole('button', {
        name: 'Remove parent override',
      })
      await user.click(atIndex(dismissButtons, 0))

      await waitFor(() => {
        expect(
          screen.queryByText('parent #999 not found'),
        ).not.toBeInTheDocument()
      })
      for (const btn of screen.getAllByRole('button', { name: /create/i })) {
        expect(btn).not.toBeDisabled()
      }
    })
  })

  describe('GitHub URL shorthand', () => {
    it('links the created task to the resolved issue and seeds the title from it', async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(
        githubUrlPreviewKeys.preview(githubIssueUrl),
        makeResolveGithubUrlResult({
          url: githubIssueUrl,
          title: 'Fix login bug',
        }),
      )
      mockCreateTaskSuccess(makeTask({ id: 'temp-id' }))
      const mutateLinkGithub = vi.fn()
      mockUseLinkTaskToGithub.mockReturnValue(
        partialMutation<ReturnType<typeof useLinkTaskToGithub>>({
          mutate: mutateLinkGithub,
        }),
      )

      renderControlledModal(CreateTaskModal, {}, { queryClient })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, `${githubIssueUrl} `)

      // The URL is stripped from the (now empty) title, which is seeded from
      // the resolved issue's title as an editable initial value, and a chip
      // for the issue appears.
      await waitFor(() => {
        expect(
          atIndex(screen.getAllByPlaceholderText(titleInputPlaceholder), 0),
        ).toHaveValue('Fix login bug')
      })
      expect(screen.getAllByText('fohte/tq#123').length).toBeGreaterThan(0)

      await user.keyboard('{Meta>}{Enter}{/Meta}')

      expect(mutateLinkGithub).toHaveBeenCalledWith(
        { taskId: 'temp-id', url: githubIssueUrl },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
        { onError: expect.any(Function) },
      )
    })

    it('disables submit when the GitHub URL cannot be resolved', async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(
        githubUrlPreviewKeys.preview(githubIssueUrl),
        null,
      )

      renderControlledModal(CreateTaskModal, {}, { queryClient })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, `Fix bug ${githubIssueUrl} `)

      await waitFor(() => {
        expect(
          screen.getAllByText('could not resolve GitHub link').length,
        ).toBeGreaterThan(0)
      })
      for (const btn of screen.getAllByRole('button', { name: /create/i })) {
        expect(btn).toBeDisabled()
      }
    })

    it('disables submit when the GitHub URL is already linked to another task', async () => {
      const user = userEvent.setup()
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(githubUrlPreviewKeys.preview(githubIssueUrl), {
        linked: true,
        task: makeTaskDetail({
          id: 'other-task-id',
          number: 99,
          title: 'Existing task',
          githubLinks: [makeGithubLink({ url: githubIssueUrl, number: 123 })],
        }),
      })

      renderControlledModal(CreateTaskModal, {}, { queryClient })

      const titleInput = atIndex(
        screen.getAllByPlaceholderText(titleInputPlaceholder),
        0,
      )
      await user.type(titleInput, `Fix bug ${githubIssueUrl} `)

      await waitFor(() => {
        expect(
          screen.getAllByText('already linked to another task').length,
        ).toBeGreaterThan(0)
      })
      for (const btn of screen.getAllByRole('button', { name: /create/i })) {
        expect(btn).toBeDisabled()
      }
    })
  })
})
