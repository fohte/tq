import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskChecklistItems } from '#db/schema'
import type { TaskListItemResponse, TaskResponse } from '#routes/tasks/testing'
import {
  createTask,
  TEST_UUID,
  toListItemResponse,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface ItemResponse {
  id: string
  checklistId: string
  parentItemId: string | null
  content: string
  note: string | null
  checkedAt: string | null
  sortOrder: number
  githubLinkId: string | null
  subtaskId: string | null
  createdAt: string
  updatedAt: string
  children?: ItemResponse[]
}

interface ChecklistResponse {
  id: string
  taskId: string
  name: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  items: ItemResponse[]
}

interface NormalizedItem {
  id: string
  checklistId: string
  parentItemId: string | null
  content: string
  note: string | null
  checkedAt: string | null
  sortOrder: number
  githubLinkId: string | null
  subtaskId: string | null
  createdAt: string
  updatedAt: string
  children: NormalizedItem[]
}

function normalizeItem(item: ItemResponse): NormalizedItem {
  return {
    id: 'ITEM',
    checklistId: 'CHECKLIST',
    parentItemId: item.parentItemId == null ? null : 'ITEM',
    content: item.content,
    note: item.note,
    checkedAt: item.checkedAt == null ? null : 'DATE',
    sortOrder: item.sortOrder,
    githubLinkId: item.githubLinkId == null ? null : 'GITHUB_LINK',
    subtaskId: item.subtaskId == null ? null : 'SUBTASK',
    createdAt: 'DATE',
    updatedAt: 'DATE',
    children: (item.children ?? []).map(normalizeItem),
  }
}

function normalizeChecklist(checklist: ChecklistResponse) {
  return {
    id: 'CHECKLIST',
    taskId: checklist.taskId,
    name: checklist.name,
    sortOrder: checklist.sortOrder,
    createdAt: 'DATE',
    updatedAt: 'DATE',
    items: checklist.items.map(normalizeItem),
  }
}

async function createChecklist(
  taskId: string,
  fields: { name?: string | null; sortOrder?: number } = {},
) {
  const response = await app.request(`/api/tasks/${taskId}/checklists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (response.status !== 201) {
    throw new Error(`Failed to create checklist: ${await response.text()}`)
  }
  return jsonBody<{ id: string }>(response)
}

async function addItem(
  checklistId: string,
  content: string,
  fields: {
    note?: string | null
    parentItemId?: string | null
    sortOrder?: number
  } = {},
) {
  const response = await app.request(`/api/checklists/${checklistId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...fields }),
  })
  if (response.status !== 201) {
    throw new Error(`Failed to add checklist item: ${await response.text()}`)
  }
  return jsonBody<{ id: string }>(response)
}

async function checklistList(taskId: string) {
  const response = await app.request(`/api/tasks/${taskId}/checklists`)
  return {
    status: response.status,
    body: (await jsonBody<ChecklistResponse[]>(response)).map(
      normalizeChecklist,
    ),
  }
}

async function summarizeChecklistItemOrder(taskId: string) {
  const list = await checklistList(taskId)
  return {
    status: list.status,
    items: list.body.flatMap((checklist) =>
      checklist.items.map(({ content, sortOrder }) => ({ content, sortOrder })),
    ),
  }
}

async function itemMutation(response: Response) {
  return {
    status: response.status,
    body: normalizeItem(await jsonBody<ItemResponse>(response)),
  }
}

async function setChecked(itemId: string, checked: boolean) {
  return app.request(
    `/api/checklist-items/${itemId}/${checked ? 'check' : 'uncheck'}`,
    { method: 'POST' },
  )
}

async function summarizeJsonResponse(response: Response) {
  return { status: response.status, body: await response.json() }
}

async function summarizeTaskListRow(response: Response, taskId: string) {
  const rows = await jsonBody<TaskListItemResponse[]>(response)
  return {
    status: response.status,
    task: rows.find((row) => row.id === taskId),
  }
}

async function summarizeTaskDetail(response: Response) {
  const detail = await jsonBody<TaskResponse>(response)
  return {
    status: response.status,
    checklistCompletionCount: detail.checklistCompletionCount,
    checklists: detail.checklists?.map(normalizeChecklist),
  }
}

async function summarizeChecklistDeletion(response: Response, taskId: string) {
  return {
    status: response.status,
    body: await response.text(),
    remaining: await checklistList(taskId),
  }
}

async function summarizeChecklistUpdate(
  response: Response,
  updated: ChecklistResponse,
  taskId: string,
) {
  return {
    update: {
      status: response.status,
      body: normalizeChecklist({ ...updated, items: [] }),
    },
    list: await checklistList(taskId),
  }
}

function summarizeItemTreeUpdate(
  response: Response,
  list: Awaited<ReturnType<typeof checklistList>>,
) {
  return { status: response.status, list }
}

function summarizeCheckTransitions(
  checked: Awaited<ReturnType<typeof itemMutation>>,
  allChecked: Awaited<ReturnType<typeof checklistList>>,
  unchecked: Awaited<ReturnType<typeof itemMutation>>,
  allUnchecked: Awaited<ReturnType<typeof checklistList>>,
) {
  return { checked, allChecked, unchecked, allUnchecked }
}

function summarizeParentRecalculation(
  deleted: Response,
  afterAdd: Awaited<ReturnType<typeof checklistList>>,
  afterDelete: Awaited<ReturnType<typeof checklistList>>,
) {
  return {
    deletedStatus: deleted.status,
    afterAdd: afterAdd.body[0]?.items[0]?.checkedAt,
    afterDelete: afterDelete.body[0]?.items[0]?.checkedAt,
  }
}

async function summarizeItemMove(
  response: Response,
  list: Awaited<ReturnType<typeof checklistList>>,
) {
  return { moved: await itemMutation(response), list }
}

function summarizeFirstMove(
  response: Response,
  order: Awaited<ReturnType<typeof summarizeChecklistItemOrder>>,
) {
  return { status: response.status, order }
}

describe('task checklists API', () => {
  it('lists checklists by task number and returns an empty list for a new task', async () => {
    const task = await createTask('Checklist task')

    expect(await checklistList(String(task.number))).toEqual({
      status: 200,
      body: [],
    })
  })

  it('returns not found for an unknown task', async () => {
    const response = await app.request(`/api/tasks/${TEST_UUID}/checklists`)

    expect(await summarizeJsonResponse(response)).toEqual({
      status: 404,
      body: { error: 'Task not found' },
    })
  })

  it('returns checklist progress for leaf items on task list rows', async () => {
    const task = await createTask('Checklist progress')
    const firstChecklist = await createChecklist(task.id, { name: 'Build' })
    await createChecklist(task.id, { name: 'Empty' })
    const parent = await addItem(firstChecklist.id, 'Implementation')
    const checkedLeaf = await addItem(firstChecklist.id, 'Write docs', {
      parentItemId: parent.id,
    })
    const nestedParent = await addItem(firstChecklist.id, 'Validation', {
      parentItemId: parent.id,
    })
    await addItem(firstChecklist.id, 'Add tests', {
      parentItemId: nestedParent.id,
    })
    const secondChecklist = await createChecklist(task.id, { name: 'Review' })
    const secondCheckedLeaf = await addItem(secondChecklist.id, 'Review diff')
    await setChecked(checkedLeaf.id, true)
    await setChecked(secondCheckedLeaf.id, true)

    const response = await app.request('/api/tasks')
    expect(await summarizeTaskListRow(response, task.id)).toEqual({
      status: 200,
      task: toListItemResponse(task, {
        checklistCompletionCount: { completed: 2, total: 3 },
      }),
    })
  })

  it('returns zero checklist progress when all checklists are empty', async () => {
    const task = await createTask('Empty checklist')
    await createChecklist(task.id, { name: 'No items' })

    const response = await app.request('/api/tasks')
    expect(await summarizeTaskListRow(response, task.id)).toEqual({
      status: 200,
      task: toListItemResponse(task),
    })
  })

  it('returns checklists and leaf progress in task detail', async () => {
    const task = await createTask('Checklist detail')
    const firstChecklist = await createChecklist(task.id, { name: 'Build' })
    const parent = await addItem(firstChecklist.id, 'Implementation')
    const checkedLeaf = await addItem(firstChecklist.id, 'Write docs', {
      parentItemId: parent.id,
    })
    const nestedParent = await addItem(firstChecklist.id, 'Validation', {
      parentItemId: parent.id,
    })
    await addItem(firstChecklist.id, 'Add tests', {
      parentItemId: nestedParent.id,
    })
    const secondChecklist = await createChecklist(task.id, { name: 'Review' })
    const secondCheckedLeaf = await addItem(secondChecklist.id, 'Review diff')
    await createChecklist(task.id, { name: 'Later' })
    await setChecked(checkedLeaf.id, true)
    await setChecked(secondCheckedLeaf.id, true)

    const response = await app.request(`/api/tasks/${String(task.number)}`)
    expect(await summarizeTaskDetail(response)).toEqual({
      status: 200,
      checklistCompletionCount: { completed: 2, total: 3 },
      checklists: [
        {
          id: 'CHECKLIST',
          taskId: task.id,
          name: 'Build',
          sortOrder: 0,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          items: [
            {
              id: 'ITEM',
              checklistId: 'CHECKLIST',
              parentItemId: null,
              content: 'Implementation',
              note: null,
              checkedAt: null,
              sortOrder: 0,
              githubLinkId: null,
              subtaskId: null,
              createdAt: 'DATE',
              updatedAt: 'DATE',
              children: [
                {
                  id: 'ITEM',
                  checklistId: 'CHECKLIST',
                  parentItemId: 'ITEM',
                  content: 'Write docs',
                  note: null,
                  checkedAt: 'DATE',
                  sortOrder: 0,
                  githubLinkId: null,
                  subtaskId: null,
                  createdAt: 'DATE',
                  updatedAt: 'DATE',
                  children: [],
                },
                {
                  id: 'ITEM',
                  checklistId: 'CHECKLIST',
                  parentItemId: 'ITEM',
                  content: 'Validation',
                  note: null,
                  checkedAt: null,
                  sortOrder: 1,
                  githubLinkId: null,
                  subtaskId: null,
                  createdAt: 'DATE',
                  updatedAt: 'DATE',
                  children: [
                    {
                      id: 'ITEM',
                      checklistId: 'CHECKLIST',
                      parentItemId: 'ITEM',
                      content: 'Add tests',
                      note: null,
                      checkedAt: null,
                      sortOrder: 0,
                      githubLinkId: null,
                      subtaskId: null,
                      createdAt: 'DATE',
                      updatedAt: 'DATE',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'CHECKLIST',
          taskId: task.id,
          name: 'Review',
          sortOrder: 1,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          items: [
            {
              id: 'ITEM',
              checklistId: 'CHECKLIST',
              parentItemId: null,
              content: 'Review diff',
              note: null,
              checkedAt: 'DATE',
              sortOrder: 0,
              githubLinkId: null,
              subtaskId: null,
              createdAt: 'DATE',
              updatedAt: 'DATE',
              children: [],
            },
          ],
        },
        {
          id: 'CHECKLIST',
          taskId: task.id,
          name: 'Later',
          sortOrder: 2,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          items: [],
        },
      ],
    })
  })

  it('updates checklist names and order reflected in the tree listing', async () => {
    const task = await createTask('Checklist task')
    await createChecklist(task.id, { name: 'Setup' })
    const second = await createChecklist(task.id, { name: 'Release' })

    const update = await app.request(`/api/checklists/${second.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Review', sortOrder: 0 }),
    })
    const updated = await jsonBody<ChecklistResponse>(update)
    expect(await summarizeChecklistUpdate(update, updated, task.id)).toEqual({
      update: {
        status: 200,
        body: {
          id: 'CHECKLIST',
          taskId: task.id,
          name: 'Review',
          sortOrder: 0,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          items: [],
        },
      },
      list: {
        status: 200,
        body: [
          {
            id: 'CHECKLIST',
            taskId: task.id,
            name: 'Review',
            sortOrder: 0,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            items: [],
          },
          {
            id: 'CHECKLIST',
            taskId: task.id,
            name: 'Setup',
            sortOrder: 1,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            items: [],
          },
        ],
      },
    })
  })

  it('deletes a checklist and cascades to its nested items', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const root = await addItem(checklist.id, 'Root')
    await addItem(checklist.id, 'Child', { parentItemId: root.id })

    const deleted = await app.request(`/api/checklists/${checklist.id}`, {
      method: 'DELETE',
    })

    expect(await summarizeChecklistDeletion(deleted, task.id)).toEqual({
      status: 204,
      body: '',
      remaining: { status: 200, body: [] },
    })
  })

  it('places new items at a clamped sortOrder and shifts sibling positions', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    await addItem(checklist.id, 'First')
    await addItem(checklist.id, 'Second')
    await addItem(checklist.id, 'Inserted first', { sortOrder: -1 })
    await addItem(checklist.id, 'Inserted last', { sortOrder: 100 })

    expect(await summarizeChecklistItemOrder(task.id)).toEqual({
      status: 200,
      items: [
        { content: 'Inserted first', sortOrder: 0 },
        { content: 'First', sortOrder: 1 },
        { content: 'Second', sortOrder: 2 },
        { content: 'Inserted last', sortOrder: 3 },
      ],
    })
  })

  it('returns nested items as a tree and updates content and Markdown detail', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id, { name: 'Build' })
    const root = await addItem(checklist.id, 'Create endpoint', {
      note: 'Initial detail',
    })
    await addItem(checklist.id, 'Write route', {
      parentItemId: root.id,
      note: 'Route detail',
    })
    const update = await app.request(`/api/checklist-items/${root.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Add endpoint', note: null }),
    })
    const listed = await checklistList(task.id)

    expect(summarizeItemTreeUpdate(update, listed)).toEqual({
      status: 200,
      list: {
        status: 200,
        body: [
          {
            id: 'CHECKLIST',
            taskId: task.id,
            name: 'Build',
            sortOrder: 0,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            items: [
              {
                id: 'ITEM',
                checklistId: 'CHECKLIST',
                parentItemId: null,
                content: 'Add endpoint',
                note: null,
                checkedAt: null,
                sortOrder: 0,
                githubLinkId: null,
                subtaskId: null,
                createdAt: 'DATE',
                updatedAt: 'DATE',
                children: [
                  {
                    id: 'ITEM',
                    checklistId: 'CHECKLIST',
                    parentItemId: 'ITEM',
                    content: 'Write route',
                    note: 'Route detail',
                    checkedAt: null,
                    sortOrder: 0,
                    githubLinkId: null,
                    subtaskId: null,
                    createdAt: 'DATE',
                    updatedAt: 'DATE',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  it('checks and unchecks ancestors through an unlimited item depth', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const root = await addItem(checklist.id, 'Root')
    const parent = await addItem(checklist.id, 'Parent', {
      parentItemId: root.id,
    })
    const leaf = await addItem(checklist.id, 'Leaf', {
      parentItemId: parent.id,
    })

    const checked = await itemMutation(await setChecked(leaf.id, true))
    const allChecked = await checklistList(task.id)
    const unchecked = await itemMutation(await setChecked(leaf.id, false))
    const allUnchecked = await checklistList(task.id)

    expect(
      summarizeCheckTransitions(checked, allChecked, unchecked, allUnchecked),
    ).toEqual({
      checked: {
        status: 200,
        body: {
          id: 'ITEM',
          checklistId: 'CHECKLIST',
          parentItemId: 'ITEM',
          content: 'Leaf',
          note: null,
          checkedAt: 'DATE',
          sortOrder: 0,
          githubLinkId: null,
          subtaskId: null,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          children: [],
        },
      },
      allChecked: {
        status: 200,
        body: [
          {
            id: 'CHECKLIST',
            taskId: task.id,
            name: null,
            sortOrder: 0,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            items: [
              {
                id: 'ITEM',
                checklistId: 'CHECKLIST',
                parentItemId: null,
                content: 'Root',
                note: null,
                checkedAt: 'DATE',
                sortOrder: 0,
                githubLinkId: null,
                subtaskId: null,
                createdAt: 'DATE',
                updatedAt: 'DATE',
                children: [
                  {
                    id: 'ITEM',
                    checklistId: 'CHECKLIST',
                    parentItemId: 'ITEM',
                    content: 'Parent',
                    note: null,
                    checkedAt: 'DATE',
                    sortOrder: 0,
                    githubLinkId: null,
                    subtaskId: null,
                    createdAt: 'DATE',
                    updatedAt: 'DATE',
                    children: [
                      {
                        id: 'ITEM',
                        checklistId: 'CHECKLIST',
                        parentItemId: 'ITEM',
                        content: 'Leaf',
                        note: null,
                        checkedAt: 'DATE',
                        sortOrder: 0,
                        githubLinkId: null,
                        subtaskId: null,
                        createdAt: 'DATE',
                        updatedAt: 'DATE',
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      unchecked: {
        status: 200,
        body: {
          id: 'ITEM',
          checklistId: 'CHECKLIST',
          parentItemId: 'ITEM',
          content: 'Leaf',
          note: null,
          checkedAt: null,
          sortOrder: 0,
          githubLinkId: null,
          subtaskId: null,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          children: [],
        },
      },
      allUnchecked: {
        status: 200,
        body: [
          {
            id: 'CHECKLIST',
            taskId: task.id,
            name: null,
            sortOrder: 0,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            items: [
              {
                id: 'ITEM',
                checklistId: 'CHECKLIST',
                parentItemId: null,
                content: 'Root',
                note: null,
                checkedAt: null,
                sortOrder: 0,
                githubLinkId: null,
                subtaskId: null,
                createdAt: 'DATE',
                updatedAt: 'DATE',
                children: [
                  {
                    id: 'ITEM',
                    checklistId: 'CHECKLIST',
                    parentItemId: 'ITEM',
                    content: 'Parent',
                    note: null,
                    checkedAt: null,
                    sortOrder: 0,
                    githubLinkId: null,
                    subtaskId: null,
                    createdAt: 'DATE',
                    updatedAt: 'DATE',
                    children: [
                      {
                        id: 'ITEM',
                        checklistId: 'CHECKLIST',
                        parentItemId: 'ITEM',
                        content: 'Leaf',
                        note: null,
                        checkedAt: null,
                        sortOrder: 0,
                        githubLinkId: null,
                        subtaskId: null,
                        createdAt: 'DATE',
                        updatedAt: 'DATE',
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  it('recalculates a checked parent when an unchecked child is added or deleted', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const parent = await addItem(checklist.id, 'Parent')
    const checkedChild = await addItem(checklist.id, 'Checked child', {
      parentItemId: parent.id,
    })
    await setChecked(checkedChild.id, true)

    const addedChild = await addItem(checklist.id, 'New child', {
      parentItemId: parent.id,
    })
    const afterAdd = await checklistList(task.id)
    const deleted = await app.request(`/api/checklist-items/${addedChild.id}`, {
      method: 'DELETE',
    })
    const afterDelete = await checklistList(task.id)

    expect(
      summarizeParentRecalculation(deleted, afterAdd, afterDelete),
    ).toEqual({
      deletedStatus: 204,
      afterAdd: null,
      afterDelete: 'DATE',
    })
  })

  it('recalculates both affected parent chains after an item moves', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const oldParent = await addItem(checklist.id, 'Old parent')
    const oldChecked = await addItem(checklist.id, 'Old checked', {
      parentItemId: oldParent.id,
    })
    const oldUnchecked = await addItem(checklist.id, 'Old unchecked', {
      parentItemId: oldParent.id,
    })
    const newParent = await addItem(checklist.id, 'New parent')
    const newChecked = await addItem(checklist.id, 'New checked', {
      parentItemId: newParent.id,
    })
    await setChecked(oldChecked.id, true)
    await setChecked(newChecked.id, true)

    const moved = await app.request(
      `/api/checklist-items/${oldUnchecked.id}/move`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentItemId: newParent.id,
          afterItemId: newChecked.id,
        }),
      },
    )
    const listed = await checklistList(task.id)

    expect(await summarizeItemMove(moved, listed)).toEqual({
      moved: {
        status: 200,
        body: {
          id: 'ITEM',
          checklistId: 'CHECKLIST',
          parentItemId: 'ITEM',
          content: 'Old unchecked',
          note: null,
          checkedAt: null,
          sortOrder: 1,
          githubLinkId: null,
          subtaskId: null,
          createdAt: 'DATE',
          updatedAt: 'DATE',
          children: [],
        },
      },
      list: {
        status: 200,
        body: [
          {
            id: 'CHECKLIST',
            taskId: task.id,
            name: null,
            sortOrder: 0,
            createdAt: 'DATE',
            updatedAt: 'DATE',
            items: [
              {
                id: 'ITEM',
                checklistId: 'CHECKLIST',
                parentItemId: null,
                content: 'Old parent',
                note: null,
                checkedAt: 'DATE',
                sortOrder: 0,
                githubLinkId: null,
                subtaskId: null,
                createdAt: 'DATE',
                updatedAt: 'DATE',
                children: [
                  {
                    id: 'ITEM',
                    checklistId: 'CHECKLIST',
                    parentItemId: 'ITEM',
                    content: 'Old checked',
                    note: null,
                    checkedAt: 'DATE',
                    sortOrder: 0,
                    githubLinkId: null,
                    subtaskId: null,
                    createdAt: 'DATE',
                    updatedAt: 'DATE',
                    children: [],
                  },
                ],
              },
              {
                id: 'ITEM',
                checklistId: 'CHECKLIST',
                parentItemId: null,
                content: 'New parent',
                note: null,
                checkedAt: null,
                sortOrder: 1,
                githubLinkId: null,
                subtaskId: null,
                createdAt: 'DATE',
                updatedAt: 'DATE',
                children: [
                  {
                    id: 'ITEM',
                    checklistId: 'CHECKLIST',
                    parentItemId: 'ITEM',
                    content: 'New checked',
                    note: null,
                    checkedAt: 'DATE',
                    sortOrder: 0,
                    githubLinkId: null,
                    subtaskId: null,
                    createdAt: 'DATE',
                    updatedAt: 'DATE',
                    children: [],
                  },
                  {
                    id: 'ITEM',
                    checklistId: 'CHECKLIST',
                    parentItemId: 'ITEM',
                    content: 'Old unchecked',
                    note: null,
                    checkedAt: null,
                    sortOrder: 1,
                    githubLinkId: null,
                    subtaskId: null,
                    createdAt: 'DATE',
                    updatedAt: 'DATE',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    })
  })

  it('moves a sibling to the first position', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    await addItem(checklist.id, 'First')
    await addItem(checklist.id, 'Second')
    const last = await addItem(checklist.id, 'Last')

    const moved = await app.request(`/api/checklist-items/${last.id}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afterItemId: null }),
    })

    expect(
      summarizeFirstMove(moved, await summarizeChecklistItemOrder(task.id)),
    ).toEqual({
      status: 200,
      order: {
        status: 200,
        items: [
          { content: 'Last', sortOrder: 0 },
          { content: 'First', sortOrder: 1 },
          { content: 'Second', sortOrder: 2 },
        ],
      },
    })
  })

  it('rejects a parent from another checklist', async () => {
    const task = await createTask('Checklist task')
    const firstChecklist = await createChecklist(task.id)
    const secondChecklist = await createChecklist(task.id)
    const parent = await addItem(firstChecklist.id, 'Parent')

    const response = await app.request(
      `/api/checklists/${secondChecklist.id}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Invalid child',
          parentItemId: parent.id,
        }),
      },
    )

    expect(await summarizeJsonResponse(response)).toEqual({
      status: 400,
      body: { error: 'Parent item must belong to the same checklist' },
    })
  })

  it('rejects a move that would create a cycle', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const parent = await addItem(checklist.id, 'Parent')
    const child = await addItem(checklist.id, 'Child', {
      parentItemId: parent.id,
    })

    const response = await app.request(
      `/api/checklist-items/${parent.id}/move`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentItemId: child.id }),
      },
    )

    expect(await summarizeJsonResponse(response)).toEqual({
      status: 400,
      body: { error: 'Moving this item would create a cycle' },
    })
  })

  it('rejects manual checking of a subtask-linked item', async () => {
    const task = await createTask('Checklist task')
    const subtask = await createTask('Subtask', { parentId: task.id })
    const checklist = await createChecklist(task.id)
    const linked = await addItem(checklist.id, 'Linked')
    await db
      .update(taskChecklistItems)
      .set({ subtaskId: subtask.id })
      .where(eq(taskChecklistItems.id, linked.id))

    const response = await setChecked(linked.id, true)

    expect(await summarizeJsonResponse(response)).toEqual({
      status: 400,
      body: {
        error:
          'Items with children or linked tasks or pull requests cannot be checked manually',
      },
    })
  })

  it('rejects children for a subtask-linked item', async () => {
    const task = await createTask('Checklist task')
    const subtask = await createTask('Subtask', { parentId: task.id })
    const checklist = await createChecklist(task.id)
    const linked = await addItem(checklist.id, 'Linked')
    await db
      .update(taskChecklistItems)
      .set({ subtaskId: subtask.id })
      .where(eq(taskChecklistItems.id, linked.id))

    const response = await app.request(
      `/api/checklists/${checklist.id}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Child', parentItemId: linked.id }),
      },
    )

    expect(await summarizeJsonResponse(response)).toEqual({
      status: 400,
      body: {
        error: 'Items with linked tasks or pull requests cannot have children',
      },
    })
  })
})
