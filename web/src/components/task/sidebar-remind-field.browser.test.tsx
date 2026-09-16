import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SidebarRemindField } from '#components/task/sidebar-remind-field'
import { useUpdateTask } from '#hooks/use-tasks'
import {
  formatAbsoluteReminder,
  formatReminderSummary,
  parseReminderInput,
} from '#lib/reminder-input'
import { assertDefined, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useUpdateTask: vi.fn(),
  }
})

const mockUseUpdateTask = vi.mocked(useUpdateTask)

type UpdateTaskResult = ReturnType<typeof useUpdateTask>

const taskId = '00000000-0000-0000-0000-000000000001'
const inputPlaceholder = '明日9時 など'

function mockMutate() {
  const mutate = vi.fn()
  mockUseUpdateTask.mockReturnValue(
    partialMutation<UpdateTaskResult>({ mutate }),
  )
  return mutate
}

describe('SidebarRemindField', () => {
  it('shows the fixed presets when opened with an empty query', async () => {
    mockMutate()
    const user = userEvent.setup()
    render(<SidebarRemindField taskId={taskId} remindAt={null} />)

    await user.click(screen.getByText('なし'))

    await Promise.all(
      ['1時間後', '今日18:00', '明日09:00', '来週月曜09:00'].map(
        async (preset) => {
          expect(await screen.findByText(preset)).toBeInTheDocument()
        },
      ),
    )
  })

  it('shows the resolved absolute datetime for recognizable text', async () => {
    mockMutate()
    const user = userEvent.setup()
    render(<SidebarRemindField taskId={taskId} remindAt={null} />)

    await user.click(screen.getByText('なし'))
    await user.type(
      screen.getByPlaceholderText(inputPlaceholder),
      '来週月曜10時',
    )

    const expectedDate = assertDefined(await parseReminderInput('来週月曜10時'))
    expect(
      await screen.findByText(formatAbsoluteReminder(expectedDate)),
    ).toBeInTheDocument()
    // The typed text itself is never shown as the result.
    expect(screen.queryByText('来週月曜10時')).toBeNull()
  })

  it('shows an unrecognized message for unparseable text and ignores Enter', async () => {
    const mutate = mockMutate()
    const user = userEvent.setup()
    render(<SidebarRemindField taskId={taskId} remindAt={null} />)

    await user.click(screen.getByText('なし'))
    await user.type(screen.getByPlaceholderText(inputPlaceholder), 'あいうえお')

    expect(await screen.findByText('解釈できません')).toBeInTheDocument()

    await user.keyboard('{Enter}')

    expect(screen.getByText('解釈できません')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('commits the preset and closes the popup when a preset is clicked', async () => {
    const mutate = mockMutate()
    const user = userEvent.setup()
    render(<SidebarRemindField taskId={taskId} remindAt={null} />)

    await user.click(screen.getByText('なし'))
    await user.click(await screen.findByText('今日18:00'))

    const expectedDate = assertDefined(await parseReminderInput('今日18:00'))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        id: taskId,
        input: { remindAt: expectedDate.toISOString() },
      })
    })
    expect(screen.queryByPlaceholderText(inputPlaceholder)).toBeNull()
  })

  it('commits the typed date and closes the popup when Enter is pressed', async () => {
    const mutate = mockMutate()
    const user = userEvent.setup()
    render(<SidebarRemindField taskId={taskId} remindAt={null} />)

    await user.click(screen.getByText('なし'))
    await user.type(screen.getByPlaceholderText(inputPlaceholder), '明日9時')

    const expectedDate = assertDefined(await parseReminderInput('明日9時'))
    await screen.findByText(formatAbsoluteReminder(expectedDate))

    await user.keyboard('{Enter}')

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      input: { remindAt: expectedDate.toISOString() },
    })
    expect(screen.queryByPlaceholderText(inputPlaceholder)).toBeNull()
  })

  it('clears the reminder and closes the popup when "なし" is clicked from the popup', async () => {
    const mutate = mockMutate()
    const remindAt = '2026-03-25T09:00:00.000Z'
    const user = userEvent.setup()
    render(<SidebarRemindField taskId={taskId} remindAt={remindAt} />)

    await user.click(
      screen.getByText(formatReminderSummary(new Date(remindAt))),
    )
    await user.click(await screen.findByText('なし'))

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      input: { remindAt: null },
    })
    expect(screen.queryByPlaceholderText(inputPlaceholder)).toBeNull()
  })
})
