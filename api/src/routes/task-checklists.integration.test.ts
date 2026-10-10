import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskChecklistItems, taskGithubLinks, taskLinks } from '#db/schema'
import {
  mockGithubIssueResponse,
  mockGithubPullResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import {
  createTask,
  type TaskListItemResponse,
  type TaskResponse,
  TEST_UUID,
  toListItemResponse,
} from '#routes/tasks/testing'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  vi.restoreAllMocks()
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
})

function watchChangeEvents(): ChangeEvent[] {
  const events: ChangeEvent[] = []
  stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))
  return events
}

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

async function setTaskStatus(taskId: string, status: 'todo' | 'completed') {
  return app.request(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

interface SummarizedItemTree {
  content: string
  note: string | null
  checked: boolean
  linkedToSubtask: boolean
  sortOrder: number
  children: SummarizedItemTree[]
}

function summarizeItemTree(item: ItemResponse): SummarizedItemTree {
  return {
    content: item.content,
    note: item.note,
    checked: item.checkedAt != null,
    linkedToSubtask: item.subtaskId != null,
    sortOrder: item.sortOrder,
    children: (item.children ?? []).map(summarizeItemTree),
  }
}

function summarizeTaskChecklists(
  checklists: Awaited<ReturnType<typeof checklistList>>,
) {
  return checklists.body.map(({ name, items }) => ({
    name,
    items: items.map(summarizeItemTree),
  }))
}

function summarizePromotionScenario(input: {
  promotionStatus: number
  promoted: NormalizedItem
  subtask: TaskResponse
  moved: Awaited<ReturnType<typeof checklistList>>
  afterPromotion: Awaited<ReturnType<typeof checklistList>>
}) {
  return {
    promotionStatus: input.promotionStatus,
    promoted: input.promoted,
    subtask: {
      title: input.subtask.title,
      description: input.subtask.description,
      status: input.subtask.status,
      parentId: input.subtask.parentId,
      context: input.subtask.context,
      labels: input.subtask.labels,
    },
    moved: summarizeTaskChecklists(input.moved),
    afterPromotion: summarizeTaskChecklists(input.afterPromotion),
  }
}

function summarizeCompleteScenario(input: {
  promotionStatus: number
  completionStatus: number
  checklists: Awaited<ReturnType<typeof checklistList>>
}) {
  return {
    promotionStatus: input.promotionStatus,
    completionStatus: input.completionStatus,
    checklists: summarizeTaskChecklists(input.checklists),
  }
}

function summarizeRepeatedPromotionScenario(input: {
  promotionStatus: number
  repeatedPromotion: { status: number; body: unknown }
}) {
  return {
    promotionStatus: input.promotionStatus,
    repeatedPromotion: input.repeatedPromotion,
  }
}

function summarizeStatusTransitionScenario(input: {
  promotionStatus: number
  completionStatus: number
  afterComplete: ReturnType<typeof summarizeTaskChecklists>
  reopeningStatus: number
  afterReopen: ReturnType<typeof summarizeTaskChecklists>
}) {
  return {
    promotionStatus: input.promotionStatus,
    completionStatus: input.completionStatus,
    afterComplete: input.afterComplete,
    reopeningStatus: input.reopeningStatus,
    afterReopen: input.afterReopen,
  }
}

function summarizeMovedSubtaskScenario(input: {
  promotionStatus: number
  movedSubtaskParentId: string | null
  movedChecklist: Awaited<ReturnType<typeof checklistList>>
}) {
  return {
    promotionStatus: input.promotionStatus,
    movedSubtaskParentId: input.movedSubtaskParentId,
    movedChecklist: summarizeTaskChecklists(input.movedChecklist),
  }
}

function summarizePromotedTaskMentions(input: {
  promotionStatus: number
  subtaskDescription: string | null
  outgoingTaskIds: string[]
}) {
  return {
    promotionStatus: input.promotionStatus,
    subtaskDescription: input.subtaskDescription,
    outgoingTaskIds: input.outgoingTaskIds,
  }
}

function summarizeGithubPromotionRejection(input: {
  linkStatus: number
  promotion: { status: number; body: unknown }
}) {
  return {
    linkStatus: input.linkStatus,
    promotion: input.promotion,
  }
}

async function summarizeJsonResponse(response: Response) {
  return { status: response.status, body: await response.json() }
}

async function summarizeTaskList(response: Response) {
  return {
    status: response.status,
    body: await jsonBody<TaskListItemResponse[]>(response),
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

async function summarizeGithubChecklistMutation(input: {
  status: number
  taskId: string
  checklistId: string
  itemId: string
  parentItemId?: string
  firstLinkStatus?: number
  initiallyChecked?: boolean
  responseBody?: unknown
}) {
  const [items, links] = await Promise.all([
    db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.checklistId, input.checklistId)),
    db
      .select()
      .from(taskGithubLinks)
      .where(eq(taskGithubLinks.taskId, input.taskId)),
  ])
  const item = items.find(({ id }) => id === input.itemId)
  const parent = items.find(({ id }) => id === input.parentItemId)

  return {
    status: input.status,
    firstLinkStatus: input.firstLinkStatus ?? null,
    initiallyChecked: input.initiallyChecked ?? null,
    responseBody: input.responseBody ?? null,
    itemChecked: item?.checkedAt != null,
    itemUsesTaskLink: links.length === 1 && item?.githubLinkId === links[0]?.id,
    itemSubtaskLinked: item?.subtaskId != null,
    parentChecked:
      input.parentItemId == null ? null : parent?.checkedAt != null,
    links: links.map(({ url, state }) => [url, state]),
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

    const response = await app.request(
      '/api/tasks?view=full&context=all&status=all&limit=unlimited',
    )
    expect(await summarizeTaskList(response)).toEqual({
      status: 200,
      body: [
        toListItemResponse(task, {
          checklistCompletionCount: { completed: 2, total: 3 },
        }),
      ],
    })
  })

  it('returns zero checklist progress when all checklists are empty', async () => {
    const task = await createTask('Empty checklist')
    await createChecklist(task.id, { name: 'No items' })

    const response = await app.request(
      '/api/tasks?view=full&context=all&status=all&limit=unlimited',
    )
    expect(await summarizeTaskList(response)).toEqual({
      status: 200,
      body: [toListItemResponse(task)],
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

  it('links an already merged pull request when creating an item and checks its parent', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const parent = await addItem(checklist.id, 'Build the feature')
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/57'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({
      html_url: githubUrl,
      pull_request: {},
      state: 'closed',
    })
    mockGithubPullResponse(true)

    const response = await app.request(
      `/api/checklists/${checklist.id}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Add the API route',
          parentItemId: parent.id,
          github: githubUrl,
        }),
      },
    )
    const body = await jsonBody<ItemResponse>(response)
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: body.id,
        parentItemId: parent.id,
        responseBody: normalizeItem(body),
      }),
    ).toEqual({
      status: 201,
      firstLinkStatus: null,
      initiallyChecked: null,
      responseBody: {
        id: 'ITEM',
        checklistId: 'CHECKLIST',
        parentItemId: 'ITEM',
        content: 'Add the API route',
        note: null,
        checkedAt: 'DATE',
        sortOrder: 0,
        githubLinkId: 'GITHUB_LINK',
        subtaskId: null,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        children: [],
      },
      itemChecked: true,
      itemUsesTaskLink: true,
      itemSubtaskLinked: false,
      parentChecked: true,
      links: [[githubUrl, 'merged']],
    })
  })

  it('keeps an existing merged link terminal when a stale open response is fetched', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Implement the feature')
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/59'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({
      html_url: githubUrl,
      pull_request: {},
      state: 'closed',
    })
    mockGithubPullResponse(true)

    const linkResponse = await app.request(
      `/api/tasks/${task.id}/github-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl }),
      },
    )
    mockGithubIssueResponse({
      html_url: githubUrl,
      pull_request: {},
      state: 'open',
    })

    const response = await app.request(`/api/checklist-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: githubUrl }),
    })
    const body = await jsonBody<ItemResponse>(response)
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: item.id,
        firstLinkStatus: linkResponse.status,
        responseBody: normalizeItem(body),
      }),
    ).toEqual({
      status: 200,
      firstLinkStatus: 201,
      initiallyChecked: null,
      responseBody: {
        id: 'ITEM',
        checklistId: 'CHECKLIST',
        parentItemId: null,
        content: 'Implement the feature',
        note: null,
        checkedAt: 'DATE',
        sortOrder: 0,
        githubLinkId: 'GITHUB_LINK',
        subtaskId: null,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        children: [],
      },
      itemChecked: true,
      itemUsesTaskLink: true,
      itemSubtaskLinked: false,
      parentChecked: null,
      links: [[githubUrl, 'merged']],
    })
  })

  it('clears a manual check when an open pull request is linked to an item', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Implement the feature')
    await setChecked(item.id, true)
    const beforeUpdate = await db.query.taskChecklistItems.findFirst({
      where: eq(taskChecklistItems.id, item.id),
    })
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/61'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: githubUrl, pull_request: {} })

    const response = await app.request(`/api/checklist-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: githubUrl }),
    })
    const body = await jsonBody<ItemResponse>(response)
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: item.id,
        initiallyChecked: beforeUpdate?.checkedAt != null,
        responseBody: normalizeItem(body),
      }),
    ).toEqual({
      status: 200,
      firstLinkStatus: null,
      initiallyChecked: true,
      responseBody: {
        id: 'ITEM',
        checklistId: 'CHECKLIST',
        parentItemId: null,
        content: 'Implement the feature',
        note: null,
        checkedAt: null,
        sortOrder: 0,
        githubLinkId: 'GITHUB_LINK',
        subtaskId: null,
        createdAt: 'DATE',
        updatedAt: 'DATE',
        children: [],
      },
      itemChecked: false,
      itemUsesTaskLink: true,
      itemSubtaskLinked: false,
      parentChecked: null,
      links: [[githubUrl, 'open']],
    })
  })

  it('rejects an issue URL as a checklist pull request link', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Implement the feature')

    const response = await app.request(`/api/checklist-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github: 'https://github.com/example-owner/example-repo/issues/64',
      }),
    })
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: item.id,
        responseBody: await response.json(),
      }),
    ).toEqual({
      status: 400,
      firstLinkStatus: null,
      initiallyChecked: null,
      responseBody: {
        error: 'Only GitHub pull requests can be linked to checklist items',
      },
      itemChecked: false,
      itemUsesTaskLink: false,
      itemSubtaskLinked: false,
      parentChecked: null,
      links: [],
    })
  })

  it('rejects a pull request URL when GitHub returns an issue', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Implement the feature')
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/67'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: githubUrl })

    const response = await app.request(`/api/checklist-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: githubUrl }),
    })
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: item.id,
        responseBody: await response.json(),
      }),
    ).toEqual({
      status: 400,
      firstLinkStatus: null,
      initiallyChecked: null,
      responseBody: {
        error: 'Only GitHub pull requests can be linked to checklist items',
      },
      itemChecked: false,
      itemUsesTaskLink: false,
      itemSubtaskLinked: false,
      parentChecked: null,
      links: [],
    })
  })

  it('rejects linking a parent checklist item to a pull request', async () => {
    const task = await createTask('Checklist task')
    const checklist = await createChecklist(task.id)
    const parent = await addItem(checklist.id, 'Build the feature')
    await addItem(checklist.id, 'Add the API route', {
      parentItemId: parent.id,
    })
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/69'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: githubUrl, pull_request: {} })

    const response = await app.request(`/api/checklist-items/${parent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: githubUrl }),
    })
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: parent.id,
        responseBody: await response.json(),
      }),
    ).toEqual({
      status: 400,
      firstLinkStatus: null,
      initiallyChecked: null,
      responseBody: {
        error:
          'Items with children or linked tasks cannot be linked to a pull request',
      },
      itemChecked: false,
      itemUsesTaskLink: false,
      itemSubtaskLinked: false,
      parentChecked: null,
      links: [],
    })
  })

  it('rejects linking a subtask checklist item to a pull request', async () => {
    const task = await createTask('Checklist task')
    const subtask = await createTask('Subtask', { parentId: task.id })
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Implement the feature')
    await db
      .update(taskChecklistItems)
      .set({ subtaskId: subtask.id })
      .where(eq(taskChecklistItems.id, item.id))
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/71'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: githubUrl, pull_request: {} })

    const response = await app.request(`/api/checklist-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: githubUrl }),
    })
    expect(
      await summarizeGithubChecklistMutation({
        status: response.status,
        taskId: task.id,
        checklistId: checklist.id,
        itemId: item.id,
        responseBody: await response.json(),
      }),
    ).toEqual({
      status: 400,
      firstLinkStatus: null,
      initiallyChecked: null,
      responseBody: {
        error:
          'Items with children or linked tasks cannot be linked to a pull request',
      },
      itemChecked: false,
      itemUsesTaskLink: false,
      itemSubtaskLinked: true,
      parentChecked: null,
      links: [],
    })
  })
  it('promotes an item and moves its descendants', async () => {
    const task = await createTask('Parent task', {
      context: 'work',
      labels: ['fixture-tag'],
    })
    const checklist = await createChecklist(task.id, { name: 'Milestones' })
    const group = await addItem(checklist.id, 'Release')
    const target = await addItem(checklist.id, 'Build feature', {
      note: 'Detailed steps',
      parentItemId: group.id,
    })
    const apiItem = await addItem(checklist.id, 'Write API', {
      parentItemId: target.id,
    })
    const backend = await addItem(checklist.id, 'Backend', {
      parentItemId: target.id,
    })
    const migration = await addItem(checklist.id, 'Write migration', {
      parentItemId: backend.id,
    })
    await setChecked(apiItem.id, true)
    await setChecked(migration.id, true)
    const peer = await addItem(checklist.id, 'Review feature', {
      parentItemId: group.id,
    })
    await setChecked(peer.id, true)

    const promotion = await app.request(
      `/api/checklist-items/${target.id}/promote`,
      { method: 'POST' },
    )
    const promotedRaw = await jsonBody<ItemResponse>(promotion)
    const subtaskId = promotedRaw.subtaskId
    assertDefined(subtaskId)
    const subtaskResponse = await app.request(`/api/tasks/${subtaskId}`)
    const subtask = await jsonBody<TaskResponse>(subtaskResponse)
    const moved = await checklistList(subtaskId)
    const afterPromotion = await checklistList(task.id)

    expect(
      summarizePromotionScenario({
        promotionStatus: promotion.status,
        promoted: normalizeItem(promotedRaw),
        subtask,
        moved,
        afterPromotion,
      }),
    ).toEqual({
      promotionStatus: 200,
      promoted: {
        id: 'ITEM',
        checklistId: 'CHECKLIST',
        parentItemId: 'ITEM',
        content: 'Build feature',
        note: 'Detailed steps',
        checkedAt: null,
        sortOrder: 0,
        githubLinkId: null,
        subtaskId: 'SUBTASK',
        createdAt: 'DATE',
        updatedAt: 'DATE',
        children: [],
      },
      subtask: {
        title: 'Build feature',
        description: 'Detailed steps',
        status: 'todo',
        parentId: task.id,
        context: 'work',
        labels: ['fixture-tag'],
      },
      moved: [
        {
          name: null,
          items: [
            {
              content: 'Write API',
              note: null,
              checked: true,
              linkedToSubtask: false,
              sortOrder: 0,
              children: [],
            },
            {
              content: 'Backend',
              note: null,
              checked: true,
              linkedToSubtask: false,
              sortOrder: 1,
              children: [
                {
                  content: 'Write migration',
                  note: null,
                  checked: true,
                  linkedToSubtask: false,
                  sortOrder: 0,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      afterPromotion: [
        {
          name: 'Milestones',
          items: [
            {
              content: 'Release',
              note: null,
              checked: false,
              linkedToSubtask: false,
              sortOrder: 0,
              children: [
                {
                  content: 'Build feature',
                  note: 'Detailed steps',
                  checked: false,
                  linkedToSubtask: true,
                  sortOrder: 0,
                  children: [],
                },
                {
                  content: 'Review feature',
                  note: null,
                  checked: true,
                  linkedToSubtask: false,
                  sortOrder: 1,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('rejects promoting an item that is already linked to a subtask', async () => {
    const task = await createTask('Parent task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Finish work')
    const promotion = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )
    const repeatedPromotion = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )

    expect(
      summarizeRepeatedPromotionScenario({
        promotionStatus: promotion.status,
        repeatedPromotion: await summarizeJsonResponse(repeatedPromotion),
      }),
    ).toEqual({
      promotionStatus: 200,
      repeatedPromotion: {
        status: 400,
        body: { error: 'Checklist item is already linked to a task' },
      },
    })
  })

  it('checks and unchecks the linked item when subtask status changes', async () => {
    const task = await createTask('Parent task')
    const checklist = await createChecklist(task.id)
    const parent = await addItem(checklist.id, 'Release')
    const item = await addItem(checklist.id, 'Finish work', {
      parentItemId: parent.id,
    })
    const promotion = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )
    const promoted = await jsonBody<ItemResponse>(promotion)
    const subtaskId = promoted.subtaskId
    assertDefined(subtaskId)

    const completed = await setTaskStatus(subtaskId, 'completed')
    const afterComplete = summarizeTaskChecklists(await checklistList(task.id))
    const reopened = await setTaskStatus(subtaskId, 'todo')
    const afterReopen = summarizeTaskChecklists(await checklistList(task.id))

    expect(
      summarizeStatusTransitionScenario({
        promotionStatus: promotion.status,
        completionStatus: completed.status,
        afterComplete,
        reopeningStatus: reopened.status,
        afterReopen,
      }),
    ).toEqual({
      promotionStatus: 200,
      completionStatus: 200,
      afterComplete: [
        {
          name: null,
          items: [
            {
              content: 'Release',
              note: null,
              checked: true,
              linkedToSubtask: false,
              sortOrder: 0,
              children: [
                {
                  content: 'Finish work',
                  note: null,
                  checked: true,
                  linkedToSubtask: true,
                  sortOrder: 0,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      reopeningStatus: 200,
      afterReopen: [
        {
          name: null,
          items: [
            {
              content: 'Release',
              note: null,
              checked: false,
              linkedToSubtask: false,
              sortOrder: 0,
              children: [
                {
                  content: 'Finish work',
                  note: null,
                  checked: false,
                  linkedToSubtask: true,
                  sortOrder: 0,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    })
  })

  it('reparents subtasks linked to moved checklist descendants', async () => {
    const task = await createTask('Parent task')
    const existingSubtask = await createTask('Nested task', {
      parentId: task.id,
    })
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Promote this work')
    const descendant = await addItem(checklist.id, 'Nested task', {
      parentItemId: item.id,
    })
    await db
      .update(taskChecklistItems)
      .set({ subtaskId: existingSubtask.id })
      .where(eq(taskChecklistItems.id, descendant.id))

    const promotion = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )
    const promoted = await jsonBody<ItemResponse>(promotion)
    const subtaskId = promoted.subtaskId
    assertDefined(subtaskId)
    const existingSubtaskResponse = await app.request(
      `/api/tasks/${existingSubtask.id}`,
    )
    const movedSubtask = await jsonBody<TaskResponse>(existingSubtaskResponse)

    expect(
      summarizeMovedSubtaskScenario({
        promotionStatus: promotion.status,
        movedSubtaskParentId: movedSubtask.parentId,
        movedChecklist: await checklistList(subtaskId),
      }),
    ).toEqual({
      promotionStatus: 200,
      movedSubtaskParentId: subtaskId,
      movedChecklist: [
        {
          name: null,
          items: [
            {
              content: 'Nested task',
              note: null,
              checked: false,
              linkedToSubtask: true,
              sortOrder: 0,
              children: [],
            },
          ],
        },
      ],
    })
  })

  it('syncs task mentions from the promoted item note', async () => {
    const task = await createTask('Parent task')
    const targetTask = await createTask('Mentioned task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Research', {
      note: `See #${String(targetTask.number)}`,
    })

    const promotion = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )
    const promoted = await jsonBody<ItemResponse>(promotion)
    const subtaskId = promoted.subtaskId
    assertDefined(subtaskId)
    const subtaskResponse = await app.request(`/api/tasks/${subtaskId}`)
    const subtask = await jsonBody<TaskResponse>(subtaskResponse)
    const links = await db
      .select({ targetTaskId: taskLinks.targetTaskId })
      .from(taskLinks)
      .where(eq(taskLinks.sourceTaskId, subtaskId))

    expect(
      summarizePromotedTaskMentions({
        promotionStatus: promotion.status,
        subtaskDescription: subtask.description,
        outgoingTaskIds: links.map(({ targetTaskId }) => targetTaskId),
      }),
    ).toEqual({
      promotionStatus: 200,
      subtaskDescription: `See #${String(targetTask.number)}`,
      outgoingTaskIds: [targetTask.id],
    })
  })

  it('checks the linked item when its subtask is completed through the complete route', async () => {
    const task = await createTask('Parent task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Finish work')
    const promotion = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )
    const promoted = await jsonBody<ItemResponse>(promotion)
    const subtaskId = promoted.subtaskId
    assertDefined(subtaskId)

    const completed = await app.request(`/api/tasks/${subtaskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const list = await checklistList(task.id)

    expect(
      summarizeCompleteScenario({
        promotionStatus: promotion.status,
        completionStatus: completed.status,
        checklists: list,
      }),
    ).toEqual({
      promotionStatus: 200,
      completionStatus: 200,
      checklists: [
        {
          name: null,
          items: [
            {
              content: 'Finish work',
              note: null,
              checked: true,
              linkedToSubtask: true,
              sortOrder: 0,
              children: [],
            },
          ],
        },
      ],
    })
  })

  it('rejects promoting an item linked to a pull request', async () => {
    const task = await createTask('Parent task')
    const checklist = await createChecklist(task.id)
    const item = await addItem(checklist.id, 'Wait for review')
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/1'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({
      html_url: githubUrl,
      pull_request: {},
      state: 'open',
    })
    const link = await app.request(`/api/checklist-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github: githubUrl }),
    })

    const response = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )

    expect(
      summarizeGithubPromotionRejection({
        linkStatus: link.status,
        promotion: await summarizeJsonResponse(response),
      }),
    ).toEqual({
      linkStatus: 200,
      promotion: {
        status: 400,
        body: {
          error: 'Checklist items linked to GitHub cannot be promoted',
        },
      },
    })
  })

  describe('change event task IDs', () => {
    it('includes the task ID when a checklist is created', async () => {
      const task = await createTask('Checklist task')
      const events = watchChangeEvents()

      await createChecklist(task.id)

      expect(events).toEqual([
        {
          resource: 'task',
          id: task.id,
          origin: null,
          taskIds: [task.id],
        },
      ])
    })

    it('includes the owning task when an item is added', async () => {
      const task = await createTask('Checklist task')
      const checklist = await createChecklist(task.id)
      const events = watchChangeEvents()

      await addItem(checklist.id, 'Checklist item')

      expect(events).toEqual([
        {
          resource: 'checklist',
          id: checklist.id,
          origin: null,
          taskIds: [task.id],
        },
      ])
    })

    it('includes the owning task when a checklist is updated', async () => {
      const task = await createTask('Checklist task')
      const checklist = await createChecklist(task.id)
      const events = watchChangeEvents()

      const response = await app.request(`/api/checklists/${checklist.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed checklist' }),
      })

      const snapshot = () => ({ status: response.status, events })

      expect(snapshot()).toEqual({
        status: 200,
        events: [
          {
            resource: 'checklist',
            id: checklist.id,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('includes the owner before deleting a checklist and its item cascade', async () => {
      const task = await createTask('Checklist task')
      const checklist = await createChecklist(task.id)
      const root = await addItem(checklist.id, 'Root item')
      await addItem(checklist.id, 'Nested item', { parentItemId: root.id })
      const events = watchChangeEvents()

      const response = await app.request(`/api/checklists/${checklist.id}`, {
        method: 'DELETE',
      })

      const snapshot = () => ({ status: response.status, events })

      expect(snapshot()).toEqual({
        status: 204,
        events: [
          {
            resource: 'checklist',
            id: checklist.id,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('includes the owner for item updates and leaf completion changes', async () => {
      const task = await createTask('Checklist task')
      const checklist = await createChecklist(task.id)
      const item = await addItem(checklist.id, 'Initial item')
      const events = watchChangeEvents()

      await app.request(`/api/checklist-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated item' }),
      })
      await setChecked(item.id, true)
      await setChecked(item.id, false)

      expect(events).toEqual([
        {
          resource: 'checklist_item',
          id: item.id,
          origin: null,
          taskIds: [task.id],
        },
        {
          resource: 'checklist_item',
          id: item.id,
          origin: null,
          taskIds: [task.id],
        },
        {
          resource: 'checklist_item',
          id: item.id,
          origin: null,
          taskIds: [task.id],
        },
      ])
    })

    it('includes the owner before deleting an item and its nested items', async () => {
      const task = await createTask('Checklist task')
      const checklist = await createChecklist(task.id)
      const root = await addItem(checklist.id, 'Root item')
      await addItem(checklist.id, 'Nested item', { parentItemId: root.id })
      const events = watchChangeEvents()

      const response = await app.request(`/api/checklist-items/${root.id}`, {
        method: 'DELETE',
      })

      const snapshot = () => ({ status: response.status, events })

      expect(snapshot()).toEqual({
        status: 204,
        events: [
          {
            resource: 'checklist_item',
            id: root.id,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('includes the single owner when an item moves between parent chains', async () => {
      const task = await createTask('Checklist task')
      const checklist = await createChecklist(task.id)
      const oldParent = await addItem(checklist.id, 'Old parent')
      const item = await addItem(checklist.id, 'Moved item', {
        parentItemId: oldParent.id,
      })
      const newParent = await addItem(checklist.id, 'New parent')
      const events = watchChangeEvents()

      const response = await app.request(
        `/api/checklist-items/${item.id}/move`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentItemId: newParent.id }),
        },
      )

      const snapshot = () => ({ status: response.status, events })

      expect(snapshot()).toEqual({
        status: 200,
        events: [
          {
            resource: 'checklist_item',
            id: item.id,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('includes a checklist owner when its promoted subtask changes status', async () => {
      const owner = await createTask('Checklist owner')
      const otherParent = await createTask('Other parent')
      const checklist = await createChecklist(owner.id)
      const item = await addItem(checklist.id, 'Promoted item')
      const promotion = await app.request(
        `/api/checklist-items/${item.id}/promote`,
        { method: 'POST' },
      )
      const promoted = await jsonBody<ItemResponse>(promotion)
      const subtaskId = promoted.subtaskId
      assertDefined(subtaskId)
      const reparent = await app.request(`/api/tasks/${subtaskId}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: otherParent.id }),
      })
      const events = watchChangeEvents()

      const response = await setTaskStatus(subtaskId, 'completed')

      const snapshot = () => ({
        promotionStatus: promotion.status,
        reparentStatus: reparent.status,
        status: response.status,
        events,
      })
      expect(snapshot()).toEqual({
        promotionStatus: 200,
        reparentStatus: 200,
        status: 200,
        events: [
          {
            resource: 'task',
            id: subtaskId,
            origin: null,
            taskIds: [subtaskId, otherParent.id, owner.id],
          },
        ],
      })
    })

    it('includes a checklist owner when its promoted subtask is deleted', async () => {
      const owner = await createTask('Checklist owner')
      const otherParent = await createTask('Other parent')
      const checklist = await createChecklist(owner.id)
      const item = await addItem(checklist.id, 'Promoted item')
      const promotion = await app.request(
        `/api/checklist-items/${item.id}/promote`,
        { method: 'POST' },
      )
      const promoted = await jsonBody<ItemResponse>(promotion)
      const subtaskId = promoted.subtaskId
      assertDefined(subtaskId)
      const reparent = await app.request(`/api/tasks/${subtaskId}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: otherParent.id }),
      })
      const events = watchChangeEvents()

      const response = await app.request(`/api/tasks/${subtaskId}`, {
        method: 'DELETE',
      })

      const snapshot = () => ({
        promotionStatus: promotion.status,
        reparentStatus: reparent.status,
        status: response.status,
        events,
      })
      expect(snapshot()).toEqual({
        promotionStatus: 200,
        reparentStatus: 200,
        status: 204,
        events: [
          {
            resource: 'task',
            id: subtaskId,
            origin: null,
            taskIds: [subtaskId, owner.id, otherParent.id],
          },
        ],
      })
    })

    it('includes parent, promoted subtask, and reparented descendant tasks', async () => {
      const task = await createTask('Parent task')
      const mentionedTask = await createTask('Mentioned task')
      const existingSubtask = await createTask('Existing child task', {
        parentId: task.id,
      })
      const checklist = await createChecklist(task.id)
      const item = await addItem(checklist.id, 'Promote item', {
        note: `See #${String(mentionedTask.number)}`,
      })
      const descendant = await addItem(checklist.id, 'Linked child item', {
        parentItemId: item.id,
      })
      await db
        .update(taskChecklistItems)
        .set({ subtaskId: existingSubtask.id })
        .where(eq(taskChecklistItems.id, descendant.id))
      const events = watchChangeEvents()

      const response = await app.request(
        `/api/checklist-items/${item.id}/promote`,
        { method: 'POST' },
      )
      const promoted = await jsonBody<ItemResponse>(response)
      assertDefined(promoted.subtaskId)

      const snapshot = () => ({ status: response.status, events })

      expect(snapshot()).toEqual({
        status: 200,
        events: [
          {
            resource: 'checklist_item',
            id: item.id,
            origin: null,
            taskIds: [
              task.id,
              existingSubtask.id,
              mentionedTask.id,
              promoted.subtaskId,
            ].sort(),
          },
        ],
      })
    })
  })
})
