import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openApiDocument } from '#openapi/task-contract'

const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../openapi.json',
)

await writeFile(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`)
