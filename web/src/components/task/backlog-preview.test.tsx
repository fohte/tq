import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BacklogPreview } from '#components/task/backlog-preview'

describe('BacklogPreview', () => {
  it('renders nothing when there are no tasks', () => {
    const { container } = render(<BacklogPreview tasks={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
