import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { MAX_MARKDOWN_CONTENT_LENGTH } from '#constants/content-length'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface DescriptionTemplateResponse {
  id: string
  name: string
  whenToUse: string
  body: string
  guide: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

function normalizeTemplate(template: DescriptionTemplateResponse) {
  return { ...template, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

describe('description templates API', () => {
  describe('POST /api/description-templates', () => {
    it('creates a template with all fields', async () => {
      const res = await app.request('/api/description-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Release preparation',
          whenToUse: 'Use when preparing a release',
          body: '## Context\n\n## Checklist',
          guide: 'Context: explain the release scope',
          isDefault: false,
        }),
      })

      expect(await templateSnapshot(res)).toEqual({
        status: 201,
        body: {
          id: 'ID',
          name: 'Release preparation',
          whenToUse: 'Use when preparing a release',
          body: '## Context\n\n## Checklist',
          guide: 'Context: explain the release scope',
          isDefault: false,
          createdAt: 'DATE',
          updatedAt: 'DATE',
        },
      })
    })

    it('rejects an empty template name', async () => {
      const res = await app.request('/api/description-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          whenToUse: 'Use for planning',
          body: '## Context',
          guide: 'Explain the context',
        }),
      })

      expect(await responseSnapshot(res)).toEqual({
        status: 400,
        body: {
          success: false,
          error: {
            name: 'ZodError',
            message:
              '[\n  {\n    "origin": "string",\n    "code": "too_small",\n    "minimum": 1,\n    "inclusive": true,\n    "path": [\n      "name"\n    ],\n    "message": "Too small: expected string to have >=1 characters"\n  }\n]',
          },
        },
      })
    })

    it('rejects names that are not valid path segments', async () => {
      const res = await app.request('/api/description-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '..',
          whenToUse: 'Use for planning',
          body: '## Context',
          guide: 'Explain the context',
        }),
      })

      expect(await responseSnapshot(res)).toEqual({
        status: 400,
        body: {
          success: false,
          error: {
            name: 'ZodError',
            message:
              '[\n  {\n    "code": "custom",\n    "path": [\n      "name"\n    ],\n    "message": "Description template name must be a valid path segment"\n  }\n]',
          },
        },
      })
    })

    it('rejects a body longer than task descriptions allow', async () => {
      const res = await app.request('/api/description-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Oversized',
          whenToUse: 'Use for planning',
          body: 'x'.repeat(MAX_MARKDOWN_CONTENT_LENGTH + 1),
          guide: 'Explain the context',
        }),
      })

      expect(await responseSnapshot(res)).toEqual({
        status: 400,
        body: {
          success: false,
          error: {
            name: 'ZodError',
            message:
              '[\n  {\n    "origin": "string",\n    "code": "too_big",\n    "maximum": 100000,\n    "inclusive": true,\n    "path": [\n      "body"\n    ],\n    "message": "Too big: expected string to have <=100000 characters"\n  }\n]',
          },
        },
      })
    })

    it('rejects a duplicate template name', async () => {
      await createTemplate('Duplicate name')

      const res = await app.request('/api/description-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate name',
          whenToUse: 'Use for planning',
          body: '## Context',
          guide: 'Explain the context',
        }),
      })

      expect(await responseSnapshot(res)).toEqual({
        status: 409,
        body: { error: 'A description template with this name already exists' },
      })
    })

    it('makes a new template the default when requested', async () => {
      await createTemplate('Before default')

      const res = await app.request('/api/description-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Planning default',
          whenToUse: 'Use when planning work',
          body: '## Goal',
          guide: 'Goal: describe the outcome',
          isDefault: true,
        }),
      })
      const template = await jsonBody<DescriptionTemplateResponse>(res)
      const listRes = await app.request('/api/description-templates')
      const templates = await jsonBody<DescriptionTemplateResponse[]>(listRes)
      expect(
        templateSnapshotWithDefaults(res.status, template, templates),
      ).toEqual({
        status: 201,
        template: {
          id: 'ID',
          name: 'Planning default',
          whenToUse: 'Use when planning work',
          body: '## Goal',
          guide: 'Goal: describe the outcome',
          isDefault: true,
          createdAt: 'DATE',
          updatedAt: 'DATE',
        },
        defaults: [
          { name: 'Planning default', isDefault: true },
          { name: 'Before default', isDefault: false },
        ],
      })
    })
  })

  describe('GET /api/description-templates', () => {
    it('returns an empty list when no templates exist', async () => {
      const res = await app.request('/api/description-templates')

      expect(await templateListSnapshot(res)).toEqual({
        status: 200,
        body: [],
      })
    })
  })

  describe('GET /api/description-templates/:name', () => {
    it('returns a template by name', async () => {
      await createTemplate('Weekly plan')
      const res = await app.request('/api/description-templates/Weekly%20plan')

      expect(await templateSnapshot(res)).toEqual({
        status: 200,
        body: {
          id: 'ID',
          name: 'Weekly plan',
          whenToUse: 'Use for planning',
          body: '## Context',
          guide: 'Explain the context',
          isDefault: false,
          createdAt: 'DATE',
          updatedAt: 'DATE',
        },
      })
    })

    it('returns 404 when the name does not exist', async () => {
      const res = await app.request('/api/description-templates/Missing')

      expect(await responseSnapshot(res)).toEqual({
        status: 404,
        body: { error: 'Description template not found' },
      })
    })
  })

  describe('PATCH /api/description-templates/:name', () => {
    it('renames a template and replaces the previous default', async () => {
      await createTemplate('Planning')

      const res = await app.request('/api/description-templates/Planning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Planning checklist',
          whenToUse: 'Use when planning work',
          body: '## Goal\n\n## Steps',
          guide: 'Goal: describe the outcome',
          isDefault: true,
        }),
      })
      const updated = await jsonBody<DescriptionTemplateResponse>(res)
      const listRes = await app.request('/api/description-templates')
      const templates = await jsonBody<DescriptionTemplateResponse[]>(listRes)

      expect(
        templateSnapshotWithDefaults(res.status, updated, templates),
      ).toEqual({
        status: 200,
        template: {
          id: 'ID',
          name: 'Planning checklist',
          whenToUse: 'Use when planning work',
          body: '## Goal\n\n## Steps',
          guide: 'Goal: describe the outcome',
          isDefault: true,
          createdAt: 'DATE',
          updatedAt: 'DATE',
        },
        defaults: [{ name: 'Planning checklist', isDefault: true }],
      })
    })

    it('rejects an empty update', async () => {
      await createTemplate('No-op')

      const res = await app.request('/api/description-templates/No-op', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(await responseSnapshot(res)).toEqual({
        status: 400,
        body: { error: 'At least one field must be provided' },
      })
    })

    it('returns 404 when the name does not exist', async () => {
      const res = await app.request('/api/description-templates/Missing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      })

      expect(await responseSnapshot(res)).toEqual({
        status: 404,
        body: { error: 'Description template not found' },
      })
    })

    it('rejects a rename to a name already in use without changing either template', async () => {
      await createTemplate('Original name')
      await createTemplate('Other name')

      const res = await app.request('/api/description-templates/Other%20name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Original name' }),
      })

      expect(
        await duplicateRenameSnapshot(res, 'Original name', 'Other name'),
      ).toEqual({
        response: {
          status: 409,
          body: {
            error: 'A description template with this name already exists',
          },
        },
        templates: [
          {
            status: 200,
            body: {
              id: 'ID',
              name: 'Original name',
              whenToUse: 'Use for planning',
              body: '## Context',
              guide: 'Explain the context',
              isDefault: false,
              createdAt: 'DATE',
              updatedAt: 'DATE',
            },
          },
          {
            status: 200,
            body: {
              id: 'ID',
              name: 'Other name',
              whenToUse: 'Use for planning',
              body: '## Context',
              guide: 'Explain the context',
              isDefault: false,
              createdAt: 'DATE',
              updatedAt: 'DATE',
            },
          },
        ],
      })
    })
  })

  describe('DELETE /api/description-templates/:name', () => {
    it('deletes a template by name', async () => {
      await createTemplate('To delete')

      const deleteRes = await app.request(
        '/api/description-templates/To%20delete',
        { method: 'DELETE' },
      )
      const getRes = await app.request('/api/description-templates/To%20delete')

      expect(await deleteSnapshot(deleteRes, getRes)).toEqual({
        delete: { status: 204, body: null },
        get: {
          status: 404,
          body: { error: 'Description template not found' },
        },
      })
    })
  })
})

async function createTemplate(name: string) {
  const res = await app.request('/api/description-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      whenToUse: 'Use for planning',
      body: '## Context',
      guide: 'Explain the context',
    }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create description template: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<DescriptionTemplateResponse>(res)
}

async function templateSnapshot(res: Response) {
  return {
    status: res.status,
    body: normalizeTemplate(await jsonBody<DescriptionTemplateResponse>(res)),
  }
}

async function responseSnapshot(res: Response) {
  return {
    status: res.status,
    body: res.status === 204 ? null : await jsonBody<unknown>(res),
  }
}

async function templateListSnapshot(res: Response) {
  return {
    status: res.status,
    body: (await jsonBody<DescriptionTemplateResponse[]>(res)).map(
      normalizeTemplate,
    ),
  }
}

function templateSnapshotWithDefaults(
  status: number,
  template: DescriptionTemplateResponse,
  templates: DescriptionTemplateResponse[],
) {
  return {
    status,
    template: normalizeTemplate(template),
    defaults: templates.map(({ name, isDefault }) => ({ name, isDefault })),
  }
}

async function duplicateRenameSnapshot(
  res: Response,
  firstName: string,
  secondName: string,
) {
  const templates = await Promise.all(
    [firstName, secondName].map(async (name) =>
      templateSnapshot(
        await app.request(
          `/api/description-templates/${encodeURIComponent(name)}`,
        ),
      ),
    ),
  )

  return {
    response: await responseSnapshot(res),
    templates,
  }
}

async function deleteSnapshot(deleteRes: Response, getRes: Response) {
  return {
    delete: await responseSnapshot(deleteRes),
    get: await responseSnapshot(getRes),
  }
}
