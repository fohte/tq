import { describe, expect, it, vi } from 'vitest'

import { app } from '#app'

const {
  mcpPackageLoaded,
  mcpServerModuleLoaded,
  operationToolsModuleLoaded,
  toolHelpersModuleLoaded,
} = vi.hoisted(() => ({
  mcpPackageLoaded: vi.fn(),
  mcpServerModuleLoaded: vi.fn(),
  operationToolsModuleLoaded: vi.fn(),
  toolHelpersModuleLoaded: vi.fn(),
}))

vi.mock('@modelcontextprotocol/server', () => {
  mcpPackageLoaded()
  return {
    createMcpHandler: () => ({
      fetch: () => Promise.resolve(new Response('MCP route')),
    }),
    McpServer: vi.fn(),
  }
})

vi.mock('#routes/mcp/server', async (importOriginal) => {
  mcpServerModuleLoaded()
  return await importOriginal()
})

vi.mock('#routes/mcp/tools/operation-tools', async (importOriginal) => {
  operationToolsModuleLoaded()
  return await importOriginal()
})

vi.mock('#routes/mcp/tools/tool-helpers', async (importOriginal) => {
  toolHelpersModuleLoaded()
  return await importOriginal()
})

function loadedModules() {
  return {
    mcpPackage: mcpPackageLoaded.mock.calls.length,
    mcpServer: mcpServerModuleLoaded.mock.calls.length,
    operationTools: operationToolsModuleLoaded.mock.calls.length,
    toolHelpers: toolHelpersModuleLoaded.mock.calls.length,
  }
}

function expectedResult() {
  const unloadedModules = {
    mcpPackage: 0,
    mcpServer: 0,
    operationTools: 0,
    toolHelpers: 0,
  }
  const loadedModulesOnce = {
    mcpPackage: 1,
    mcpServer: 1,
    operationTools: 1,
    toolHelpers: 1,
  }

  return {
    startupLoads: unloadedModules,
    firstResult: {
      status: 200,
      body: 'MCP route',
      loaded: loadedModulesOnce,
    },
    secondResult: {
      status: 200,
      body: 'MCP route',
      loaded: loadedModulesOnce,
    },
  }
}

async function requestMcpRoute() {
  const startupLoads = loadedModules()
  const firstResponse = await app.request('/api/mcp')
  const firstResult = {
    status: firstResponse.status,
    body: await firstResponse.text(),
    loaded: loadedModules(),
  }
  const secondResponse = await app.request('/api/mcp')
  const secondResult = {
    status: secondResponse.status,
    body: await secondResponse.text(),
    loaded: loadedModules(),
  }

  return { startupLoads, firstResult, secondResult }
}

describe('MCP route loading', () => {
  it('loads the route on its first request and reuses the module', async () => {
    expect(await requestMcpRoute()).toEqual(expectedResult())
  })
})
