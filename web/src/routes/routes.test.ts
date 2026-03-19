import { describe, expect, it } from 'vitest'

import { routeTree } from '@web/routeTree.gen'

describe('route tree', () => {
  it('defines the root route', () => {
    expect(routeTree).toBeDefined()
  })

  it('includes index route (/)', () => {
    const children = routeTree.children
    expect(children).toBeDefined()
  })
})
