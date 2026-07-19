import { app } from '@api/app'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { describe, expect, it } from 'vitest'

// `mcpApp` is mounted with `.route()` on the same `app` instance as every
// other route (see api/src/app.ts) instead of a dedicated server or
// middleware stack, so it runs through the existing OTel HTTP
// auto-instrumentation exactly like any other route.
describe('MCP endpoint', () => {
  it('completes initialize and lists the tool set', async () => {
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/api/mcp'),
      {
        fetch: async (url, init) => app.request(url, init),
      },
    )
    // `Transport.sessionId` is `sessionId?: string`, which `exactOptionalPropertyTypes`
    // treats as excluding `undefined`; this class's getter returns `string | undefined`,
    // so the SDK's own types don't satisfy its interface under this tsconfig.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
    await client.connect(transport as Transport)

    try {
      const result = await client.listTools()

      expect(result).toEqual({ tools: [] })
    } finally {
      await client.close()
    }
  })
})
