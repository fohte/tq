import { describe, expect, it } from 'vitest'

import { toErrorResult } from '#routes/mcp/route-bridge'

describe('toErrorResult', () => {
  it('maps a 400 validation error to a field-level message', async () => {
    const result = await toErrorResult(
      Response.json(
        {
          error: {
            message: JSON.stringify([
              { path: ['title'], message: 'title must be a string' },
              { path: ['count'], message: 'count must be a number' },
            ]),
          },
        },
        { status: 400 },
      ),
    )

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Invalid request: title: title must be a string; count: count must be a number',
        },
      ],
    })
  })

  it('maps a 404 to the resource-not-found message from the response body', async () => {
    const result = await toErrorResult(
      Response.json({ error: 'Widget not found' }, { status: 404 }),
    )

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Widget not found' }],
    })
  })

  it('maps a custom 400 message from the response body', async () => {
    const result = await toErrorResult(
      Response.json(
        { error: 'Fill all required sections and retry task creation.' },
        { status: 400 },
      ),
    )

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Fill all required sections and retry task creation.',
        },
      ],
    })
  })

  it('maps a 409 to the conflict message from the response body', async () => {
    const result = await toErrorResult(
      Response.json({ error: 'Widget is already locked' }, { status: 409 }),
    )

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Widget is already locked' }],
    })
  })

  it('maps a 5xx to a generic message without internal details', async () => {
    const result = await toErrorResult(
      Response.json({ error: 'boom' }, { status: 500 }),
    )

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'An internal error occurred while processing the request.',
        },
      ],
    })
  })
})
