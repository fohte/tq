import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  canConnectIntegration,
  type IntegrationSummary,
  useDisconnectIntegrationAccount,
  useIntegrationAuthUrl,
  useIntegrationsList,
} from '#hooks/use-integrations'
import { assertDefined } from '#lib/test-utils'

function buildSummary(
  overrides: Partial<IntegrationSummary> = {},
): IntegrationSummary {
  return {
    id: 'github',
    displayName: 'GitHub',
    configured: true,
    supportsMultipleAccounts: false,
    accounts: [],
    ...overrides,
  }
}

vi.mock('#lib/api', () => {
  const mockListGet = vi.fn()
  const mockAuthUrlGet = vi.fn()
  const mockDeleteAccount = vi.fn()

  return {
    api: {
      api: {
        integrations: {
          $get: mockListGet,
          ':id': {
            'auth-url': { $get: mockAuthUrlGet },
            accounts: {
              ':accountId': { $delete: mockDeleteAccount },
            },
          },
        },
      },
    },
    __mocks: { mockListGet, mockAuthUrlGet, mockDeleteAccount },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, ReturnType<typeof vi.fn>>
  }
  return typed.__mocks
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const mocks = await getMocks()
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
})

describe('canConnectIntegration', () => {
  it('is false when not configured', () => {
    expect(canConnectIntegration(buildSummary({ configured: false }))).toBe(
      false,
    )
  })

  it('is true when configured with no connected accounts, regardless of multi-account support', () => {
    expect(
      canConnectIntegration(
        buildSummary({
          configured: true,
          supportsMultipleAccounts: false,
          accounts: [],
        }),
      ),
    ).toBe(true)
  })

  it('is true when configured, supports multiple accounts, and already has a connected account', () => {
    expect(
      canConnectIntegration(
        buildSummary({
          configured: true,
          supportsMultipleAccounts: true,
          accounts: [{ id: 'a', label: 'x' }],
        }),
      ),
    ).toBe(true)
  })

  it('is false when configured, single-account only, and already has a connected account', () => {
    expect(
      canConnectIntegration(
        buildSummary({
          configured: true,
          supportsMultipleAccounts: false,
          accounts: [{ id: 'a', label: 'x' }],
        }),
      ),
    ).toBe(false)
  })
})

describe('useIntegrationsList', () => {
  it('returns the list of integrations', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockListGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'github',
            displayName: 'GitHub',
            configured: true,
            supportsMultipleAccounts: false,
            accounts: [{ id: 'token-1', label: 'fohte' }],
          },
          {
            id: 'google_calendar',
            displayName: 'Google Calendar',
            configured: true,
            supportsMultipleAccounts: true,
            accounts: [],
          },
        ]),
    })

    const { result } = renderHook(() => useIntegrationsList(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual([
      {
        id: 'github',
        displayName: 'GitHub',
        configured: true,
        supportsMultipleAccounts: false,
        accounts: [{ id: 'token-1', label: 'fohte' }],
      },
      {
        id: 'google_calendar',
        displayName: 'Google Calendar',
        configured: true,
        supportsMultipleAccounts: true,
        accounts: [],
      },
    ])
  })
})

describe('useIntegrationAuthUrl', () => {
  it('fetches the auth URL when enabled', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockAuthUrlGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({ url: 'https://github.com/login/oauth/authorize' }),
    })

    const { result } = renderHook(() => useIntegrationAuthUrl('github', true), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({
      url: 'https://github.com/login/oauth/authorize',
    })
  })

  it('requests the auth URL for the given provider id', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockAuthUrlGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({ url: 'https://github.com/login/oauth/authorize' }),
    })

    const { result } = renderHook(() => useIntegrationAuthUrl('github', true), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(assertDefined(mocks['mockAuthUrlGet']).mock.calls).toEqual([
      [{ param: { id: 'github' } }],
    ])
  })

  it('does not fetch when disabled', async () => {
    const mocks = await getMocks()

    renderHook(() => useIntegrationAuthUrl('github', false), { wrapper })

    expect(assertDefined(mocks['mockAuthUrlGet'])).not.toHaveBeenCalled()
  })
})

describe('useDisconnectIntegrationAccount', () => {
  it('calls the disconnect endpoint with the provider and account ids', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockDeleteAccount']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ message: 'Disconnected' }),
    })

    const { result } = renderHook(
      () => useDisconnectIntegrationAccount('github'),
      { wrapper },
    )
    result.current.mutate('some-account-id')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(assertDefined(mocks['mockDeleteAccount']).mock.calls).toEqual([
      [{ param: { id: 'github', accountId: 'some-account-id' } }],
    ])
  })

  it('invalidates the list query on success', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockDeleteAccount']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ message: 'Disconnected' }),
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(
      () => useDisconnectIntegrationAccount('github'),
      { wrapper },
    )
    result.current.mutate('some-account-id')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['integrations'],
    })
  })
})
