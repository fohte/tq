import type { hc } from 'hono/client'
import { describe, expectTypeOf, it } from 'vitest'

import type { AppType } from 'api/types'

type Client = ReturnType<typeof hc<AppType>>

describe('API client type inference', () => {
  it('resolves api.tasks route type', () => {
    expectTypeOf<Client['api']['tasks']>().toBeObject()
  })

  it('resolves api.projects route type', () => {
    expectTypeOf<Client['api']['projects']>().toBeObject()
  })

  it('resolves api.schedule route type', () => {
    expectTypeOf<Client['api']['schedule']>().toBeObject()
  })

  it('resolves api.calendar route type', () => {
    expectTypeOf<Client['api']['calendar']>().toBeObject()
  })

  it('resolves api.images route type', () => {
    expectTypeOf<Client['api']['images']>().toBeObject()
  })
})
