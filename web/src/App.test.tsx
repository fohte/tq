import { describe, expect, it } from 'vitest'

import { App } from '@web/App'

describe('App', () => {
  it('コンポーネントが定義されている', () => {
    expect(App).toBeDefined()
  })
})
