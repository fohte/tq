import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GcalCalendarPicker } from '#components/settings/gcal-calendar-picker'
import { makeGcalCalendar } from '#components/settings/gcal-calendar-test-fixtures'
import type { IntegrationAccountView } from '#components/settings/integration-card'
import {
  useGcalCalendarsList,
  useUpdateCalendarContext,
  useUpdateCalendarSubscription,
} from '#hooks/use-gcal-calendars'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-gcal-calendars', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-gcal-calendars')>()
  return {
    ...original,
    useGcalCalendarsList: vi.fn(),
    useUpdateCalendarSubscription: vi.fn(),
    useUpdateCalendarContext: vi.fn(),
  }
})

const mockUseGcalCalendarsList = vi.mocked(useGcalCalendarsList)
const mockUseUpdateCalendarSubscription = vi.mocked(
  useUpdateCalendarSubscription,
)
const mockUseUpdateCalendarContext = vi.mocked(useUpdateCalendarContext)

type CalendarsListResult = ReturnType<typeof useGcalCalendarsList>
type UpdateSubscriptionResult = ReturnType<typeof useUpdateCalendarSubscription>
type UpdateContextResult = ReturnType<typeof useUpdateCalendarContext>

const account: IntegrationAccountView = {
  id: 'token-1',
  label: 'fohte@example.com',
}

function setupMutationMocks() {
  mockUseUpdateCalendarSubscription.mockReturnValue(
    partialMutation<UpdateSubscriptionResult>({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
  )
  mockUseUpdateCalendarContext.mockReturnValue(
    partialMutation<UpdateContextResult>({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    }),
  )
}

describe('GcalCalendarPicker', () => {
  it('shows the calendar list once expanded', async () => {
    mockUseGcalCalendarsList.mockReturnValue(
      partialMutation<CalendarsListResult>({
        isLoading: false,
        isSuccess: true,
        data: [
          makeGcalCalendar({ id: 'work-calendar-id', displayName: 'Work' }),
        ],
      }),
    )
    setupMutationMocks()
    const user = userEvent.setup()
    render(<GcalCalendarPicker account={account} />)

    await user.click(screen.getByRole('button', { name: 'カレンダーを選択' }))

    expect(screen.getByText('Work')).toBeVisible()
  })

  it('shows a loading message while calendars are loading', () => {
    mockUseGcalCalendarsList.mockReturnValue(
      partialMutation<CalendarsListResult>({
        isLoading: true,
        isSuccess: false,
        data: undefined,
      }),
    )
    setupMutationMocks()
    render(<GcalCalendarPicker account={account} initialOpen />)

    expect(screen.getByText('読み込み中...')).toBeVisible()
  })

  it('shows an error message when calendars fail to load', () => {
    mockUseGcalCalendarsList.mockReturnValue(
      partialMutation<CalendarsListResult>({
        isLoading: false,
        isSuccess: false,
        data: undefined,
      }),
    )
    setupMutationMocks()
    render(<GcalCalendarPicker account={account} initialOpen />)

    expect(screen.getByText('カレンダー一覧の取得に失敗しました')).toBeVisible()
  })

  it('toggles a calendar subscription', async () => {
    const mutate = vi.fn<UpdateSubscriptionResult['mutate']>()
    mockUseGcalCalendarsList.mockReturnValue(
      partialMutation<CalendarsListResult>({
        isLoading: false,
        isSuccess: true,
        data: [
          makeGcalCalendar({
            id: 'work-calendar-id',
            displayName: 'Work',
            subscribed: false,
          }),
        ],
      }),
    )
    mockUseUpdateCalendarSubscription.mockReturnValue(
      partialMutation<UpdateSubscriptionResult>({
        mutate,
        isPending: false,
        isError: false,
      }),
    )
    mockUseUpdateCalendarContext.mockReturnValue(
      partialMutation<UpdateContextResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      }),
    )
    const user = userEvent.setup()
    render(<GcalCalendarPicker account={account} initialOpen />)

    await user.click(screen.getByRole('checkbox'))

    expect(mutate).toHaveBeenCalledWith({
      calendarId: 'work-calendar-id',
      subscribed: true,
    })
  })

  it('shows the mutation error message when a subscription update fails', () => {
    mockUseGcalCalendarsList.mockReturnValue(
      partialMutation<CalendarsListResult>({
        isLoading: false,
        isSuccess: true,
        data: [
          makeGcalCalendar({ id: 'work-calendar-id', displayName: 'Work' }),
        ],
      }),
    )
    mockUseUpdateCalendarSubscription.mockReturnValue(
      partialMutation<UpdateSubscriptionResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('Failed to update subscription'),
      }),
    )
    mockUseUpdateCalendarContext.mockReturnValue(
      partialMutation<UpdateContextResult>({
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      }),
    )
    render(<GcalCalendarPicker account={account} initialOpen />)

    expect(screen.getByText('Failed to update subscription')).toBeVisible()
  })
})
