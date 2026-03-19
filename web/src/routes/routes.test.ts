import { routeTree } from '@web/routeTree.gen'
import { describe, expect, it } from 'vitest'

describe('route tree', () => {
  it('defines the root route', () => {
    expect(routeTree).toBeDefined()
  })

  it('includes index route (/)', () => {
    const children = routeTree.children
    expect(children).toBeDefined()
  })
})
