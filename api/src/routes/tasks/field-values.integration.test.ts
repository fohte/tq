import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskFieldValues, taskRelations } from '#db/schema'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
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

function taskFieldValuesSnapshot<Value>(value: Value): Value {
  return value
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
    const subtask = await jsonBody<{
      projectId: string | null
      fieldValues: unknown[]
    }>(subtaskResponse)

    expect(
      taskFieldValuesSnapshot({
        statuses: [
          parentResponse.status,
          checklistResponse.status,
          itemResponse.status,
          promotionResponse.status,
          subtaskResponse.status,
        ],
        subtaskProjectId: subtask.projectId,
        subtaskValues: subtask.fieldValues,
      }),
    ).toEqual({
      statuses: [201, 201, 201, 200, 200],
      subtaskProjectId: project.id,
      subtaskValues: [],
    })
  })

  it('resolves ids and names, updates selected fields, and returns values in detail and list views', async () => {
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
    const created = await jsonBody<{
      id: string
      fieldValues: Array<{
        fieldId: string
        fieldName: string
        optionId: string
        optionName: string
      }>
    }>(createResponse)
    const updateResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      {
        fieldValues: {
          [secondField.id]: secondOption.id,
        },
      },
    )
    const updated = await jsonBody<{ fieldValues: unknown[] }>(updateResponse)
    const detailResponse = await app.request(`/api/tasks/${created.id}`)
    const detail = await jsonBody<{ fieldValues: unknown[] }>(detailResponse)
    const fullListResponse = await app.request(
      '/api/tasks?view=full&context=all&status=all&limit=unlimited',
    )
    const fullList =
      await jsonBody<Array<{ id: string; fieldValues: unknown[] }>>(
        fullListResponse,
      )
    const rowListResponse = await app.request(
      '/api/tasks?view=row&context=all&status=all&limit=unlimited',
    )
    const rowList =
      await jsonBody<Array<{ id: string; fieldValues: unknown[] }>>(
        rowListResponse,
      )
    const clearResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { fieldValues: { [firstField.id]: null } },
    )
    const cleared = await jsonBody<{ fieldValues: unknown[] }>(clearResponse)
    const expected = [
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
      taskFieldValuesSnapshot({
        statuses: [
          createResponse.status,
          updateResponse.status,
          detailResponse.status,
          fullListResponse.status,
          rowListResponse.status,
          clearResponse.status,
        ],
        createdValues: created.fieldValues,
        updatedValues: updated.fieldValues,
        detailValues: detail.fieldValues,
        fullListValues: fullList.find((task) => task.id === created.id)
          ?.fieldValues,
        rowListValues: rowList.find((task) => task.id === created.id)
          ?.fieldValues,
        clearedValues: cleared.fieldValues,
      }),
    ).toEqual({
      statuses: [201, 200, 200, 200, 200, 200],
      createdValues: [
        {
          fieldId: firstField.id,
          fieldName: firstField.name,
          optionId: firstOption.id,
          optionName: firstOption.name,
        },
      ],
      updatedValues: expected,
      detailValues: expected,
      fullListValues: expected,
      rowListValues: expected,
      clearedValues: [
        {
          fieldId: secondField.id,
          fieldName: secondField.name,
          optionId: secondOption.id,
          optionName: secondOption.name,
        },
      ],
    })
  })

  it('rejects missing and cross-project fields or options without changing existing values', async () => {
    const sourceProject = await createProject('Sample Archive')
    const otherProject = await createProject('Sample Archive Two')
    const field = await createField(sourceProject.id, 'Review Track', [
      'North Route',
    ])
    const foreignField = await createField(otherProject.id, 'Review Track', [
      'South Route',
    ])
    const sourceOption = field.options[0]
    const foreignOption = foreignField.options[0]
    if (sourceOption == null || foreignOption == null) {
      throw new Error('Test field options were not created')
    }
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Review a record',
      projectId: sourceProject.id,
      fieldValues: { [field.id]: sourceOption.id },
    })
    const created = await jsonBody<{ id: string }>(createResponse)
    const blockerResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Review a supporting record',
    })
    const blocker = await jsonBody<{ id: string }>(blockerResponse)
    const withoutProjectResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Unassigned record',
      fieldValues: { [field.name]: sourceOption.name },
    })
    const foreignFieldResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      {
        blockedBy: [blocker.id],
        fieldValues: { [foreignField.id]: foreignOption.id },
      },
    )
    const foreignOptionResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { fieldValues: { [field.id]: foreignOption.id } },
    )
    const missingOptionResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { fieldValues: { [field.name]: 'Unlisted Route' } },
    )
    const detailResponse = await app.request(`/api/tasks/${created.id}`)
    const detail = await jsonBody<{ fieldValues: unknown[] }>(detailResponse)
    const storedValues = await db
      .select()
      .from(taskFieldValues)
      .where(eq(taskFieldValues.taskId, created.id))
    const blockedRelations = await db
      .select()
      .from(taskRelations)
      .where(eq(taskRelations.sourceTaskId, created.id))

    expect(
      taskFieldValuesSnapshot({
        statuses: [
          createResponse.status,
          blockerResponse.status,
          withoutProjectResponse.status,
          foreignFieldResponse.status,
          foreignOptionResponse.status,
          missingOptionResponse.status,
          detailResponse.status,
        ],
        values: detail.fieldValues,
        storedCount: storedValues.length,
        blockedRelationCount: blockedRelations.length,
      }),
    ).toEqual({
      statuses: [201, 201, 400, 400, 400, 400, 200],
      values: [
        {
          fieldId: field.id,
          fieldName: field.name,
          optionId: sourceOption.id,
          optionName: sourceOption.name,
        },
      ],
      storedCount: 1,
      blockedRelationCount: 0,
    })
  })

  it('clears values on project changes and deletes and refreshes tasks when names change', async () => {
    const sourceProject = await createProject('Sample Catalogue')
    const destinationProject = await createProject('Sample Catalogue Two')
    const sourceField = await createField(sourceProject.id, 'Stage Map', [
      'First Span',
      'Second Span',
    ])
    const destinationField = await createField(
      destinationProject.id,
      'Stage Map',
      ['Third Span'],
    )
    const sourceOption = sourceField.options[0]
    const secondSourceOption = sourceField.options[1]
    const destinationOption = destinationField.options[0]
    if (
      sourceOption == null ||
      secondSourceOption == null ||
      destinationOption == null
    ) {
      throw new Error('Test field options were not created')
    }
    const createResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Map a sample',
      projectId: sourceProject.id,
      fieldValues: { [sourceField.id]: sourceOption.id },
    })
    const created = await jsonBody<{ id: string }>(createResponse)
    const changedEvents: ChangeEvent[] = []
    const unsubscribe = subscribeToChangeEvents((event) => {
      changedEvents.push(event)
    })
    const renameOptionResponse = await requestJson(
      `/api/projects/${sourceProject.id}/fields/${sourceField.id}/options/${sourceOption.id}`,
      'PATCH',
      { name: 'Renamed Span' },
    )
    const renamedDetailResponse = await app.request(`/api/tasks/${created.id}`)
    const renamedDetail = await jsonBody<{
      fieldValues: Array<{ fieldName: string; optionName: string }>
    }>(renamedDetailResponse)
    const renameTaskChangeIds = changedEvents.map((event) => event.taskIds)
    unsubscribe()
    const fieldRenameEvents: ChangeEvent[] = []
    const unsubscribeFieldRename = subscribeToChangeEvents((event) => {
      fieldRenameEvents.push(event)
    })
    const renameFieldResponse = await requestJson(
      `/api/projects/${sourceProject.id}/fields/${sourceField.id}`,
      'PATCH',
      { name: 'Renamed Stage Map' },
    )
    const fieldRenameTaskChangeIds = fieldRenameEvents.map(
      (event) => event.taskIds,
    )
    unsubscribeFieldRename()
    const fieldRenamedDetailResponse = await app.request(
      `/api/tasks/${created.id}`,
    )
    const fieldRenamedDetail = await jsonBody<{
      fieldValues: Array<{ fieldName: string; optionName: string }>
    }>(fieldRenamedDetailResponse)
    const statusResponse = await requestJson(
      `/api/tasks/${created.id}/status`,
      'PATCH',
      { status: 'completed' },
    )
    const statusTask = await jsonBody<{
      fieldValues: Array<{
        fieldId: string
        fieldName: string
        optionId: string
        optionName: string
      }>
    }>(statusResponse)
    const moveResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      {
        projectId: destinationProject.id,
        fieldValues: { [destinationField.name]: destinationOption.name },
      },
    )
    const moved = await jsonBody<{
      fieldValues: unknown[]
      projectId: string
    }>(moveResponse)
    const clearProjectResponse = await requestJson(
      `/api/tasks/${created.id}`,
      'PATCH',
      { projectId: null },
    )
    const clearProjectTask = await jsonBody<{
      fieldValues: unknown[]
      projectId: string | null
    }>(clearProjectResponse)
    const clearedProject = {
      projectId: clearProjectTask.projectId,
      fieldValues: clearProjectTask.fieldValues,
    }
    const optionDeleteTaskResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Keep an option record',
      projectId: sourceProject.id,
      fieldValues: { [sourceField.id]: secondSourceOption.id },
    })
    const optionDeleteTask = await jsonBody<{ id: string }>(
      optionDeleteTaskResponse,
    )
    const optionDeleteEvents: ChangeEvent[] = []
    const unsubscribeOptionDelete = subscribeToChangeEvents((event) => {
      optionDeleteEvents.push(event)
    })
    const deleteOptionResponse = await app.request(
      `/api/projects/${sourceProject.id}/fields/${sourceField.id}/options/${secondSourceOption.id}`,
      { method: 'DELETE' },
    )
    const optionDeleteTaskChangeIds = optionDeleteEvents.map(
      (event) => event.taskIds,
    )
    unsubscribeOptionDelete()
    const optionDeleteDetailResponse = await app.request(
      `/api/tasks/${optionDeleteTask.id}`,
    )
    const optionDeleteDetail = await jsonBody<{
      fieldValues: unknown[]
    }>(optionDeleteDetailResponse)
    const sourceFieldDeleteTaskResponse = await requestJson(
      '/api/tasks',
      'POST',
      {
        title: 'Keep an unassigned record',
        projectId: sourceProject.id,
        fieldValues: { [sourceField.id]: sourceOption.id },
      },
    )
    const fieldDeleteTask = await jsonBody<{ id: string }>(
      sourceFieldDeleteTaskResponse,
    )
    const fieldDeleteEvents: ChangeEvent[] = []
    const unsubscribeFieldDelete = subscribeToChangeEvents((event) => {
      fieldDeleteEvents.push(event)
    })
    const sourceFieldDeleteResponse = await app.request(
      `/api/projects/${sourceProject.id}/fields/${sourceField.id}`,
      { method: 'DELETE' },
    )
    const fieldDeleteTaskChangeIds = fieldDeleteEvents.map(
      (event) => event.taskIds,
    )
    unsubscribeFieldDelete()
    const sourceFieldDeleteDetailResponse = await app.request(
      `/api/tasks/${fieldDeleteTask.id}`,
    )
    const projectDeleteTaskResponse = await requestJson('/api/tasks', 'POST', {
      title: 'Keep a project record',
      projectId: destinationProject.id,
      fieldValues: { [destinationField.id]: destinationOption.id },
    })
    const projectDeleteTask = await jsonBody<{ id: string }>(
      projectDeleteTaskResponse,
    )
    const deleteProjectResponse = await app.request(
      `/api/projects/${destinationProject.id}`,
      { method: 'DELETE' },
    )
    const afterProjectDeleteResponse = await app.request(
      `/api/tasks/${projectDeleteTask.id}`,
    )
    const afterProjectDelete = await jsonBody<{
      projectId: string | null
      fieldValues: unknown[]
    }>(afterProjectDeleteResponse)
    const afterProjectDeleteValues = {
      projectId: afterProjectDelete.projectId,
      fieldValues: afterProjectDelete.fieldValues,
    }

    const fieldDeleteDetail = await jsonBody<{ fieldValues: unknown[] }>(
      sourceFieldDeleteDetailResponse,
    )
    expect(
      taskFieldValuesSnapshot({
        statuses: [
          createResponse.status,
          renameOptionResponse.status,
          renamedDetailResponse.status,
          renameFieldResponse.status,
          fieldRenamedDetailResponse.status,
          moveResponse.status,
          clearProjectResponse.status,
          sourceFieldDeleteTaskResponse.status,
          optionDeleteTaskResponse.status,
          deleteOptionResponse.status,
          optionDeleteDetailResponse.status,
          sourceFieldDeleteResponse.status,
          sourceFieldDeleteDetailResponse.status,
          statusResponse.status,
          projectDeleteTaskResponse.status,
          deleteProjectResponse.status,
          afterProjectDeleteResponse.status,
        ],
        renamedOptionName: renamedDetail.fieldValues[0]?.optionName,
        renamedFieldValue: fieldRenamedDetail.fieldValues,
        statusValues: statusTask.fieldValues,
        movedProjectId: moved.projectId,
        movedValues: moved.fieldValues,
        clearedProject,
        fieldDeleteValues: fieldDeleteDetail.fieldValues,
        optionDeleteValues: optionDeleteDetail.fieldValues,
        afterProjectDelete: afterProjectDeleteValues,
        taskChangeIds: {
          optionRename: renameTaskChangeIds,
          fieldRename: fieldRenameTaskChangeIds,
          optionDelete: optionDeleteTaskChangeIds,
          fieldDelete: fieldDeleteTaskChangeIds,
        },
      }),
    ).toEqual({
      statuses: [
        201, 200, 200, 200, 200, 200, 200, 201, 201, 204, 200, 204, 200, 200,
        201, 204, 200,
      ],
      renamedOptionName: 'Renamed Span',
      renamedFieldValue: [
        {
          fieldId: sourceField.id,
          fieldName: 'Renamed Stage Map',
          optionId: sourceOption.id,
          optionName: 'Renamed Span',
        },
      ],
      statusValues: [
        {
          fieldId: sourceField.id,
          fieldName: 'Renamed Stage Map',
          optionId: sourceOption.id,
          optionName: 'Renamed Span',
        },
      ],
      movedProjectId: destinationProject.id,
      movedValues: [
        {
          fieldId: destinationField.id,
          fieldName: destinationField.name,
          optionId: destinationOption.id,
          optionName: destinationOption.name,
        },
      ],
      clearedProject: { projectId: null, fieldValues: [] },
      fieldDeleteValues: [],
      optionDeleteValues: [],
      afterProjectDelete: { projectId: null, fieldValues: [] },
      taskChangeIds: {
        optionRename: [[created.id]],
        fieldRename: [[created.id]],
        optionDelete: [[optionDeleteTask.id]],
        fieldDelete: [[fieldDeleteTask.id]],
      },
    })
  })
})
