import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { projectFieldOptions, projectFields } from '#db/schema'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface FieldResponse {
  id: string
  projectId: string
  name: string
  type: string
  options: Array<{ id: string; name: string }>
  createdAt: string
  updatedAt: string
}

async function createProject(title: string) {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return jsonBody<{ id: string }>(response)
}

async function createField(projectId: string, body: unknown) {
  return app.request(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function normalizeField(field: FieldResponse) {
  return {
    ...field,
    id: 'FIELD_ID',
    projectId: 'PROJECT_ID',
    createdAt: 'CREATED_AT',
    updatedAt: 'UPDATED_AT',
    options: field.options.map((option, index) => ({
      id: `OPTION_${String(index + 1)}`,
      name: option.name,
    })),
  }
}

function fieldApiSnapshot<Value>(value: Value): Value {
  return value
}

function statusSnapshot(statuses: number[]) {
  return statuses
}

describe('project fields API', () => {
  it('creates, lists, renames, and deletes fields and options', async () => {
    const project = await createProject('Example Workspace')
    const createResponse = await createField(project.id, {
      name: 'Orbit Class',
      options: ['Amber', 'Cobalt'],
    })
    const created = await jsonBody<FieldResponse>(createResponse)
    const listResponse = await app.request(`/api/projects/${project.id}/fields`)
    const listed = await jsonBody<FieldResponse[]>(listResponse)

    const renameFieldResponse = await app.request(
      `/api/projects/${project.id}/fields/${created.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Orbit Group' }),
      },
    )
    const renamedField = await jsonBody<FieldResponse>(renameFieldResponse)
    const createOptionResponse = await app.request(
      `/api/projects/${project.id}/fields/${created.id}/options`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Jade' }),
      },
    )
    const createdOption = await jsonBody<{ id: string; name: string }>(
      createOptionResponse,
    )
    const renameOptionResponse = await app.request(
      `/api/projects/${project.id}/fields/${created.id}/options/${createdOption.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ivory' }),
      },
    )
    const renamedOption = await jsonBody<{ id: string; name: string }>(
      renameOptionResponse,
    )
    const deleteOptionResponse = await app.request(
      `/api/projects/${project.id}/fields/${created.id}/options/${createdOption.id}`,
      { method: 'DELETE' },
    )
    const deleteFieldResponse = await app.request(
      `/api/projects/${project.id}/fields/${created.id}`,
      { method: 'DELETE' },
    )
    const emptyListResponse = await app.request(
      `/api/projects/${project.id}/fields`,
    )

    expect(
      fieldApiSnapshot({
        statuses: [
          createResponse.status,
          listResponse.status,
          renameFieldResponse.status,
          createOptionResponse.status,
          renameOptionResponse.status,
          deleteOptionResponse.status,
          deleteFieldResponse.status,
          emptyListResponse.status,
        ],
        created: normalizeField(created),
        listed: listed.map(normalizeField),
        renamedField: normalizeField(renamedField),
        createdOption: { id: 'OPTION_3', name: createdOption.name },
        renamedOption: { id: 'OPTION_3', name: renamedOption.name },
        emptyList: await emptyListResponse.json(),
      }),
    ).toEqual({
      statuses: [201, 200, 200, 201, 200, 204, 204, 200],
      created: {
        id: 'FIELD_ID',
        projectId: 'PROJECT_ID',
        name: 'Orbit Class',
        type: 'single_select',
        options: [
          { id: 'OPTION_1', name: 'Amber' },
          { id: 'OPTION_2', name: 'Cobalt' },
        ],
        createdAt: 'CREATED_AT',
        updatedAt: 'UPDATED_AT',
      },
      listed: [
        {
          id: 'FIELD_ID',
          projectId: 'PROJECT_ID',
          name: 'Orbit Class',
          type: 'single_select',
          options: [
            { id: 'OPTION_1', name: 'Amber' },
            { id: 'OPTION_2', name: 'Cobalt' },
          ],
          createdAt: 'CREATED_AT',
          updatedAt: 'UPDATED_AT',
        },
      ],
      renamedField: {
        id: 'FIELD_ID',
        projectId: 'PROJECT_ID',
        name: 'Orbit Group',
        type: 'single_select',
        options: [
          { id: 'OPTION_1', name: 'Amber' },
          { id: 'OPTION_2', name: 'Cobalt' },
        ],
        createdAt: 'CREATED_AT',
        updatedAt: 'UPDATED_AT',
      },
      createdOption: { id: 'OPTION_3', name: 'Jade' },
      renamedOption: { id: 'OPTION_3', name: 'Ivory' },
      emptyList: [],
    })
  })

  it('returns conflicts for duplicate field and option names', async () => {
    const project = await createProject('Example Workspace')
    const first = await createField(project.id, {
      name: 'Orbit Class',
      options: ['Amber'],
    })
    const field = await jsonBody<FieldResponse>(first)
    const secondResponse = await createField(project.id, {
      name: 'Other Class',
      options: ['Rose'],
    })
    const secondField = await jsonBody<FieldResponse>(secondResponse)
    const secondOptionResponse = await app.request(
      `/api/projects/${project.id}/fields/${secondField.id}/options`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Jade' }),
      },
    )
    const secondOption = await jsonBody<{ id: string; name: string }>(
      secondOptionResponse,
    )
    const duplicateField = await createField(project.id, {
      name: 'Orbit Class',
    })
    const duplicateFieldRename = await app.request(
      `/api/projects/${project.id}/fields/${secondField.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Orbit Class' }),
      },
    )
    const duplicateOption = await app.request(
      `/api/projects/${project.id}/fields/${field.id}/options`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Amber' }),
      },
    )
    const duplicateOptionRename = await app.request(
      `/api/projects/${project.id}/fields/${secondField.id}/options/${secondOption.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Rose' }),
      },
    )
    const duplicateOptionInCreate = await createField(project.id, {
      name: 'Another Class',
      options: ['Rose', 'Rose'],
    })
    const listResponse = await app.request(`/api/projects/${project.id}/fields`)

    expect(
      fieldApiSnapshot({
        statuses: [
          duplicateField.status,
          duplicateFieldRename.status,
          duplicateOption.status,
          duplicateOptionRename.status,
          duplicateOptionInCreate.status,
        ],
        fields: (await jsonBody<FieldResponse[]>(listResponse)).map(
          normalizeField,
        ),
      }),
    ).toEqual({
      statuses: [409, 409, 409, 409, 409],
      fields: [
        {
          id: 'FIELD_ID',
          projectId: 'PROJECT_ID',
          name: 'Orbit Class',
          type: 'single_select',
          options: [{ id: 'OPTION_1', name: 'Amber' }],
          createdAt: 'CREATED_AT',
          updatedAt: 'UPDATED_AT',
        },
        {
          id: 'FIELD_ID',
          projectId: 'PROJECT_ID',
          name: 'Other Class',
          type: 'single_select',
          options: [
            { id: 'OPTION_1', name: 'Rose' },
            { id: 'OPTION_2', name: 'Jade' },
          ],
          createdAt: 'CREATED_AT',
          updatedAt: 'UPDATED_AT',
        },
      ],
    })
  })

  it('returns 404 for missing projects and resources outside their parent', async () => {
    const projectA = await createProject('Example Workspace A')
    const projectB = await createProject('Example Workspace B')
    const responseA = await createField(projectA.id, {
      name: 'Orbit Class',
      options: ['Amber'],
    })
    const responseB = await createField(projectB.id, {
      name: 'Orbit Class',
      options: ['Amber'],
    })
    const fieldA = await jsonBody<FieldResponse>(responseA)
    const fieldB = await jsonBody<FieldResponse>(responseB)
    const optionA = fieldA.options[0]
    assertDefined(optionA)
    const projectMissing = await app.request('/api/projects/missing/fields')
    const foreignField = await app.request(
      `/api/projects/${projectB.id}/fields/${fieldA.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Elsewhere' }),
      },
    )
    const foreignOption = await app.request(
      `/api/projects/${projectB.id}/fields/${fieldB.id}/options/${optionA.id}`,
      { method: 'DELETE' },
    )

    expect(
      statusSnapshot([
        projectMissing.status,
        foreignField.status,
        foreignOption.status,
      ]),
    ).toEqual([404, 404, 404])
  })

  it('cascades project deletion to fields and options', async () => {
    const project = await createProject('Example Workspace')
    await createField(project.id, {
      name: 'Orbit Class',
      options: ['Amber'],
    })
    const deleteResponse = await app.request(`/api/projects/${project.id}`, {
      method: 'DELETE',
    })
    const fieldRows = await db.select().from(projectFields)
    const optionRows = await db.select().from(projectFieldOptions)

    expect(
      fieldApiSnapshot({
        status: deleteResponse.status,
        fields: fieldRows,
        options: optionRows,
      }),
    ).toEqual({ status: 204, fields: [], options: [] })
  })
})
