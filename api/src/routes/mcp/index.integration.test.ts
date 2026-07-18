import type { AddressInfo } from 'node:net'

import { app } from '@api/app'
import type { ServerType } from '@hono/node-server'
import { serve } from '@hono/node-server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Started as a real Node HTTP server (rather than calling app.request()
// in-process) to exercise the same request path a production deployment
// uses. `mcpApp` is mounted with `.route()` on the same `app` instance as
// every other route (see api/src/app.ts) instead of a dedicated server or
// middleware stack, so it runs through the existing OTel HTTP
// auto-instrumentation exactly like any other route.
describe('MCP endpoint', () => {
  let server: ServerType
  let baseUrl: URL

  beforeAll(async () => {
    const address = await new Promise<AddressInfo>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0 }, resolve)
    })
    baseUrl = new URL(`http://localhost:${String(address.port)}/api/mcp`)
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })

  it('completes initialize and lists the (currently empty) tool set', async () => {
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(baseUrl)
    // `Transport.sessionId` is `sessionId?: string`, which `exactOptionalPropertyTypes`
    // treats as excluding `undefined`; this class's getter returns `string | undefined`,
    // so the SDK's own types don't satisfy its interface under this tsconfig.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
    await client.connect(transport as Transport)

    const result = await client.listTools()
    await client.close()

    expect(result).toEqual({ tools: [] })
  })
})
