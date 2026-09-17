import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RecurringTemplateListSection } from '#components/recurring/recurring-template-list-section'

describe('RecurringTemplateListSection', () => {
  it('renders nothing when there are no templates', () => {
    const { container } = render(
      <RecurringTemplateListSection label="Active" templates={[]} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
