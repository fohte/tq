import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskChecklistList } from '#components/task/task-checklist-list'
import {
  makeTaskChecklist,
  makeTaskChecklistItem,
} from '#components/task/task-checklist-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { assertDefined, focusDescriptionEditor } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const checklistId = '20000000-0000-4000-8000-000000000301'
const backpackId = '30000000-0000-4000-8000-000000000301'
const tentId = '30000000-0000-4000-8000-000000000302'
const clothesId = '30000000-0000-4000-8000-000000000303'
const glovesId = '30000000-0000-4000-8000-000000000304'
const jacketId = '30000000-0000-4000-8000-000000000305'
const bottleId = '30000000-0000-4000-8000-000000000306'

function makeTestChecklist() {
  return makeTaskChecklist({
    id: checklistId,
    name: 'Camping trip',
    items: [
      makeTaskChecklistItem({
        id: backpackId,
        content: 'Backpack',
        children: [
          makeTaskChecklistItem({
            id: clothesId,
            parentItemId: backpackId,
            content: 'Clothes',
            children: [
              makeTaskChecklistItem({
                id: glovesId,
                parentItemId: clothesId,
                content: 'Gloves',
                checkedAt: '2026-01-02T00:00:00.000Z',
              }),
              makeTaskChecklistItem({
                id: jacketId,
                parentItemId: clothesId,
                content: 'Fleece jacket',
                note: 'Pack this in the dry bag.',
              }),
            ],
          }),
          makeTaskChecklistItem({
            id: tentId,
            parentItemId: backpackId,
            sortOrder: 1,
            content: 'Tent',
          }),
          makeTaskChecklistItem({
            id: bottleId,
            parentItemId: backpackId,
            sortOrder: 2,
            content: 'Water bottle',
          }),
        ],
      }),
    ],
  })
}

function renderChecklist({
  checklists = [makeTestChecklist()],
  githubLinks = [],
  subtasks = [],
  linkGithubErrorMessage,
  isLinkingGithub = false,
  onLinkGithub,
}: {
  checklists?: ComponentProps<typeof TaskChecklistList>['checklists']
  githubLinks?: ComponentProps<typeof TaskChecklistList>['githubLinks']
  subtasks?: ComponentProps<typeof TaskChecklistList>['subtasks']
  linkGithubErrorMessage?: ComponentProps<
    typeof TaskChecklistList
  >['linkGithubErrorMessage']
  isLinkingGithub?: ComponentProps<typeof TaskChecklistList>['isLinkingGithub']
  onLinkGithub?: ComponentProps<typeof TaskChecklistList>['onLinkGithub']
} = {}) {
  const actions = {
    onCreateChecklist: vi.fn(),
    onUpdateChecklist: vi.fn(),
    onReorderChecklists: vi.fn(),
    onDeleteChecklist: vi.fn(),
    onCreateItem: vi.fn(),
    onUpdateItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onMoveItem: vi.fn(),
    onSetItemChecked: vi.fn(),
    onLinkGithub: vi.fn<
      ComponentProps<typeof TaskChecklistList>['onLinkGithub']
    >((_itemId, url, onSuccess) => {
      if (onLinkGithub == null) onSuccess()
      else onLinkGithub(_itemId, url, onSuccess)
    }),
    onPromoteItem: vi.fn(),
  }

  const rendered = render(
    <TaskChecklistList
      {...actions}
      checklists={checklists}
      githubLinks={githubLinks}
      subtasks={subtasks}
      linkGithubErrorMessage={linkGithubErrorMessage}
      isLinkingGithub={isLinkingGithub}
    />,
  )
  return { ...actions, unmount: rendered.unmount }
}

function readLinkSubmissionState(
  calls: Parameters<ComponentProps<typeof TaskChecklistList>['onLinkGithub']>[],
  dialogOpen: boolean,
) {
  return {
    submissions: calls.map(([itemId, url, onSuccess]) => ({
      itemId,
      url,
      hasOnSuccess: typeof onSuccess === 'function',
    })),
    dialogOpen,
  }
}

function readLinkDialogState(errorMessage: string) {
  return {
    errorText: screen.queryByText(errorMessage)?.textContent ?? null,
    dialogOpen: screen.queryByRole('dialog') != null,
    linkButtonDisabled: screen
      .getByRole('button', { name: 'Link' })
      .hasAttribute('disabled'),
  }
}

function getRenderedChecklistState() {
  return {
    counts: screen.getAllByText(/^\d+\/\d+$/).map((count) => count.textContent),
    checkboxes: screen.getAllByRole('checkbox').map((checkbox) => ({
      label: checkbox.getAttribute('aria-label'),
      checked: checkbox.getAttribute('aria-checked'),
      disabled: checkbox.getAttribute('aria-disabled'),
    })),
  }
}

function getLinkedItemState(
  pullRequestChip: HTMLElement,
  subtaskChip: HTMLElement,
) {
  return {
    pullRequestChip: {
      text: pullRequestChip.textContent,
      openStateColor: pullRequestChip.classList.contains('text-github-open'),
    },
    subtaskChip: {
      label: subtaskChip.getAttribute('aria-label'),
      href: subtaskChip.getAttribute('href'),
    },
    checkboxes: screen.getAllByRole('checkbox').map((checkbox) => ({
      label: checkbox.getAttribute('aria-label'),
      checked: checkbox.getAttribute('aria-checked'),
      disabled: checkbox.getAttribute('aria-disabled'),
    })),
  }
}

function getNoteEditorState(
  container: HTMLElement,
  onUpdateItem: ReturnType<typeof vi.fn>,
) {
  return {
    mode: container
      .querySelector('.milkdown-wrapper')
      ?.getAttribute('data-view-mode'),
    updateCalls: onUpdateItem.mock.calls,
  }
}

describe('TaskChecklistList', () => {
  it('counts only leaf items and locks a parent checkbox', () => {
    renderChecklist()

    expect(getRenderedChecklistState()).toEqual({
      counts: ['1/4', '1/4', '1/4', '1/2'],
      checkboxes: [
        { label: 'Check Backpack', checked: 'false', disabled: 'true' },
        { label: 'Check Clothes', checked: 'false', disabled: 'true' },
        { label: 'Uncheck Gloves', checked: 'true', disabled: null },
        { label: 'Check Fleece jacket', checked: 'false', disabled: null },
        { label: 'Check Tent', checked: 'false', disabled: null },
        { label: 'Check Water bottle', checked: 'false', disabled: null },
      ],
    })
  })

  it('checks a leaf item through the checklist action callback', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(
      screen.getByRole('checkbox', { name: 'Check Fleece jacket' }),
    )

    expect(actions.onSetItemChecked.mock.calls).toEqual([[jacketId, true]])
  })

  it('unchecks a completed leaf item through the checklist action callback', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(screen.getByRole('checkbox', { name: 'Uncheck Gloves' }))

    expect(actions.onSetItemChecked.mock.calls).toEqual([[glovesId, false]])
  })

  it('links a pull request from a leaf item action', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(
      screen.getByRole('button', { name: 'Actions for Fleece jacket' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'link pull request' }),
    )
    await user.type(
      await screen.findByRole('textbox', { name: 'Pull request URL' }),
      'https://github.com/example-org/sample-app/pull/14',
    )
    await user.click(screen.getByRole('button', { name: 'Link' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Link pull request' }),
      ).toEqual(null)
    })

    expect(
      readLinkSubmissionState(
        actions.onLinkGithub.mock.calls,
        screen.queryByRole('dialog', { name: 'Link pull request' }) != null,
      ),
    ).toEqual({
      submissions: [
        {
          itemId: jacketId,
          url: 'https://github.com/example-org/sample-app/pull/14',
          hasOnSuccess: true,
        },
      ],
      dialogOpen: false,
    })
  })

  it('keeps the link dialog open and shows API errors', async () => {
    const user = userEvent.setup()
    const errorMessage = 'This URL must point to a pull request.'
    renderChecklist({
      linkGithubErrorMessage: errorMessage,
      onLinkGithub: vi.fn(),
    })

    await user.click(
      screen.getByRole('button', { name: 'Actions for Fleece jacket' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'link pull request' }),
    )
    await user.type(
      await screen.findByRole('textbox', { name: 'Pull request URL' }),
      'https://github.com/example-org/sample-app/issues/14',
    )
    await user.click(screen.getByRole('button', { name: 'Link' }))

    expect(readLinkDialogState(errorMessage)).toEqual({
      errorText: errorMessage,
      dialogOpen: true,
      linkButtonDisabled: false,
    })
  })

  it('disables the link action while the request is pending', async () => {
    const user = userEvent.setup()
    renderChecklist({ isLinkingGithub: true })

    await user.click(
      screen.getByRole('button', { name: 'Actions for Fleece jacket' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'link pull request' }),
    )
    await user.type(
      await screen.findByRole('textbox', { name: 'Pull request URL' }),
      'https://github.com/example-org/sample-app/pull/14',
    )

    expect(
      screen.getByRole('button', { name: 'Link' }).hasAttribute('disabled'),
    ).toEqual(true)
  })

  it('promotes a leaf item from its action menu', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(screen.getByRole('button', { name: 'Actions for Tent' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'promote to subtask' }),
    )

    expect(actions.onPromoteItem.mock.calls).toEqual([[tentId]])
  })

  it('shows linked targets beside their items and locks their checkboxes', async () => {
    const pullRequest = makeGithubLink({
      id: 'link-456',
      owner: 'example-org',
      repo: 'sample-app',
      number: 14,
      kind: 'pull_request',
      url: 'https://github.com/example-org/sample-app/pull/14',
      state: 'open',
    })
    const linkedSubtask = makeTask({
      id: '50000000-0000-4000-8000-000000000301',
      number: 27,
      title: 'Add retry handling',
      status: 'completed',
    })
    const checklistProps = {
      onCreateChecklist: () => {},
      onUpdateChecklist: () => {},
      onReorderChecklists: () => {},
      onDeleteChecklist: () => {},
      onCreateItem: () => {},
      onUpdateItem: () => {},
      onDeleteItem: () => {},
      onMoveItem: () => {},
      onSetItemChecked: () => {},
      onLinkGithub: () => {},
      onPromoteItem: () => {},
      checklists: [
        makeTaskChecklist({
          items: [
            makeTaskChecklistItem({
              id: '30000000-0000-4000-8000-000000000401',
              content: 'Merge the API change',
              githubLinkId: pullRequest.id,
            }),
            makeTaskChecklistItem({
              id: '30000000-0000-4000-8000-000000000402',
              content: 'Add retry handling',
              checkedAt: '2026-01-02T00:00:00.000Z',
              subtaskId: linkedSubtask.id,
            }),
          ],
        }),
      ],
      githubLinks: [pullRequest],
      subtasks: [linkedSubtask],
      linkGithubErrorMessage: undefined,
      isLinkingGithub: false,
    }
    render(
      <StoryRouter
        component={() => <TaskChecklistList {...checklistProps} />}
        paths={['/tasks/$taskId']}
      />,
    )

    const subtaskChip = await screen.findByRole('link', {
      name: '#27 Add retry handling',
    })
    const pullRequestChip = screen.getByRole('button', {
      name: 'sample-app#14',
    })

    expect(getLinkedItemState(pullRequestChip, subtaskChip)).toEqual({
      pullRequestChip: {
        text: 'sample-app#14',
        openStateColor: true,
      },
      subtaskChip: {
        label: '#27 Add retry handling',
        href: '/tasks/50000000-0000-4000-8000-000000000301',
      },
      checkboxes: [
        {
          label: 'Check Merge the API change',
          checked: 'false',
          disabled: 'true',
        },
        {
          label: 'Uncheck Add retry handling',
          checked: 'true',
          disabled: 'true',
        },
      ],
    })
  })

  it('hides linking and promotion actions from parents and linked items', async () => {
    const user = userEvent.setup()
    const restrictedActions = []
    for (const { item, title } of [
      {
        title: 'Bundle',
        item: makeTaskChecklistItem({
          id: backpackId,
          content: 'Bundle',
          children: [
            makeTaskChecklistItem({
              id: tentId,
              parentItemId: backpackId,
              content: 'Tent',
            }),
          ],
        }),
      },
      {
        title: 'Pull request item',
        item: makeTaskChecklistItem({
          id: jacketId,
          content: 'Pull request item',
          githubLinkId: 'linked-pr-id',
        }),
      },
      {
        title: 'Subtask item',
        item: makeTaskChecklistItem({
          id: bottleId,
          content: 'Subtask item',
          subtaskId: 'linked-subtask-id',
        }),
      },
    ]) {
      const { unmount } = renderChecklist({
        checklists: [makeTaskChecklist({ items: [item] })],
      })
      await user.click(
        screen.getByRole('button', { name: `Actions for ${title}` }),
      )
      await screen.findByRole('menuitem', { name: 'edit' })
      restrictedActions.push(
        screen.getAllByRole('menuitem').map((menuItem) => menuItem.textContent),
      )
      await user.keyboard('{Escape}')
      unmount()
    }

    expect(restrictedActions).toEqual([
      ['edit', 'add subitem', 'add details', 'delete…'],
      ['edit', 'add details', 'delete…'],
      ['edit', 'add details', 'delete…'],
    ])
  })

  it('adds an item to the selected checklist', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(screen.getByRole('button', { name: 'add item' }))
    await user.type(
      screen.getByRole('textbox', { name: 'New checklist item' }),
      'Bring a lantern',
    )
    await user.keyboard('{Enter}')

    expect(actions.onCreateItem.mock.calls).toEqual([
      [checklistId, { content: 'Bring a lantern' }],
    ])
  })

  it('adds a nested item under the selected parent', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(
      screen.getByRole('button', { name: 'Actions for Backpack' }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'add subitem' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'New checklist item' }),
      'First aid kit',
    )
    await user.keyboard('{Enter}')

    expect(actions.onCreateItem.mock.calls).toEqual([
      [checklistId, { content: 'First aid kit', parentItemId: backpackId }],
    ])
  })

  it('indents the edited item under its previous sibling with Tab', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(screen.getByRole('button', { name: 'Tent' }))
    await user.keyboard('{Tab}')

    expect(actions.onMoveItem.mock.calls).toEqual([
      [tentId, { parentItemId: clothesId }],
    ])
  })

  it('updates an item title when inline editing ends', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(screen.getByRole('button', { name: 'Fleece jacket' }))
    const input = screen.getByRole('textbox', { name: 'Edit Fleece jacket' })
    await user.clear(input)
    await user.type(input, 'Warm layer')
    await user.keyboard('{Enter}')

    expect(actions.onUpdateItem.mock.calls).toEqual([
      [jacketId, { content: 'Warm layer' }],
    ])
  })

  it('outdents the edited item after its parent with Shift+Tab', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(screen.getByRole('button', { name: 'Gloves' }))
    await user.keyboard('{Shift>}{Tab}{/Shift}')

    expect(actions.onMoveItem.mock.calls).toEqual([
      [glovesId, { parentItemId: backpackId, afterItemId: clothesId }],
    ])
  })

  it('renames a checklist from its actions menu', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(
      assertDefined(
        screen.getAllByRole('button', { name: 'Checklist actions' }).at(0),
        'the checklist has an actions menu',
      ),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'rename' }))
    const input = screen.getByRole('textbox', { name: 'Checklist name' })
    await user.clear(input)
    await user.type(input, 'Weekend trip')
    await user.keyboard('{Enter}')

    expect(actions.onUpdateChecklist.mock.calls).toEqual([
      [checklistId, { name: 'Weekend trip' }],
    ])
  })

  it('moves a checklist through its actions menu', async () => {
    const user = userEvent.setup()
    const secondId = '20000000-0000-4000-8000-000000000302'
    const actions = renderChecklist({
      checklists: [
        makeTestChecklist(),
        makeTaskChecklist({
          id: secondId,
          name: 'Before leaving',
          sortOrder: 1,
        }),
      ],
    })

    const checklistMenus = screen.getAllByRole('button', {
      name: 'Checklist actions',
    })
    await user.click(
      assertDefined(
        checklistMenus.at(1),
        'the second checklist has an actions menu',
      ),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'move up' }))

    expect(actions.onReorderChecklists.mock.calls).toEqual([
      [[secondId, checklistId]],
    ])
  })

  it('shows checklist deletion confirmation before deleting its items', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(
      assertDefined(
        screen.getAllByRole('button', { name: 'Checklist actions' }).at(0),
        'the checklist has an actions menu',
      ),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'delete…' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(actions.onDeleteChecklist.mock.calls).toEqual([[checklistId]])
  })

  it('shows an item deletion confirmation before deleting nested content', async () => {
    const user = userEvent.setup()
    const actions = renderChecklist()

    await user.click(
      screen.getByRole('button', { name: 'Actions for Fleece jacket' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'delete…' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(actions.onDeleteItem.mock.calls).toEqual([[jacketId]])
  })

  it('opens item details for editing when details are empty', async () => {
    const user = userEvent.setup()
    const onUpdateItem = vi.fn()
    const { container } = render(
      <TaskChecklistList
        checklists={[
          makeTaskChecklist({
            items: [
              makeTaskChecklistItem({ id: jacketId, content: 'Fleece jacket' }),
            ],
          }),
        ]}
        githubLinks={[]}
        subtasks={[]}
        linkGithubErrorMessage={undefined}
        isLinkingGithub={false}
        onCreateChecklist={() => {}}
        onUpdateChecklist={() => {}}
        onReorderChecklists={() => {}}
        onDeleteChecklist={() => {}}
        onCreateItem={() => {}}
        onUpdateItem={onUpdateItem}
        onDeleteItem={() => {}}
        onMoveItem={() => {}}
        onSetItemChecked={() => {}}
        onLinkGithub={(_itemId, _url, onSuccess) => {
          onSuccess()
        }}
        onPromoteItem={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: /add details/i }))
    await waitFor(() => {
      if (
        container
          .querySelector('.milkdown-wrapper')
          ?.getAttribute('data-view-mode') !== 'edit'
      ) {
        throw new Error('The details editor is still mounting')
      }
    })
    await focusDescriptionEditor(user, container)
    await user.keyboard('Pack a compass')

    await waitFor(
      () => {
        expect(getNoteEditorState(container, onUpdateItem)).toEqual({
          mode: 'edit',
          updateCalls: [[jacketId, { note: 'Pack a compass\n' }]],
        })
      },
      { timeout: 3_000 },
    )
  })
})
