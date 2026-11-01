import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStderr,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
})

async function runRecurringTemplateCli(args: string[], response: Response) {
  const { fetchStub, calls } = captureFetch(() => response)
  const stdout = spyStdout()
  const stderr = spyStderr()
  const exitCode = await runCli(
    ['--api-url', apiUrl, ...args],
    fetchStub,
    fakeStdin(true),
  )

  return {
    exitCode,
    requests: calls.map(request),
    stdout: stdout.mock.calls,
    stderr: stderr.mock.calls.map(([message]) => String(message)),
  }
}

describe('recurring-template list', () => {
  it('filters templates by context and enabled state', async () => {
    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'list',
          '--context',
          'work',
          '--enabled',
          'false',
        ],
        new Response('[]', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/recurring-task-templates',
          query: { context: 'work', enabled: 'false' },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
      stderr: [],
    })
  })
})

describe('recurring-template get', () => {
  it('gets a template by UUID and prints it as JSON', async () => {
    const template = {
      id: '11111111-2222-4333-8444-555555555555',
      title: 'Weekly review {date}',
    }

    expect(
      await runRecurringTemplateCli(
        ['recurring-template', 'get', template.id],
        new Response(JSON.stringify(template), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: `/api/recurring-task-templates/${template.id}`,
          query: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(template, null, 2)}\n`]],
      stderr: [],
    })
  })
})

describe('recurring-template update', () => {
  it('enables a template when --enable is given', async () => {
    const id = '11111111-2222-4333-8444-555555555555'

    expect(
      await runRecurringTemplateCli(
        ['recurring-template', 'update', id, '--enable'],
        new Response(JSON.stringify({ id, enabled: true }), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/recurring-task-templates/${id}`,
          query: {},
          body: { enabled: true },
        },
      ],
      stdout: [[`${JSON.stringify({ id, enabled: true }, null, 2)}\n`]],
      stderr: [],
    })
  })

  it('maps template fields, labels, enabled state, and recurrence flags to PATCH', async () => {
    const id = '11111111-2222-4333-8444-555555555555'
    const updated = { id, title: 'New title {date}' }

    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'update',
          id,
          '--title',
          updated.title,
          '--description',
          'A new description',
          '--context',
          'work',
          '--project-id',
          '22222222-3333-4444-8555-666666666666',
          '--labels',
          'planning,review',
          '--start-offset-days',
          '2',
          '--anchor-date',
          '2026-04-01',
          '--disable',
          '--recurrence-type',
          'weekly',
          '--recurrence-interval',
          '2',
          '--recurrence-days-of-week',
          '1,3',
        ],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/recurring-task-templates/${id}`,
          query: {},
          body: {
            title: 'New title {date}',
            description: 'A new description',
            context: 'work',
            projectId: '22222222-3333-4444-8555-666666666666',
            labels: ['planning', 'review'],
            startOffsetDays: 2,
            anchorDate: '2026-04-01',
            enabled: false,
            recurrenceRule: {
              type: 'weekly',
              interval: 2,
              daysOfWeek: [1, 3],
            },
          },
        },
      ],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
      stderr: [],
    })
  })

  it('sends a parent task number and monthly recurrence day to PATCH', async () => {
    const id = '11111111-2222-4333-8444-555555555555'
    const updated = { id, parentId: '42' }

    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'update',
          id,
          '--parent-id',
          '42',
          '--recurrence-type',
          'monthly',
          '--recurrence-interval',
          '1',
          '--recurrence-day-of-month',
          '15',
        ],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/recurring-task-templates/${id}`,
          query: {},
          body: {
            parentId: '42',
            recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 15 },
          },
        },
      ],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
      stderr: [],
    })
  })

  it('rejects --enable and --disable together', async () => {
    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'update',
          '11111111-2222-4333-8444-555555555555',
          '--enable',
          '--disable',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stdout: [],
      stderr: ['Error: Use either --enable or --disable, not both.\n'],
    })
  })

  it('rejects a recurrence rule without its interval', async () => {
    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'update',
          '11111111-2222-4333-8444-555555555555',
          '--recurrence-type',
          'daily',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stdout: [],
      stderr: ['Error: Invalid input: expected number, received NaN\n'],
    })
  })

  it('rejects a recurrence rule without its type', async () => {
    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'update',
          '11111111-2222-4333-8444-555555555555',
          '--recurrence-interval',
          '2',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stdout: [],
      stderr: [
        'Error: Invalid option: expected one of "daily"|"weekly"|"monthly"|"custom"\n',
      ],
    })
  })

  it('rejects an update without flags', async () => {
    expect(
      await runRecurringTemplateCli(
        [
          'recurring-template',
          'update',
          '11111111-2222-4333-8444-555555555555',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stdout: [],
      stderr: ['Error: Pass at least one flag to update\n'],
    })
  })
})
