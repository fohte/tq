import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { asc, eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { dbContext } from '#db/context'
import * as schema from '#db/schema'
import {
  projectFields,
  projects,
  recurrenceRules,
  recurringTaskTemplates,
  taskFieldValues,
  taskRelations,
  tasks,
} from '#db/schema'
import { DATABASE_URL } from '#env'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import {
  type TaskListItemResponse,
  type TaskResponse,
  toListItemResponse,
  toListRowResponse,
} from '#routes/tasks/testing'
import { generateDueRecurringTasks } from '#services/recurring-task-generator'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function createProject(title: string) {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (response.status !== 201) {
    throw new Error(`Project creation failed: ${await response.text()}`)
  }
  return jsonBody<{ id: string }>(response)
}

async function createField(projectId: string, name: string, options: string[]) {
  const response = await app.request(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, options }),
  })
  if (response.status !== 201) {
    throw new Error(`Field creation failed: ${await response.text()}`)
  }
  return jsonBody<{
    id: string
    name: string
    options: Array<{ id: string; name: string }>
  }>(response)
}

async function requestJson(path: string, method: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function requestJsonWithDb(
  database: typeof db,
  path: string,
  method: string,
  body: unknown,
) {
  return dbContext.run(database, () => requestJson(path, method, body))
}

async function createIsolatedTestDatabase() {
  const databaseName = `tq_field_value_race_${randomUUID().replaceAll('-', '')}`
  const adminClient = postgres(DATABASE_URL, { max: 1 })
  let client: ReturnType<typeof postgres> | undefined
  try {
    await adminClient.unsafe(`CREATE DATABASE "${databaseName}"`)
    const databaseUrl = new URL(DATABASE_URL)
    databaseUrl.pathname = `/${databaseName}`
    client = postgres(databaseUrl.toString(), { max: 1 })
    const database = drizzle(client, { schema })
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL('../../../drizzle', import.meta.url),
      ),
    })

    return { databaseName, adminClient, client, database }
  } catch (error) {
    await client?.end()
    await adminClient
      .unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
      .catch(() => undefined)
    await adminClient.end()
    throw error
  }
}

function connectToIsolatedTestDatabase(
  databaseName: string,
  applicationName?: string,
) {
  const databaseUrl = new URL(DATABASE_URL)
  databaseUrl.pathname = `/${databaseName}`
  return postgres(databaseUrl.toString(), {
    max: 1,
    connection: {
      ...(applicationName === undefined
        ? {}
        : { application_name: applicationName }),
    },
  })
}

async function dropIsolatedTestDatabase(
  isolated: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
) {
  try {
    await isolated.adminClient.unsafe(
      `DROP DATABASE IF EXISTS "${isolated.databaseName}" WITH (FORCE)`,
    )
  } finally {
    await isolated.adminClient.end()
  }
}

type TaskResponseInput = {
  title: string
  projectId?: string | null
  fieldValues?: TaskResponse['fieldValues']
  description?: string | null
  status?: TaskResponse['status']
  statusReason?: TaskResponse['statusReason']
  parentId?: string | null
}

function expectedTaskResponse(input: TaskResponseInput): TaskResponse {
  return {
    id: 'TASK_ID',
    number: -1,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? 'todo',
    statusReason: input.statusReason ?? null,
    context: 'personal',
    priority: null,
    labels: [],
    fieldValues: input.fieldValues ?? [],
    startDate: null,
    dueDate: null,
    remindAt: null,
    parentId: input.parentId ?? null,
    projectId: input.projectId ?? null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    templateId: null,
    occurrenceDate: null,
    githubLinks: [],
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

function expectedTaskWriteResponse(
  input: TaskResponseInput,
  includeLinkSync = false,
) {
  return {
    ...expectedTaskResponse(input),
    blockedByGithubRefs: [],
    ...(includeLinkSync ? { linkSync: { added: [], unresolvedRefs: [] } } : {}),
  }
}

function expectedTaskDetailResponse(
  input: TaskResponseInput & {
    parentNumber?: number | null
    parentTitle?: string | null
  },
) {
  return {
    ...expectedTaskResponse(input),
    titleAuthor: { kind: 'human', agent: null },
    descriptionAuthor: { kind: 'human', agent: null },
    parentNumber: input.parentNumber ?? null,
    parentTitle: input.parentTitle ?? null,
    childCompletionCount: { total: 0, completed: 0 },
    pages: [],
    timeBlocks: [],
    links: { outgoing: [], incoming: [] },
    duplicateOfNumber: null,
    duplicateOfTask: null,
    blockedBy: [],
    blocking: [],
    githubBlockers: [],
    blockedByGithubRefs: [],
    checklistCompletionCount: { total: 0, completed: 0 },
    checklists: [],
  }
}

function normalizeTaskResponse<
  T extends {
    id: string
    number: number
    createdAt: string
    updatedAt: string
  },
>(task: T) {
  return {
    ...task,
    id: 'TASK_ID',
    number: -1,
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

function normalizeTaskDetailResponse(task: TaskResponse) {
  return {
    ...normalizeTaskResponse(task),
    parentId: task.parentId === null ? null : 'PARENT_ID',
    ...(task.parentNumber === undefined
      ? {}
      : {
          parentNumber: task.parentNumber === null ? null : -1,
        }),
  }
}

function expectedTaskListItem(input: TaskResponseInput) {
  return toListItemResponse(expectedTaskResponse(input))
}

function expectedTaskListRow(input: TaskResponseInput) {
  return toListRowResponse(expectedTaskResponse(input))
}

function responseSnapshot<T>(status: number, body: T) {
  return { status, body }
}

describe('task field values API', () => {
  it('does not copy parent field values to a checklist subtask', async () => {
    const project = await createProject('Sample Observatory')
    const field = await createField(project.id, 'Signal Phase', ['Early Arc'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')

    const parentResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: { [field.id]: option.id },
    })
    const parent = await jsonBody<{ id: string }>(parentResponse)
    const checklistResponse = await requestJson(
      `/api/tasks/${parent.id}/checklists`,
      'POST',
      {},
    )
    const checklist = await jsonBody<{ id: string }>(checklistResponse)
    const itemResponse = await requestJson(
      `/api/checklists/${checklist.id}/items`,
      'POST',
      { content: 'Inspect the signal' },
    )
    const item = await jsonBody<{ id: string }>(itemResponse)
    const promotionResponse = await app.request(
      `/api/checklist-items/${item.id}/promote`,
      { method: 'POST' },
    )
    const promoted = await jsonBody<{ subtaskId: string | null }>(
      promotionResponse,
    )
    if (promoted.subtaskId == null) {
      throw new Error('Promoted checklist item did not create a subtask')
    }
    const subtaskResponse = await app.request(
      `/api/tasks/${promoted.subtaskId}`,
    )
    const subtask = await jsonBody<TaskResponse>(subtaskResponse)

    expect(
      responseSnapshot(
        subtaskResponse.status,
        normalizeTaskDetailResponse(subtask),
      ),
    ).toEqual(
      responseSnapshot(
        200,
        expectedTaskDetailResponse({
          title: 'Inspect the signal',
          projectId: project.id,
          fieldValues: [],
          parentId: 'PARENT_ID',
          parentNumber: -1,
          parentTitle: 'Observe a signal',
        }),
      ),
    )
  })

  it('resolves ids and names and updates only the selected fields', async () => {
    const project = await createProject('Sample Observatory')
    const firstField = await createField(project.id, 'Signal Phase', [
      'Early Arc',
      'Late Arc',
    ])
    const secondField = await createField(project.id, 'Orbit Mode', [
      'Quiet Path',
    ])
    const firstOption = firstField.options[0]
    const secondOption = secondField.options[0]
    if (firstOption == null || secondOption == null) {
      throw new Error('Test field options were not created')
    }

    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: { [firstField.name]: firstOption.name },
    })
    const created = await jsonBody<TaskResponse>(createResponse)
    const updateResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      {
        fieldValues: {
          [secondField.id]: secondOption.id,
        },
      },
    )
    const updated = await jsonBody<TaskResponse>(updateResponse)
    const clearResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { fieldValues: { [firstField.id]: null } },
    )
    const cleared = await jsonBody<TaskResponse>(clearResponse)
    const firstFieldValue = [
      {
        fieldId: firstField.id,
        fieldName: firstField.name,
        optionId: firstOption.id,
        optionName: firstOption.name,
      },
    ]
    const bothFieldValues = [
      ...firstFieldValue,
      {
        fieldId: secondField.id,
        fieldName: secondField.name,
        optionId: secondOption.id,
        optionName: secondOption.name,
      },
    ]

    expect(
      responseSnapshot(200, {
        create: responseSnapshot(
          createResponse.status,
          normalizeTaskResponse(created),
        ),
        update: responseSnapshot(
          updateResponse.status,
          normalizeTaskResponse(updated),
        ),
        clear: responseSnapshot(
          clearResponse.status,
          normalizeTaskResponse(cleared),
        ),
      }),
    ).toEqual(
      responseSnapshot(200, {
        create: responseSnapshot(
          201,
          expectedTaskWriteResponse(
            {
              title: 'Observe a signal',
              projectId: project.id,
              fieldValues: firstFieldValue,
            },
            true,
          ),
        ),
        update: responseSnapshot(
          200,
          expectedTaskWriteResponse({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: bothFieldValues,
          }),
        ),
        clear: responseSnapshot(
          200,
          expectedTaskWriteResponse({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: [
              {
                fieldId: secondField.id,
                fieldName: secondField.name,
                optionId: secondOption.id,
                optionName: secondOption.name,
              },
            ],
          }),
        ),
      }),
    )
  })

  it('returns values in field creation order in detail and list views', async () => {
    const project = await createProject('Sample Observatory')
    const firstField = await createField(project.id, 'Signal Phase', [
      'Early Arc',
    ])
    const secondField = await createField(project.id, 'Orbit Mode', [
      'Quiet Path',
    ])
    const firstOption = firstField.options[0]
    const secondOption = secondField.options[0]
    if (firstOption == null || secondOption == null) {
      throw new Error('Test field options were not created')
    }
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: {
        [secondField.id]: secondOption.id,
        [firstField.id]: firstOption.id,
      },
    })
    const created = await jsonBody<TaskResponse>(createResponse)
    const detailResponse = await app.request(`/api/tasks/${created.id}`)
    const detail = await jsonBody<TaskResponse>(detailResponse)
    const fullListResponse = await app.request(
      '/api/tasks?view=full&context=all&status=all&limit=unlimited',
    )
    const fullList = await jsonBody<TaskListItemResponse[]>(fullListResponse)
    const rowListResponse = await app.request(
      '/api/tasks?view=row&context=all&status=all&limit=unlimited',
    )
    const rowList =
      await jsonBody<Array<Omit<TaskListItemResponse, 'description'>>>(
        rowListResponse,
      )
    const orderedValues = [
      {
        fieldId: firstField.id,
        fieldName: firstField.name,
        optionId: firstOption.id,
        optionName: firstOption.name,
      },
      {
        fieldId: secondField.id,
        fieldName: secondField.name,
        optionId: secondOption.id,
        optionName: secondOption.name,
      },
    ]

    expect(
      responseSnapshot(200, {
        detail: responseSnapshot(
          detailResponse.status,
          normalizeTaskDetailResponse(detail),
        ),
        fullList: responseSnapshot(
          fullListResponse.status,
          fullList.map(normalizeTaskResponse),
        ),
        rowList: responseSnapshot(
          rowListResponse.status,
          rowList.map(normalizeTaskResponse),
        ),
      }),
    ).toEqual(
      responseSnapshot(200, {
        detail: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: orderedValues,
          }),
        ),
        fullList: responseSnapshot(200, [
          expectedTaskListItem({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: orderedValues,
          }),
        ]),
        rowList: responseSnapshot(200, [
          expectedTaskListRow({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: orderedValues,
          }),
        ]),
      }),
    )
  })

  it('returns field values when completing a task', async () => {
    const project = await createProject('Sample Observatory')
    const field = await createField(project.id, 'Signal Phase', ['Early Arc'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')

    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: { [field.id]: option.id },
    })
    const created = await jsonBody<TaskResponse>(createResponse)
    const completeResponse = await requestJson(
      `/api/tasks/${created.id}/complete`,
      'POST',
      {},
    )
    const completed = await jsonBody<TaskResponse>(completeResponse)

    expect(
      responseSnapshot(
        completeResponse.status,
        normalizeTaskResponse(completed),
      ),
    ).toEqual(
      responseSnapshot(
        200,
        expectedTaskResponse({
          title: 'Observe a signal',
          projectId: project.id,
          fieldValues: [
            {
              fieldId: field.id,
              fieldName: field.name,
              optionId: option.id,
              optionName: option.name,
            },
          ],
          status: 'completed',
          statusReason: 'completed',
        }),
      ),
    )
  })

  it('accepts a field name that is special to JavaScript objects', async () => {
    const project = await createProject('Sample Observatory')
    const field = await createField(project.id, '__proto__', ['Early Arc'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')

    const response = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: Object.fromEntries([['__proto__', option.name]]),
    })
    const created = await jsonBody<TaskResponse>(response)

    expect(
      responseSnapshot(response.status, normalizeTaskResponse(created)),
    ).toEqual(
      responseSnapshot(
        201,
        expectedTaskWriteResponse(
          {
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: [
              {
                fieldId: field.id,
                fieldName: field.name,
                optionId: option.id,
                optionName: option.name,
              },
            ],
          },
          true,
        ),
      ),
    )
  })

  it('rejects field values when creating a task without a project', async () => {
    const project = await createProject('Sample Archive')
    const field = await createField(project.id, 'Review Track', ['North Route'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')

    const response = await requestJson('/api/tasks', 'POST', {
      title: 'Review an unassigned record',
      fieldValues: { [field.name]: option.name },
    })

    expect(responseSnapshot(response.status, await jsonBody(response))).toEqual(
      responseSnapshot(400, {
        error: 'Task field values require a project',
      }),
    )
  })

  it('rejects fields outside the task project and unknown field names', async () => {
    const project = await createProject('Sample Archive')
    const otherProject = await createProject('Sample Archive Two')
    const foreignField = await createField(otherProject.id, 'Review Track', [
      'South Route',
    ])
    const foreignOption = foreignField.options[0]
    if (foreignOption == null)
      throw new Error('Test field option was not created')
    const taskResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Review a record',
      projectId: project.id,
    })
    const task = await jsonBody<TaskResponse>(taskResponse)
    const missingFieldResponse = await requestJson(
      `/api/tasks/${task.id}`,
      'PATCH',
      { fieldValues: { 'Missing Track': 'Unknown Route' } },
    )
    const foreignFieldResponse = await requestJson(
      `/api/tasks/${task.id}`,
      'PATCH',
      { fieldValues: { [foreignField.id]: foreignOption.id } },
    )

    expect(
      responseSnapshot(200, {
        missingField: responseSnapshot(
          missingFieldResponse.status,
          await jsonBody(missingFieldResponse),
        ),
        foreignField: responseSnapshot(
          foreignFieldResponse.status,
          await jsonBody(foreignFieldResponse),
        ),
      }),
    ).toEqual(
      responseSnapshot(200, {
        missingField: responseSnapshot(400, {
          error: 'Field not found: Missing Track',
        }),
        foreignField: responseSnapshot(400, {
          error: `Field not found: ${foreignField.id}`,
        }),
      }),
    )
  })

  it('rejects options from another field or project and unknown option names', async () => {
    const project = await createProject('Sample Catalogue')
    const otherProject = await createProject('Sample Catalogue Two')
    const field = await createField(project.id, 'Stage Map', ['First Span'])
    const siblingField = await createField(project.id, 'Stage Mode', [
      'Local Span',
    ])
    const foreignField = await createField(otherProject.id, 'Stage Map', [
      'Second Span',
    ])
    const foreignProjectOption = foreignField.options[0]
    const otherFieldOption = siblingField.options[0]
    if (foreignProjectOption == null || otherFieldOption == null) {
      throw new Error('Test field options were not created')
    }
    const taskResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Map a sample',
      projectId: project.id,
    })
    const task = await jsonBody<TaskResponse>(taskResponse)
    const foreignProjectOptionResponse = await requestJson(
      `/api/tasks/${task.id}`,
      'PATCH',
      { fieldValues: { [field.id]: foreignProjectOption.id } },
    )
    const otherFieldOptionResponse = await requestJson(
      `/api/tasks/${task.id}`,
      'PATCH',
      { fieldValues: { [field.id]: otherFieldOption.id } },
    )
    const missingOptionResponse = await requestJson(
      `/api/tasks/${task.id}`,
      'PATCH',
      { fieldValues: { [field.name]: 'Unlisted Span' } },
    )

    expect(
      responseSnapshot(200, {
        foreignProjectOption: responseSnapshot(
          foreignProjectOptionResponse.status,
          await jsonBody(foreignProjectOptionResponse),
        ),
        otherFieldOption: responseSnapshot(
          otherFieldOptionResponse.status,
          await jsonBody(otherFieldOptionResponse),
        ),
        missingOption: responseSnapshot(
          missingOptionResponse.status,
          await jsonBody(missingOptionResponse),
        ),
      }),
    ).toEqual(
      responseSnapshot(200, {
        foreignProjectOption: responseSnapshot(400, {
          error: `Option not found for field: ${field.id}`,
        }),
        otherFieldOption: responseSnapshot(400, {
          error: `Option not found for field: ${field.id}`,
        }),
        missingOption: responseSnapshot(400, {
          error: 'Option not found for field: Stage Map',
        }),
      }),
    )
  })

  it('does not apply other changes when field value validation fails', async () => {
    const project = await createProject('Sample Archive')
    const field = await createField(project.id, 'Review Track', ['North Route'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')
    const taskResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Review a record',
      projectId: project.id,
      fieldValues: { [field.id]: option.id },
    })
    const task = await jsonBody<TaskResponse>(taskResponse)
    const blockerResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Review a supporting record',
    })
    const blocker = await jsonBody<TaskResponse>(blockerResponse)
    const updateResponse = await requestJson(`/api/tasks/${task.id}`, 'PATCH', {
      blockedBy: [blocker.id],
      fieldValues: { [field.id]: 'Unknown Route' },
    })
    const detailResponse = await app.request(`/api/tasks/${task.id}`)
    const detail = await jsonBody<TaskResponse>(detailResponse)
    const storedValues = await db
      .select()
      .from(taskFieldValues)
      .where(eq(taskFieldValues.taskId, task.id))
    const blockedRelations = await db
      .select()
      .from(taskRelations)
      .where(eq(taskRelations.sourceTaskId, task.id))

    expect(
      responseSnapshot(200, {
        update: responseSnapshot(
          updateResponse.status,
          await jsonBody(updateResponse),
        ),
        detail: responseSnapshot(
          detailResponse.status,
          normalizeTaskDetailResponse(detail),
        ),
        state: {
          storedFieldValues: storedValues.length,
          blockedRelations: blockedRelations.length,
        },
      }),
    ).toEqual(
      responseSnapshot(200, {
        update: responseSnapshot(400, {
          error: `Option not found for field: ${field.id}`,
        }),
        detail: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Review a record',
            projectId: project.id,
            fieldValues: [
              {
                fieldId: field.id,
                fieldName: field.name,
                optionId: option.id,
                optionName: option.name,
              },
            ],
          }),
        ),
        state: { storedFieldValues: 1, blockedRelations: 0 },
      }),
    )
  })

  it('keeps values and updates their names after field and option renames', async () => {
    const sourceProject = await createProject('Sample Catalogue')
    const sourceField = await createField(sourceProject.id, 'Stage Map', [
      'First Span',
    ])
    const sourceOption = sourceField.options[0]
    if (sourceOption == null)
      throw new Error('Test field option was not created')
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Map a sample',
      projectId: sourceProject.id,
      fieldValues: { [sourceField.id]: sourceOption.id },
    })
    const created = await jsonBody<TaskResponse>(createResponse)
    const changedEvents: ChangeEvent[] = []
    const unsubscribe = subscribeToChangeEvents((event) => {
      changedEvents.push(event)
    })
    await requestJson(
      `/api/projects/${sourceProject.id}/fields/${sourceField.id}/options/${sourceOption.id}`,
      'PATCH',
      { name: 'Renamed Span' },
    )
    const renamedDetailResponse = await app.request(`/api/tasks/${created.id}`)
    const renamedDetail = await jsonBody<TaskResponse>(renamedDetailResponse)
    const optionRenameEvents = [...changedEvents]
    unsubscribe()
    const fieldRenameEvents: ChangeEvent[] = []
    const unsubscribeFieldRename = subscribeToChangeEvents((event) => {
      fieldRenameEvents.push(event)
    })
    await requestJson(
      `/api/projects/${sourceProject.id}/fields/${sourceField.id}`,
      'PATCH',
      { name: 'Renamed Stage Map' },
    )
    const fieldRenameTaskEvents = [...fieldRenameEvents]
    unsubscribeFieldRename()
    const fieldRenamedDetailResponse = await app.request(
      `/api/tasks/${created.id}`,
    )
    const fieldRenamedDetail = await jsonBody<TaskResponse>(
      fieldRenamedDetailResponse,
    )

    expect(
      responseSnapshot(200, {
        optionRename: responseSnapshot(
          renamedDetailResponse.status,
          normalizeTaskDetailResponse(renamedDetail),
        ),
        fieldRename: responseSnapshot(
          fieldRenamedDetailResponse.status,
          normalizeTaskDetailResponse(fieldRenamedDetail),
        ),
        events: {
          optionRename: optionRenameEvents,
          fieldRename: fieldRenameTaskEvents,
        },
      }),
    ).toEqual(
      responseSnapshot(200, {
        optionRename: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Map a sample',
            projectId: sourceProject.id,
            fieldValues: [
              {
                fieldId: sourceField.id,
                fieldName: 'Stage Map',
                optionId: sourceOption.id,
                optionName: 'Renamed Span',
              },
            ],
          }),
        ),
        fieldRename: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Map a sample',
            projectId: sourceProject.id,
            fieldValues: [
              {
                fieldId: sourceField.id,
                fieldName: 'Renamed Stage Map',
                optionId: sourceOption.id,
                optionName: 'Renamed Span',
              },
            ],
          }),
        ),
        events: {
          optionRename: [
            {
              resource: 'project',
              id: sourceProject.id,
              origin: null,
              taskIds: [created.id],
            },
          ],
          fieldRename: [
            {
              resource: 'project',
              id: sourceProject.id,
              origin: null,
              taskIds: [created.id],
            },
          ],
        },
      }),
    )
  })

  it('clears values on project changes and applies values from the destination project', async () => {
    const sourceProject = await createProject('Sample Catalogue')
    const destinationProject = await createProject('Sample Catalogue Two')
    const sourceField = await createField(sourceProject.id, 'Stage Map', [
      'First Span',
    ])
    const destinationField = await createField(
      destinationProject.id,
      'Stage Map',
      ['Third Span'],
    )
    const sourceOption = sourceField.options[0]
    const destinationOption = destinationField.options[0]
    if (sourceOption == null || destinationOption == null) {
      throw new Error('Test field options were not created')
    }
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Map a sample',
      projectId: sourceProject.id,
      fieldValues: { [sourceField.id]: sourceOption.id },
    })
    const created = await jsonBody<{ id: string }>(createResponse)
    const moveResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { projectId: destinationProject.id },
    )
    const moved = await jsonBody<TaskResponse>(moveResponse)
    const setDestinationValueResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { fieldValues: { [destinationField.name]: destinationOption.name } },
    )
    const setDestinationValue = await jsonBody<TaskResponse>(
      setDestinationValueResponse,
    )
    const clearProjectResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { projectId: null },
    )
    const clearProjectTask = await jsonBody<TaskResponse>(clearProjectResponse)

    expect(
      responseSnapshot(200, {
        move: responseSnapshot(
          moveResponse.status,
          normalizeTaskResponse(moved),
        ),
        setDestinationValue: responseSnapshot(
          setDestinationValueResponse.status,
          normalizeTaskResponse(setDestinationValue),
        ),
        clearProject: responseSnapshot(
          clearProjectResponse.status,
          normalizeTaskResponse(clearProjectTask),
        ),
      }),
    ).toEqual(
      responseSnapshot(200, {
        move: responseSnapshot(
          200,
          expectedTaskWriteResponse({
            title: 'Map a sample',
            projectId: destinationProject.id,
            fieldValues: [],
          }),
        ),
        setDestinationValue: responseSnapshot(
          200,
          expectedTaskWriteResponse({
            title: 'Map a sample',
            projectId: destinationProject.id,
            fieldValues: [
              {
                fieldId: destinationField.id,
                fieldName: destinationField.name,
                optionId: destinationOption.id,
                optionName: destinationOption.name,
              },
            ],
          }),
        ),
        clearProject: responseSnapshot(
          200,
          expectedTaskWriteResponse({
            title: 'Map a sample',
            projectId: null,
            fieldValues: [],
          }),
        ),
      }),
    )
  })

  it('clears the selected value and notifies its task when an option is deleted', async () => {
    const project = await createProject('Sample Observatory')
    const field = await createField(project.id, 'Signal Phase', ['Early Arc'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: { [field.id]: option.id },
    })
    const created = await jsonBody<{ id: string }>(createResponse)
    const changedEvents: ChangeEvent[] = []
    const unsubscribe = subscribeToChangeEvents((event) => {
      changedEvents.push(event)
    })
    const deleteResponse = await app.request(
      `/api/projects/${project.id}/fields/${field.id}/options/${option.id}`,
      { method: 'DELETE' },
    )
    const detailResponse = await app.request(`/api/tasks/${created.id}`)
    const detail = await jsonBody<TaskResponse>(detailResponse)
    unsubscribe()

    expect(
      responseSnapshot(200, {
        delete: responseSnapshot(
          deleteResponse.status,
          await deleteResponse.text(),
        ),
        detail: responseSnapshot(
          detailResponse.status,
          normalizeTaskDetailResponse(detail),
        ),
        events: changedEvents,
      }),
    ).toEqual(
      responseSnapshot(200, {
        delete: responseSnapshot(204, ''),
        detail: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: [],
          }),
        ),
        events: [
          {
            resource: 'project',
            id: project.id,
            origin: null,
            taskIds: [created.id],
          },
        ],
      }),
    )
  })

  it('clears all values and notifies their tasks when a field is deleted', async () => {
    const project = await createProject('Sample Observatory')
    const field = await createField(project.id, 'Signal Phase', ['Early Arc'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: { [field.id]: option.id },
    })
    const created = await jsonBody<TaskResponse>(createResponse)
    const changedEvents: ChangeEvent[] = []
    const unsubscribe = subscribeToChangeEvents((event) => {
      changedEvents.push(event)
    })
    const deleteResponse = await app.request(
      `/api/projects/${project.id}/fields/${field.id}`,
      { method: 'DELETE' },
    )
    const detailResponse = await app.request(`/api/tasks/${created.id}`)
    const detail = await jsonBody<TaskResponse>(detailResponse)
    unsubscribe()

    expect(
      responseSnapshot(200, {
        delete: responseSnapshot(
          deleteResponse.status,
          await deleteResponse.text(),
        ),
        detail: responseSnapshot(
          detailResponse.status,
          normalizeTaskDetailResponse(detail),
        ),
        events: changedEvents,
      }),
    ).toEqual(
      responseSnapshot(200, {
        delete: responseSnapshot(204, ''),
        detail: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Observe a signal',
            projectId: project.id,
            fieldValues: [],
          }),
        ),
        events: [
          {
            resource: 'project',
            id: project.id,
            origin: null,
            taskIds: [created.id],
          },
        ],
      }),
    )
  })

  it('keeps the task without its project or values when the project is deleted', async () => {
    const project = await createProject('Sample Observatory')
    const field = await createField(project.id, 'Signal Phase', ['Early Arc'])
    const option = field.options[0]
    if (option == null) throw new Error('Test field option was not created')
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Observe a signal',
      projectId: project.id,
      fieldValues: { [field.id]: option.id },
    })
    const created = await jsonBody<TaskResponse>(createResponse)
    const deleteResponse = await app.request(`/api/projects/${project.id}`, {
      method: 'DELETE',
    })
    const detailResponse = await app.request(`/api/tasks/${created.id}`)
    const detail = await jsonBody<TaskResponse>(detailResponse)

    expect(
      responseSnapshot(200, {
        delete: responseSnapshot(
          deleteResponse.status,
          await deleteResponse.text(),
        ),
        detail: responseSnapshot(
          detailResponse.status,
          normalizeTaskDetailResponse(detail),
        ),
      }),
    ).toEqual(
      responseSnapshot(200, {
        delete: responseSnapshot(204, ''),
        detail: responseSnapshot(
          200,
          expectedTaskDetailResponse({
            title: 'Observe a signal',
            projectId: null,
            fieldValues: [],
          }),
        ),
      }),
    )
  })

  it('deletes a project after a concurrent field value update', async () => {
    const invocationId = randomUUID()
    const updateApplicationName = `field-value-update-${invocationId}`
    const deleteApplicationName = `project-delete-${invocationId}`
    const sharedLockApplicationName = `shared-field-lock-${invocationId}`
    const isolatedDatabase = await createIsolatedTestDatabase()
    const fixtureClient = isolatedDatabase.client
    const updateClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      updateApplicationName,
    )
    const deleteClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      deleteApplicationName,
    )
    const barrierClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const sharedLockClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      sharedLockApplicationName,
    )
    const monitorClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const fixtureDb = isolatedDatabase.database
    const updateDb = drizzle(updateClient, { schema })
    const deleteDb = drizzle(deleteClient, { schema })
    const barrierDb = drizzle(barrierClient, { schema })
    const sharedLockDb = drizzle(sharedLockClient, { schema })
    let projectId: string | undefined
    let taskId: string | undefined
    let releaseFieldLock: (() => void) | undefined
    let releaseSharedFieldLock: (() => void) | undefined
    let fieldLockTransaction: Promise<unknown> | undefined
    let sharedFieldLockTransaction: Promise<unknown> | undefined
    let pendingUpdateResponse: Promise<Response> | undefined
    let pendingDeleteResponse: Promise<Response> | undefined

    try {
      const project = await dbContext.run(fixtureDb, () =>
        createProject('Sample Archive'),
      )
      projectId = project.id
      const field = await dbContext.run(fixtureDb, () =>
        createField(project.id, 'Review Track', ['North Route', 'South Route']),
      )
      const [firstOption, nextOption] = field.options
      if (firstOption == null || nextOption == null) {
        throw new Error('Test field options were not created')
      }
      const createResponse = await requestJsonWithDb(
        fixtureDb,
        '/api/tasks',
        'POST',
        {
          title: 'Review a record',
          projectId: project.id,
          fieldValues: { [field.id]: firstOption.id },
        },
      )
      const task = await jsonBody<TaskResponse>(createResponse)
      taskId = task.id

      let fieldLockAcquired: (() => void) | undefined
      const fieldLockReady = new Promise<void>((resolve) => {
        fieldLockAcquired = resolve
      })
      const fieldLockReleased = new Promise<void>((resolve) => {
        releaseFieldLock = resolve
      })
      fieldLockTransaction = barrierDb.transaction(async (tx) => {
        await tx
          .select({ id: projectFields.id })
          .from(projectFields)
          .where(eq(projectFields.id, field.id))
          .for('update')
        fieldLockAcquired?.()
        await fieldLockReleased
      })
      void fieldLockTransaction.catch(() => undefined)
      await fieldLockReady

      const updateResponsePromise = requestJsonWithDb(
        updateDb,
        `/api/tasks/${task.id}`,
        'PATCH',
        { fieldValues: { [field.id]: nextOption.id } },
      )
      pendingUpdateResponse = updateResponsePromise

      const waitForLockWait = async (applicationName: string) => {
        const deadline = Date.now() + 10_000
        while (Date.now() < deadline) {
          const [activity] = await monitorClient`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE application_name = ${applicationName}
                AND state = 'active'
                AND wait_event_type = 'Lock'
            ) AS waiting
          `
          if (activity?.['waiting'] === true) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(`Database lock wait did not start: ${applicationName}`)
      }

      await waitForLockWait(updateApplicationName)
      const sharedFieldLockReleased = new Promise<void>((resolve) => {
        releaseSharedFieldLock = resolve
      })
      sharedFieldLockTransaction = sharedLockDb.transaction(async (tx) => {
        await tx
          .select({ id: projectFields.id })
          .from(projectFields)
          .where(eq(projectFields.id, field.id))
          .for('key share')
        await sharedFieldLockReleased
      })
      void sharedFieldLockTransaction.catch(() => undefined)
      await waitForLockWait(sharedLockApplicationName)

      const deleteResponsePromise = dbContext.run(
        deleteDb,
        async () =>
          await app.request(`/api/projects/${project.id}`, {
            method: 'DELETE',
          }),
      )
      pendingDeleteResponse = deleteResponsePromise
      await waitForLockWait(deleteApplicationName)
      releaseFieldLock?.()

      const [updateResult] = await Promise.allSettled([updateResponsePromise])
      releaseSharedFieldLock?.()
      const [deleteResult] = await Promise.allSettled([deleteResponsePromise])
      const updateOutput =
        updateResult.status === 'fulfilled'
          ? responseSnapshot(
              updateResult.value.status,
              updateResult.value.status === 200
                ? normalizeTaskResponse(
                    await jsonBody<TaskResponse>(updateResult.value),
                  )
                : await updateResult.value.text(),
            )
          : { status: 'rejected', error: String(updateResult.reason) }
      const deleteOutput =
        deleteResult.status === 'fulfilled'
          ? responseSnapshot(
              deleteResult.value.status,
              await deleteResult.value.text(),
            )
          : { status: 'rejected', error: String(deleteResult.reason) }
      const detailResponse = await requestJsonWithDb(
        fixtureDb,
        `/api/tasks/${task.id}`,
        'GET',
        undefined,
      )
      const detail = await jsonBody<TaskResponse>(detailResponse)

      expect(
        responseSnapshot(200, {
          update: updateOutput,
          delete: deleteOutput,
          detail: responseSnapshot(
            detailResponse.status,
            normalizeTaskDetailResponse(detail),
          ),
        }),
      ).toEqual(
        responseSnapshot(200, {
          update: responseSnapshot(
            200,
            expectedTaskWriteResponse({
              title: 'Review a record',
              projectId: project.id,
              fieldValues: [
                {
                  fieldId: field.id,
                  fieldName: field.name,
                  optionId: nextOption.id,
                  optionName: nextOption.name,
                },
              ],
            }),
          ),
          delete: responseSnapshot(204, ''),
          detail: responseSnapshot(
            200,
            expectedTaskDetailResponse({
              title: 'Review a record',
              projectId: null,
              fieldValues: [],
            }),
          ),
        }),
      )
    } finally {
      releaseFieldLock?.()
      releaseSharedFieldLock?.()
      await Promise.all([
        fieldLockTransaction?.catch(() => undefined),
        sharedFieldLockTransaction?.catch(() => undefined),
        pendingUpdateResponse?.then(
          () => undefined,
          () => undefined,
        ),
        pendingDeleteResponse?.then(
          () => undefined,
          () => undefined,
        ),
      ])
      if (taskId != null) {
        await requestJsonWithDb(
          fixtureDb,
          `/api/tasks/${taskId}`,
          'DELETE',
          undefined,
        ).catch(() => undefined)
      }
      if (projectId != null) {
        const projectToDelete = projectId
        await dbContext
          .run(
            fixtureDb,
            async () =>
              await app.request(`/api/projects/${projectToDelete}`, {
                method: 'DELETE',
              }),
          )
          .catch(() => undefined)
      }
      await Promise.all([
        fixtureClient.end(),
        updateClient.end(),
        deleteClient.end(),
        barrierClient.end(),
        sharedLockClient.end(),
        monitorClient.end(),
      ])
      await dropIsolatedTestDatabase(isolatedDatabase)
    }
  }, 20_000)

  it('serializes project deletion with a concurrent blockedBy update', async () => {
    const invocationId = randomUUID()
    const updateApplicationName = `blocked-by-update-${invocationId}`
    const deleteApplicationName = `blocked-by-delete-${invocationId}`
    const isolatedDatabase = await createIsolatedTestDatabase()
    const fixtureClient = isolatedDatabase.client
    const updateClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      updateApplicationName,
    )
    const deleteClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      deleteApplicationName,
    )
    const barrierClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const monitorClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const fixtureDb = isolatedDatabase.database
    const updateDb = drizzle(updateClient, { schema })
    const deleteDb = drizzle(deleteClient, { schema })
    const barrierDb = drizzle(barrierClient, { schema })
    let projectId: string | undefined
    const taskIds: string[] = []
    let releaseSourceLock: (() => void) | undefined
    let sourceLockTransaction: Promise<unknown> | undefined
    let pendingUpdateResponse: Promise<Response> | undefined
    let pendingDeleteResponse: Promise<Response> | undefined

    try {
      const project = await dbContext.run(fixtureDb, () =>
        createProject('Sample Archive'),
      )
      projectId = project.id
      for (const title of ['Target record', 'Source record']) {
        const response = await requestJsonWithDb(
          fixtureDb,
          '/api/tasks',
          'POST',
          { title, projectId: project.id },
        )
        const task = await jsonBody<TaskResponse>(response)
        taskIds.push(task.id)
      }

      const [target, source] = await fixtureDb
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(eq(tasks.projectId, project.id))
        .orderBy(asc(tasks.id))
      if (target == null || source == null) {
        throw new Error('Test tasks were not created')
      }

      let sourceLockAcquired: (() => void) | undefined
      const sourceLockReady = new Promise<void>((resolve) => {
        sourceLockAcquired = resolve
      })
      const sourceLockReleased = new Promise<void>((resolve) => {
        releaseSourceLock = resolve
      })
      sourceLockTransaction = barrierDb.transaction(async (tx) => {
        await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.id, source.id))
          .for('update')
        sourceLockAcquired?.()
        await sourceLockReleased
      })
      void sourceLockTransaction.catch(() => undefined)
      await sourceLockReady

      const updateResponsePromise = requestJsonWithDb(
        updateDb,
        `/api/tasks/${source.id}`,
        'PATCH',
        { blockedBy: [target.id] },
      )
      pendingUpdateResponse = updateResponsePromise

      const waitForLockWait = async (applicationName: string) => {
        const deadline = Date.now() + 10_000
        while (Date.now() < deadline) {
          const [activity] = await monitorClient`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE application_name = ${applicationName}
                AND state = 'active'
                AND wait_event_type = 'Lock'
            ) AS waiting
          `
          if (activity?.['waiting'] === true) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(`Database lock wait did not start: ${applicationName}`)
      }

      await waitForLockWait(updateApplicationName)
      const deleteResponsePromise = dbContext.run(
        deleteDb,
        async () =>
          await app.request(`/api/projects/${project.id}`, {
            method: 'DELETE',
          }),
      )
      pendingDeleteResponse = deleteResponsePromise
      await waitForLockWait(deleteApplicationName)
      releaseSourceLock?.()

      const [updateResponse, deleteResponse] = await Promise.all([
        updateResponsePromise,
        deleteResponsePromise,
      ])
      const relations = await fixtureDb
        .select({
          sourceTaskId: taskRelations.sourceTaskId,
          targetTaskId: taskRelations.targetTaskId,
          type: taskRelations.type,
        })
        .from(taskRelations)
        .where(eq(taskRelations.sourceTaskId, source.id))

      const output = () => ({
        updateStatus: updateResponse.status,
        deleteStatus: deleteResponse.status,
        relations,
      })
      expect(output()).toEqual({
        updateStatus: 200,
        deleteStatus: 204,
        relations: [
          {
            sourceTaskId: source.id,
            targetTaskId: target.id,
            type: 'blocked_by',
          },
        ],
      })
    } finally {
      releaseSourceLock?.()
      await Promise.all([
        sourceLockTransaction?.catch(() => undefined),
        pendingUpdateResponse?.then(
          () => undefined,
          () => undefined,
        ),
        pendingDeleteResponse?.then(
          () => undefined,
          () => undefined,
        ),
      ])
      if (taskIds.length > 0) {
        await fixtureDb
          .delete(tasks)
          .where(inArray(tasks.id, taskIds))
          .catch(() => undefined)
      }
      if (projectId != null) {
        await fixtureDb
          .delete(projects)
          .where(eq(projects.id, projectId))
          .catch(() => undefined)
      }
      await Promise.all([
        fixtureClient.end(),
        updateClient.end(),
        deleteClient.end(),
        barrierClient.end(),
        monitorClient.end(),
      ])
      await dropIsolatedTestDatabase(isolatedDatabase)
    }
  }, 20_000)

  it('serializes project deletion with a concurrent parent update', async () => {
    const invocationId = randomUUID()
    const updateApplicationName = `parent-update-${invocationId}`
    const deleteApplicationName = `parent-delete-${invocationId}`
    const isolatedDatabase = await createIsolatedTestDatabase()
    const fixtureClient = isolatedDatabase.client
    const updateClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      updateApplicationName,
    )
    const deleteClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      deleteApplicationName,
    )
    const barrierClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const monitorClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const fixtureDb = isolatedDatabase.database
    const updateDb = drizzle(updateClient, { schema })
    const deleteDb = drizzle(deleteClient, { schema })
    const barrierDb = drizzle(barrierClient, { schema })
    let projectId: string | undefined
    const taskIds: string[] = []
    let releaseSourceLock: (() => void) | undefined
    let sourceLockTransaction: Promise<unknown> | undefined
    let pendingUpdateResponse: Promise<Response> | undefined
    let pendingDeleteResponse: Promise<Response> | undefined

    try {
      const project = await dbContext.run(fixtureDb, () =>
        createProject('Sample Archive'),
      )
      projectId = project.id
      for (const title of ['Target record', 'Source record']) {
        const response = await requestJsonWithDb(
          fixtureDb,
          '/api/tasks',
          'POST',
          { title, projectId: project.id },
        )
        const task = await jsonBody<TaskResponse>(response)
        taskIds.push(task.id)
      }

      const [target, source] = await fixtureDb
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.projectId, project.id))
        .orderBy(asc(tasks.id))
      if (target == null || source == null) {
        throw new Error('Test tasks were not created')
      }

      let sourceLockAcquired: (() => void) | undefined
      const sourceLockReady = new Promise<void>((resolve) => {
        sourceLockAcquired = resolve
      })
      const sourceLockReleased = new Promise<void>((resolve) => {
        releaseSourceLock = resolve
      })
      sourceLockTransaction = barrierDb.transaction(async (tx) => {
        await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.id, source.id))
          .for('update')
        sourceLockAcquired?.()
        await sourceLockReleased
      })
      void sourceLockTransaction.catch(() => undefined)
      await sourceLockReady

      const updateResponsePromise = requestJsonWithDb(
        updateDb,
        `/api/tasks/${source.id}/parent`,
        'PATCH',
        { parentId: target.id },
      )
      pendingUpdateResponse = updateResponsePromise

      const waitForLockWait = async (applicationName: string) => {
        const deadline = Date.now() + 10_000
        while (Date.now() < deadline) {
          const [activity] = await monitorClient`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE application_name = ${applicationName}
                AND state = 'active'
                AND wait_event_type = 'Lock'
            ) AS waiting
          `
          if (activity?.['waiting'] === true) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(`Database lock wait did not start: ${applicationName}`)
      }

      await waitForLockWait(updateApplicationName)
      const deleteResponsePromise = dbContext.run(
        deleteDb,
        async () =>
          await app.request(`/api/projects/${project.id}`, {
            method: 'DELETE',
          }),
      )
      pendingDeleteResponse = deleteResponsePromise
      await waitForLockWait(deleteApplicationName)
      releaseSourceLock?.()

      const [updateResponse, deleteResponse] = await Promise.all([
        updateResponsePromise,
        deleteResponsePromise,
      ])
      const [updatedSource] = await fixtureDb
        .select({ parentId: tasks.parentId })
        .from(tasks)
        .where(eq(tasks.id, source.id))

      const output = () => ({
        updateStatus: updateResponse.status,
        deleteStatus: deleteResponse.status,
        parentId: updatedSource?.parentId,
      })
      expect(output()).toEqual({
        updateStatus: 200,
        deleteStatus: 204,
        parentId: target.id,
      })
    } finally {
      releaseSourceLock?.()
      await Promise.all([
        sourceLockTransaction?.catch(() => undefined),
        pendingUpdateResponse?.then(
          () => undefined,
          () => undefined,
        ),
        pendingDeleteResponse?.then(
          () => undefined,
          () => undefined,
        ),
      ])
      if (taskIds.length > 0) {
        await fixtureDb
          .delete(tasks)
          .where(inArray(tasks.id, taskIds))
          .catch(() => undefined)
      }
      if (projectId != null) {
        const projectToDelete = projectId
        await dbContext
          .run(
            fixtureDb,
            async () =>
              await app.request(`/api/projects/${projectToDelete}`, {
                method: 'DELETE',
              }),
          )
          .catch(() => undefined)
      }
      await Promise.all([
        fixtureClient.end(),
        updateClient.end(),
        deleteClient.end(),
        barrierClient.end(),
        monitorClient.end(),
      ])
      await dropIsolatedTestDatabase(isolatedDatabase)
    }
  }, 20_000)

  it('serializes recurrence setting with concurrent project deletion', async () => {
    const invocationId = randomUUID()
    const updateApplicationName = `recurrence-update-${invocationId}`
    const deleteApplicationName = `recurrence-delete-${invocationId}`
    const isolatedDatabase = await createIsolatedTestDatabase()
    const fixtureClient = isolatedDatabase.client
    const updateClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      updateApplicationName,
    )
    const deleteClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      deleteApplicationName,
    )
    const barrierClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const monitorClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const fixtureDb = isolatedDatabase.database
    const updateDb = drizzle(updateClient, { schema })
    const deleteDb = drizzle(deleteClient, { schema })
    const barrierDb = drizzle(barrierClient, { schema })
    let releaseParentLock: (() => void) | undefined
    let parentLockTransaction: Promise<unknown> | undefined
    let pendingUpdateResponse: Promise<Response> | undefined
    let pendingDeleteResponse: Promise<Response> | undefined

    try {
      const project = await dbContext.run(fixtureDb, () =>
        createProject('Sample Archive'),
      )
      await fixtureDb.insert(tasks).values({
        id: 'task-a-parent',
        title: 'Parent record',
        projectId: project.id,
      })
      await fixtureDb.insert(tasks).values({
        id: 'task-z-child',
        title: 'Child record',
        projectId: project.id,
        parentId: 'task-a-parent',
      })

      let parentLockAcquired: (() => void) | undefined
      const parentLockReady = new Promise<void>((resolve) => {
        parentLockAcquired = resolve
      })
      const parentLockReleased = new Promise<void>((resolve) => {
        releaseParentLock = resolve
      })
      parentLockTransaction = barrierDb.transaction(async (tx) => {
        await tx
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.id, 'task-a-parent'))
          .for('update')
        parentLockAcquired?.()
        await parentLockReleased
      })
      void parentLockTransaction.catch(() => undefined)
      await parentLockReady

      const deleteResponsePromise = dbContext.run(
        deleteDb,
        async () =>
          await app.request(`/api/projects/${project.id}`, {
            method: 'DELETE',
          }),
      )
      pendingDeleteResponse = deleteResponsePromise

      const waitForLockWait = async (applicationName: string) => {
        const deadline = Date.now() + 10_000
        while (Date.now() < deadline) {
          const [activity] = await monitorClient`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE application_name = ${applicationName}
                AND state = 'active'
                AND wait_event_type = 'Lock'
            ) AS waiting
          `
          if (activity?.['waiting'] === true) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(`Database lock wait did not start: ${applicationName}`)
      }

      await waitForLockWait(deleteApplicationName)
      const updateResponsePromise = requestJsonWithDb(
        updateDb,
        '/api/tasks/task-z-child',
        'PATCH',
        { recurrenceRule: { type: 'daily', interval: 1 } },
      )
      pendingUpdateResponse = updateResponsePromise
      await waitForLockWait(updateApplicationName)
      releaseParentLock?.()

      const [updateResponse, deleteResponse] = await Promise.all([
        updateResponsePromise,
        deleteResponsePromise,
      ])
      const taskRows = await fixtureDb
        .select({
          id: tasks.id,
          projectId: tasks.projectId,
          parentId: tasks.parentId,
          templateId: tasks.templateId,
        })
        .from(tasks)
        .where(inArray(tasks.id, ['task-a-parent', 'task-z-child']))
        .orderBy(asc(tasks.id))
      const templates = await fixtureDb
        .select({
          projectId: recurringTaskTemplates.projectId,
          parentId: recurringTaskTemplates.parentId,
        })
        .from(recurringTaskTemplates)
        .where(eq(recurringTaskTemplates.parentId, 'task-a-parent'))

      const output = () => ({
        updateStatus: updateResponse.status,
        deleteStatus: deleteResponse.status,
        tasks: taskRows.map((task) => ({
          id: task.id === 'task-a-parent' ? 'PARENT_TASK_ID' : 'CHILD_TASK_ID',
          projectId: task.projectId,
          parentId: task.parentId == null ? null : 'PARENT_TASK_ID',
          templateId: task.templateId == null ? null : 'TEMPLATE_ID',
        })),
        templates: templates.map((template) => ({
          projectId: template.projectId,
          parentId: template.parentId == null ? null : 'PARENT_TASK_ID',
        })),
      })
      expect(output()).toEqual({
        updateStatus: 200,
        deleteStatus: 204,
        tasks: [
          {
            id: 'PARENT_TASK_ID',
            projectId: null,
            parentId: null,
            templateId: null,
          },
          {
            id: 'CHILD_TASK_ID',
            projectId: null,
            parentId: 'PARENT_TASK_ID',
            templateId: 'TEMPLATE_ID',
          },
        ],
        templates: [{ projectId: null, parentId: 'PARENT_TASK_ID' }],
      })
    } finally {
      releaseParentLock?.()
      await Promise.all([
        parentLockTransaction?.catch(() => undefined),
        pendingUpdateResponse?.then(
          () => undefined,
          () => undefined,
        ),
        pendingDeleteResponse?.then(
          () => undefined,
          () => undefined,
        ),
      ])
      await Promise.all([
        fixtureClient.end(),
        updateClient.end(),
        deleteClient.end(),
        barrierClient.end(),
        monitorClient.end(),
      ])
      await dropIsolatedTestDatabase(isolatedDatabase)
    }
  }, 20_000)

  it('generates occurrences from the current template after project deletion', async () => {
    const invocationId = randomUUID()
    const deleteApplicationName = `template-project-delete-${invocationId}`
    const schedulerApplicationName = `template-scheduler-${invocationId}`
    const isolatedDatabase = await createIsolatedTestDatabase()
    const fixtureClient = isolatedDatabase.client
    const gateClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const deleteClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      deleteApplicationName,
    )
    const schedulerClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
      schedulerApplicationName,
    )
    const monitorClient = connectToIsolatedTestDatabase(
      isolatedDatabase.databaseName,
    )
    const fixtureDb = isolatedDatabase.database
    const gateDb = drizzle(gateClient, { schema })
    const deleteDb = drizzle(deleteClient, { schema })
    const schedulerDb = drizzle(schedulerClient, { schema })
    let releaseGate: (() => void) | undefined
    let gateTransaction: Promise<unknown> | undefined
    let pendingDelete: Promise<Response> | undefined
    let pendingGeneration: Promise<void> | undefined

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2031-04-10T12:00:00Z'))

    try {
      const project = await dbContext.run(fixtureDb, () =>
        createProject('Sample Archive'),
      )
      const [rule] = await fixtureDb
        .insert(recurrenceRules)
        .values({ type: 'daily', interval: 1 })
        .returning()
      if (rule == null) throw new Error('Test recurrence rule was not created')
      const [template] = await fixtureDb
        .insert(recurringTaskTemplates)
        .values({
          title: 'Review a record {date}',
          anchorDate: '2031-04-09',
          projectId: project.id,
          recurrenceRuleId: rule.id,
        })
        .returning()
      if (template == null) {
        throw new Error('Test recurring template was not created')
      }

      let gateAcquired: (() => void) | undefined
      const gateReady = new Promise<void>((resolve) => {
        gateAcquired = resolve
      })
      const gateReleased = new Promise<void>((resolve) => {
        releaseGate = resolve
      })
      gateTransaction = gateDb.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext('task_relations:blocked_by'))`,
        )
        gateAcquired?.()
        await gateReleased
      })
      void gateTransaction.catch(() => undefined)
      await gateReady

      const waitForLockWait = async (applicationName: string) => {
        const deadline = Date.now() + 10_000
        while (Date.now() < deadline) {
          const [activity] = await monitorClient`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE application_name = ${applicationName}
                AND state = 'active'
                AND wait_event_type = 'Lock'
            ) AS waiting
          `
          if (activity?.['waiting'] === true) return
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        throw new Error(`Database lock wait did not start: ${applicationName}`)
      }

      const deleteResponsePromise = dbContext.run(
        deleteDb,
        async () =>
          await app.request(`/api/projects/${project.id}`, {
            method: 'DELETE',
          }),
      )
      pendingDelete = deleteResponsePromise
      await waitForLockWait(deleteApplicationName)

      pendingGeneration = dbContext.run(schedulerDb, generateDueRecurringTasks)
      await waitForLockWait(schedulerApplicationName)
      releaseGate?.()

      const [deleteResponse] = await Promise.all([
        deleteResponsePromise,
        pendingGeneration,
      ])
      const generatedTasks = await fixtureDb
        .select({
          id: tasks.id,
          title: tasks.title,
          projectId: tasks.projectId,
          parentId: tasks.parentId,
          templateId: tasks.templateId,
          occurrenceDate: tasks.occurrenceDate,
        })
        .from(tasks)
        .where(eq(tasks.templateId, template.id))
      const [storedTemplate] = await fixtureDb
        .select({
          projectId: recurringTaskTemplates.projectId,
          lastGeneratedDate: recurringTaskTemplates.lastGeneratedDate,
        })
        .from(recurringTaskTemplates)
        .where(eq(recurringTaskTemplates.id, template.id))
      const [remainingProject] = await fixtureDb
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, project.id))

      const output = async () => ({
        delete: {
          status: deleteResponse.status,
          body: await deleteResponse.text(),
        },
        generatedTasks: generatedTasks.map((task) => ({
          ...task,
          id: 'TASK_ID',
        })),
        template: storedTemplate,
        projectExists: remainingProject != null,
      })
      expect(await output()).toEqual({
        delete: { status: 204, body: '' },
        generatedTasks: [
          {
            id: 'TASK_ID',
            title: 'Review a record 2031-04-10',
            projectId: null,
            parentId: null,
            templateId: template.id,
            occurrenceDate: '2031-04-10',
          },
        ],
        template: {
          projectId: null,
          lastGeneratedDate: '2031-04-10',
        },
        projectExists: false,
      })
    } finally {
      vi.useRealTimers()
      releaseGate?.()
      await Promise.all([
        gateTransaction?.catch(() => undefined),
        pendingDelete?.then(
          () => undefined,
          () => undefined,
        ),
        pendingGeneration?.catch(() => undefined),
      ])
      await Promise.all([
        fixtureClient.end(),
        gateClient.end(),
        deleteClient.end(),
        schedulerClient.end(),
        monitorClient.end(),
      ])
      await dropIsolatedTestDatabase(isolatedDatabase)
    }
  }, 20_000)
})
