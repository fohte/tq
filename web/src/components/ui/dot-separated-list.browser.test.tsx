import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DotSeparatedList } from '#components/ui/dot-separated-list'

describe('DotSeparatedList', () => {
  it('skips null and undefined items', () => {
    const withNullish = render(
      <DotSeparatedList
        items={['Design system setup', null, 'work', undefined, 'Mar 25']}
      />,
    )
    const withoutNullish = render(
      <DotSeparatedList items={['Design system setup', 'work', 'Mar 25']} />,
    )

    expect(withNullish.container.innerHTML).toBe(
      withoutNullish.container.innerHTML,
    )
  })
})
