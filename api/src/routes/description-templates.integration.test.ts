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

      expect(res.status).toBe(400)
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

      expect(res.status).toBe(400)
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

      expect(res.status).toBe(409)
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
          { name: '実装', isDefault: false },
        ],
      })
    })
  })

  describe('GET /api/description-templates', () => {
    it('returns the seeded default template', async () => {
      const res = await app.request('/api/description-templates')

      expect(await templateListSnapshot(res)).toEqual({
        status: 200,
        body: [
          {
            id: 'ID',
            name: '実装',
            whenToUse: 'コードや設定の変更を伴い、PR が出る作業',
            body: '## Why\n\n## What',
            guide:
              'Why: この作業が必要な理由と、解決する問題を書く。\nWhat: 変更する対象と内容を書く。',
            isDefault: true,
            createdAt: 'DATE',
            updatedAt: 'DATE',
          },
        ],
      })
    })
  })

  describe('GET /api/description-templates/:name', () => {
    it('returns a template by name', async () => {
      const res = await app.request(
        '/api/description-templates/%E5%AE%9F%E8%A3%85',
      )

      expect(await templateSnapshot(res)).toEqual({
        status: 200,
        body: {
          id: 'ID',
          name: '実装',
          whenToUse: 'コードや設定の変更を伴い、PR が出る作業',
          body: '## Why\n\n## What',
          guide:
            'Why: この作業が必要な理由と、解決する問題を書く。\nWhat: 変更する対象と内容を書く。',
          isDefault: true,
          createdAt: 'DATE',
          updatedAt: 'DATE',
        },
      })
    })

    it('returns 404 when the name does not exist', async () => {
      const res = await app.request('/api/description-templates/Missing')

      expect(res.status).toBe(404)
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
        defaults: [
          { name: 'Planning checklist', isDefault: true },
          { name: '実装', isDefault: false },
        ],
      })
    })

    it('rejects an empty update', async () => {
      await createTemplate('No-op')

      const res = await app.request('/api/description-templates/No-op', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 when the name does not exist', async () => {
      const res = await app.request('/api/description-templates/Missing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      })

      expect(res.status).toBe(404)
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

      expect(responseStatuses(deleteRes, getRes)).toEqual([204, 404])
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

function responseStatuses(...responses: Response[]) {
  return responses.map((response) => response.status)
}
