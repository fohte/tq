import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskFieldValues, taskRelations } from '#db/schema'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import {
  type TaskListItemResponse,
  type TaskResponse,
  toListItemResponse,
  toListRowResponse,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function createProject(title: string) {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return jsonBody<{ id: string }>(response)
}

async function createField(projectId: string, name: string, options: string[]) {
  const response = await app.request(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, options }),
  })
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
})
