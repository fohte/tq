import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
})

async function runLabelCli(args: string[], response: Response) {
  const { fetchStub, calls } = captureFetch(() => response)
  const write = spyStdout()
  const exitCode = await runCli(
    ['--api-url', apiUrl, ...args],
    fetchStub,
    fakeStdin(true),
  )

  return {
    exitCode,
    requests: calls.map(request),
    stdout: write.mock.calls,
  }
}

describe('label list', () => {
  it('prints the labels returned by the server as JSON', async () => {
    const labels = [{ id: 'l1', name: 'bug', color: '#ff0000' }]

    expect(
      await runLabelCli(
        ['label', 'list'],
        new Response(JSON.stringify(labels), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        { method: 'GET', pathname: '/api/labels', query: {}, body: undefined },
      ],
      stdout: [[`${JSON.stringify(labels, null, 2)}\n`]],
    })
  })

  it('filters labels by context', async () => {
    const labels = [
      {
        id: 'label-work-id',
        name: 'fictional-work-label',
        color: '#4a6b8c',
        context: 'work',
      },
    ]

    expect(
      await runLabelCli(
        ['label', 'list', '--context', 'work'],
        new Response(JSON.stringify(labels), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/labels',
          query: { context: 'work' },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(labels, null, 2)}\n`]],
    })
  })
})

describe('label update', () => {
  it('sends only the name field when only --name is given', async () => {
    const updated = { id: 'l1', name: 'defect', color: null }

    expect(
      await runLabelCli(
        ['label', 'update', 'l1', '--name', 'defect'],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/labels/l1',
          query: {},
          body: { name: 'defect' },
        },
      ],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })

  it('sends only the context field when only --context is given', async () => {
    const updated = { id: 'l1', name: 'bug', color: null, context: 'work' }

    expect(
      await runLabelCli(
        ['label', 'update', 'l1', '--context', 'work'],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/labels/l1',
          query: {},
          body: { context: 'work' },
        },
      ],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })
})

describe('label delete', () => {
  it('prints a deletion confirmation', async () => {
    expect(
      await runLabelCli(
        ['label', 'delete', 'l1'],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'DELETE',
          pathname: '/api/labels/l1',
          query: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify({ deleted: true, id: 'l1' }, null, 2)}\n`]],
    })
  })
})
