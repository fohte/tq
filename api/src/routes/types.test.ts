import type { hc } from 'hono/client'
import { describe, expectTypeOf, it } from 'vitest'

import type { AppType } from '@api/app'

// Verify that AppType can be used with Hono RPC client
type Client = ReturnType<typeof hc<AppType>>

describe('AppType for Hono RPC', () => {
  it('exports AppType that is usable with hc client', () => {
    expectTypeOf<Client>().toBeObject()
  })

  it('has api.tasks route', () => {
    expectTypeOf<Client['api']['tasks']>().toBeObject()
  })

  it('has api.projects route', () => {
    expectTypeOf<Client['api']['projects']>().toBeObject()
  })

  it('has api.schedule route', () => {
    expectTypeOf<Client['api']['schedule']>().toBeObject()
  })

  it('has api.calendar route', () => {
    expectTypeOf<Client['api']['calendar']>().toBeObject()
  })

  it('has api.images route', () => {
    expectTypeOf<Client['api']['images']>().toBeObject()
  })
})
