import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProjectTaskFieldGroup } from '#components/project/project-task-field-group'

describe('ProjectTaskFieldGroup', () => {
  it('keeps cached tasks visible when a refresh fails', () => {
    render(
      <ProjectTaskFieldGroup title="Alpha" isError hasTasks>
        <div>Cached task list</div>
      </ProjectTaskFieldGroup>,
    )

    const getSnapshot = () => ({
      groups: screen
        .getAllByRole('region')
        .map((group) => group.getAttribute('aria-label')),
      errors: screen.getAllByRole('alert').map((error) => error.textContent),
      cachedContent: screen
        .getAllByText('Cached task list')
        .map((content) => content.textContent),
    })
    expect(getSnapshot()).toEqual({
      groups: ['Alpha group'],
      errors: ['Failed to load tasks for this group.'],
      cachedContent: ['Cached task list'],
    })
  })
})
