import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LlmAuthorLabel } from '#components/task/llm-author-label'

describe('LlmAuthorLabel', () => {
  it('renders nothing for a human author', () => {
    const { container } = render(
      <LlmAuthorLabel author={{ kind: 'human', agent: null }} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when author is missing', () => {
    const { container } = render(<LlmAuthorLabel author={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
