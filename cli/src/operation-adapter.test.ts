import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { OperationDefinition } from 'api/operations'
import { Command } from 'commander'
import { okAsync } from 'neverthrow'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { fakeStdin, spyStderr, spyStdout } from '#commands/test-support'
import { registerOperations } from '#operation-adapter'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function makeOperation(
  config: Pick<
    OperationDefinition,
    'path' | 'inputSchema' | 'positionalArgs' | 'cli' | 'surface'
  >,
): OperationDefinition {
  return {
    path: config.path,
    description: 'Exercise operation adapter behavior.',
    inputSchema: config.inputSchema,
    positionalArgs: config.positionalArgs,
    kind: 'read',
    routes: [],
    ...(config.surface == null ? {} : { surface: config.surface }),
    cli: config.cli,
    run: (_client, input) => okAsync(input),
  }
}

function createProgram(
  operations: readonly OperationDefinition[],
  fetchImpl: typeof fetch = () => Promise.resolve(new Response()),
): Command {
  const program = new Command()
    .exitOverride()
    .option('--api-url <url>')
    .option('--web-url <url>')
  registerOperations(
    program,
    operations,
    'Exercise operation adapter behavior.',
    fetchImpl,
    fakeStdin(true),
  )
  return program
}

async function parse(program: Command, args: string[]): Promise<void> {
  await program.parseAsync(['node', 'tq', ...args], { from: 'node' })
}

function adapterOutcome(
  stdout: unknown,
  stderr: unknown,
  details: Record<string, unknown> = {},
) {
  return { stdout, stderr, ...details }
}

describe('registerOperations', () => {
  it('omits an optional positional argument from the operation input', async () => {
    const operation = makeOperation({
      path: ['demo', 'search'],
      inputSchema: z.object({ query: z.string().optional() }),
      positionalArgs: [{ name: 'query', optional: true }],
      cli: { output: { kind: 'json' } },
    })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'search',
    ])

    expect(write.mock.calls).toEqual([[`${JSON.stringify({}, null, 2)}\n`]])
  })

  it('passes a variadic positional argument as an array', async () => {
    const operation = makeOperation({
      path: ['demo', 'set'],
      inputSchema: z.object({
        key: z.string(),
        date: z.string(),
        taskIds: z.array(z.string()).optional(),
      }),
      positionalArgs: [
        'key',
        'date',
        { name: 'taskIds', optional: true, variadic: true },
      ],
      cli: { output: { kind: 'json' } },
    })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'set',
      'inbox',
      '2031-04-05',
      'task-a',
      'task-b',
    ])

    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          { key: 'inbox', date: '2031-04-05', taskIds: ['task-a', 'task-b'] },
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('omits an optional variadic positional argument when no values are provided', async () => {
    const operation = makeOperation({
      path: ['demo', 'set'],
      inputSchema: z.object({
        key: z.string(),
        date: z.string(),
        taskIds: z.array(z.string()).optional(),
      }),
      positionalArgs: [
        'key',
        'date',
        { name: 'taskIds', optional: true, variadic: true },
      ],
      cli: { output: { kind: 'json' } },
    })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'set',
      'inbox',
      '2031-04-05',
    ])

    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          { key: 'inbox', date: '2031-04-05', taskIds: [] },
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('applies operation env defaults and parses opted-in comma-separated arrays', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const operation = makeOperation({
      path: ['demo', 'list'],
      inputSchema: z.object({
        context: z.enum(['work', 'personal']).optional(),
        labels: z.array(z.string()).optional(),
        blockedBy: z
          .array(z.union([z.number().int(), z.string().regex(/^\d+$/)]))
          .optional(),
      }),
      positionalArgs: [],
      cli: {
        envDefaults: { context: 'TQ_CONTEXT' },
        commaSeparatedOptions: ['labels', 'blockedBy'],
        output: { kind: 'json' },
      },
    })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'list',
      '--labels',
      'alpha, beta,,gamma',
      '--blocked-by',
      '12,34',
    ])

    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          {
            context: 'work',
            labels: ['alpha', 'beta', 'gamma'],
            blockedBy: ['12', '34'],
          },
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('keeps an explicitly empty comma-separated option as an empty array', async () => {
    const operation = makeOperation({
      path: ['demo', 'update'],
      inputSchema: z.object({ labels: z.array(z.string()).optional() }),
      positionalArgs: [],
      cli: {
        commaSeparatedOptions: ['labels'],
        output: { kind: 'json' },
      },
    })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'update',
      '--labels',
      '',
    ])

    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ labels: [] }, null, 2)}\n`],
    ])
  })

  it('omits absent optional content input', async () => {
    const operation = makeOperation({
      path: ['demo', 'page', 'create'],
      inputSchema: z.object({ content: z.string().optional() }),
      positionalArgs: [],
      cli: {
        contentInput: { field: 'content', required: false },
        output: { kind: 'json' },
      },
    })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'page',
      'create',
    ])

    expect(write.mock.calls).toEqual([[`${JSON.stringify({}, null, 2)}\n`]])
  })

  it('writes text content to a file and prints the remaining response fields', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'tq-operation-adapter-'))
    try {
      const outputPath = join(tmpDir, 'page.md')
      const operation = makeOperation({
        path: ['demo', 'page', 'get'],
        inputSchema: z.object({ id: z.string() }),
        positionalArgs: ['id'],
        cli: {
          output: {
            kind: 'json',
            fileOutput: {
              kind: 'content',
              option: {
                name: 'output',
                description: 'Write content to a file',
              },
              field: 'content',
            },
          },
        },
      })
      operation.run = () =>
        okAsync({
          id: 'page-example',
          title: 'Example page',
          content: '# Body',
        })
      const write = spyStdout()

      await parse(createProgram([operation]), [
        '--api-url',
        'https://api.example',
        'demo',
        'page',
        'get',
        'page-example',
        '--output',
        outputPath,
      ])

      expect(
        adapterOutcome(write.mock.calls, [], {
          content: await readFile(outputPath, 'utf8'),
        }),
      ).toEqual({
        stdout: [
          [
            `${JSON.stringify({ id: 'page-example', title: 'Example page' }, null, 2)}\n`,
          ],
        ],
        stderr: [],
        content: '# Body',
      })
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('downloads binary output and prints the configured file summary', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'tq-operation-adapter-'))
    try {
      const outputPath = join(tmpDir, 'image.bin')
      const fetchImpl = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(new Uint8Array([1, 2, 3]))),
      )
      const operation = makeOperation({
        path: ['demo', 'image', 'get'],
        inputSchema: z.object({ id: z.string() }),
        positionalArgs: ['id'],
        cli: {
          output: {
            kind: 'json',
            fields: ['url'],
            fileOutput: {
              kind: 'binary',
              option: {
                name: 'output',
                description: 'Download to a file',
              },
              urlField: 'url',
              summaryFields: ['id'],
              outputPathField: 'output',
            },
          },
        },
      })
      operation.run = () =>
        okAsync({ id: 'image-example', url: 'https://files.example/signed' })
      const write = spyStdout()
      const stderr = spyStderr()

      await parse(createProgram([operation], fetchImpl), [
        '--api-url',
        'https://api.example',
        'demo',
        'image',
        'get',
        'image-example',
        '--output',
        outputPath,
      ])

      expect(
        adapterOutcome(write.mock.calls, stderr.mock.calls, {
          bytes: Array.from(await readFile(outputPath)),
          downloads: fetchImpl.mock.calls.map(([input]) =>
            input instanceof Request ? input.url : input.toString(),
          ),
        }),
      ).toEqual({
        stdout: [
          [
            `${JSON.stringify({ id: 'image-example', output: outputPath }, null, 2)}\n`,
          ],
        ],
        stderr: [],
        bytes: [1, 2, 3],
        downloads: ['https://files.example/signed'],
      })
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('prints only the configured URL field when binary output has no file option', async () => {
    const operation = makeOperation({
      path: ['demo', 'image', 'get'],
      inputSchema: z.object({ id: z.string() }),
      positionalArgs: ['id'],
      cli: {
        output: {
          kind: 'json',
          fields: ['url'],
          fileOutput: {
            kind: 'binary',
            option: { name: 'output', description: 'Download to a file' },
            urlField: 'url',
            summaryFields: ['id'],
            outputPathField: 'output',
          },
        },
      },
    })
    operation.run = () =>
      okAsync({ id: 'image-example', url: 'https://files.example/signed' })
    const write = spyStdout()

    await parse(createProgram([operation]), [
      '--api-url',
      'https://api.example',
      'demo',
      'image',
      'get',
      'image-example',
    ])

    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ url: 'https://files.example/signed' }, null, 2)}\n`],
    ])
  })

  it('prints a web URL without requiring an API URL or making a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response()))
    const operation = makeOperation({
      path: ['demo', 'url'],
      inputSchema: z.object({ id: z.string() }),
      positionalArgs: ['id'],
      surface: {
        only: 'cli',
        reason: 'The URL is assembled locally for terminal use.',
      },
      cli: { output: { kind: 'web-url', path: '/tasks/{id}' } },
    })
    const write = spyStdout()
    const stderr = spyStderr()

    await parse(createProgram([operation], fetchImpl), [
      '--web-url',
      'https://web.example',
      'demo',
      'url',
      'task-example',
    ])

    expect(
      adapterOutcome(write.mock.calls, stderr.mock.calls, {
        requests: fetchImpl.mock.calls,
      }),
    ).toEqual({
      stdout: [['https://web.example/tasks/task-example\n']],
      stderr: [],
      requests: [],
    })
  })

  it('does not register operations that are only available to MCP', () => {
    const operations = [
      makeOperation({
        path: ['demo', 'cli'],
        inputSchema: z.object({}),
        positionalArgs: [],
        cli: { output: { kind: 'json' } },
      }),
      makeOperation({
        path: ['demo', 'mcp'],
        inputSchema: z.object({}),
        positionalArgs: [],
        surface: {
          only: 'mcp',
          reason: 'This operation uses the remote MCP client context.',
        },
        cli: { output: { kind: 'json' } },
      }),
    ]
    const program = createProgram(operations)

    expect(
      program.commands[0]?.commands.map((command) => command.name()),
    ).toEqual(['cli'])
  })
})
