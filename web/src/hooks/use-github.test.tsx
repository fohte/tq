import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useDisconnectGithub,
  useGithubAuthUrl,
  useGithubStatus,
} from '@web/hooks/use-github'
import { assertDefined } from '@web/lib/test-utils'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@web/lib/api', () => {
  const mockStatusGet = vi.fn()
  const mockAuthUrlGet = vi.fn()
  const mockTokenDelete = vi.fn()

  return {
    api: {
      api: {
        github: {
          status: { $get: mockStatusGet },
          'auth-url': { $get: mockAuthUrlGet },
          token: { $delete: mockTokenDelete },
        },
      },
    },
    __mocks: { mockStatusGet, mockAuthUrlGet, mockTokenDelete },
  }
})

async function getMocks() {
  const mod = await import('@web/lib/api')
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

describe('useGithubStatus', () => {
  it('returns disconnected status', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockStatusGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ connected: false }),
    })

    const { result } = renderHook(() => useGithubStatus(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({ connected: false })
  })

  it('returns connected status with login', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockStatusGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ connected: true, login: 'fohte' }),
    })

    const { result } = renderHook(() => useGithubStatus(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({ connected: true, login: 'fohte' })
  })
})

describe('useGithubAuthUrl', () => {
  it('fetches the auth URL when enabled', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockAuthUrlGet']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({ url: 'https://github.com/login/oauth/authorize' }),
    })

    const { result } = renderHook(() => useGithubAuthUrl(true), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({
      url: 'https://github.com/login/oauth/authorize',
    })
  })

  it('does not fetch when disabled', async () => {
    const mocks = await getMocks()

    renderHook(() => useGithubAuthUrl(false), { wrapper })

    expect(assertDefined(mocks['mockAuthUrlGet'])).not.toHaveBeenCalled()
  })
})

describe('useDisconnectGithub', () => {
  it('invalidates the status query on success', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockTokenDelete']).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ message: 'Disconnected' }),
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDisconnectGithub(), { wrapper })
    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['github-status'],
    })
  })
})
