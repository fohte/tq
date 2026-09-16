import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeProject } from '#components/project/project-test-fixtures'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'

const projectA = makeProject({ id: 'proj-1', title: 'Website Redesign' })
const projectB = makeProject({ id: 'proj-2', title: 'Mobile App' })

function renderFields(selectedProjectId?: string) {
  const onProjectIdChange = vi.fn()
  render(
    <TaskProjectFilterFields
      projects={[projectA, projectB]}
      selectedProjectId={selectedProjectId}
      onProjectIdChange={onProjectIdChange}
    />,
  )
  return onProjectIdChange
}

describe('TaskProjectFilterFields', () => {
  it('selects a project', async () => {
    const onProjectIdChange = renderFields()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Mobile App' }))

    expect(onProjectIdChange).toHaveBeenCalledWith('proj-2')
  })

  it('clears the selected project', async () => {
    const onProjectIdChange = renderFields('proj-1')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'All projects' }))

    expect(onProjectIdChange).toHaveBeenCalledWith('')
  })
})
