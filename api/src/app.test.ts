import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { app } from '#app'

describe('onError', () => {
  it('returns an HTTPException as its own status and body instead of a generic 500', async () => {
    // `@hono/mcp`'s protocol-version check throws `HTTPException(404, ...)`
    // for a non-initialize request whose `Mcp-Protocol-Version` header isn't
    // one it recognizes.
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'mcp-protocol-version': 'not-a-real-version',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`,
      },
      id: null,
    })
  })
})
