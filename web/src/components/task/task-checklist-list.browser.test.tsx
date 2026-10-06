import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TaskChecklistList } from '#components/task/task-checklist-list'
import {
  makeTaskChecklist,
  makeTaskChecklistItem,
} from '#components/task/task-checklist-test-fixtures'
import { assertDefined, focusDescriptionEditor } from '#lib/test-utils'

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
}: {
  checklists?: ComponentProps<typeof TaskChecklistList>['checklists']
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
  }

  render(<TaskChecklistList {...actions} checklists={checklists} />)
  return actions
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
        onCreateChecklist={() => {}}
        onUpdateChecklist={() => {}}
        onReorderChecklists={() => {}}
        onDeleteChecklist={() => {}}
        onCreateItem={() => {}}
        onUpdateItem={onUpdateItem}
        onDeleteItem={() => {}}
        onMoveItem={() => {}}
        onSetItemChecked={() => {}}
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
