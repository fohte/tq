import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import { openApiDocument } from '#openapi/task-contract'

it('matches the committed OpenAPI document', async () => {
  const committedDocument: unknown = JSON.parse(
    await readFile(new URL('../../../openapi.json', import.meta.url), 'utf8'),
  )

  expect(openApiDocument).toEqual(committedDocument)
})
