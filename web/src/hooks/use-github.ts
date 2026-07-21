import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertStatus } from '@web/lib/assert-response'

const githubKeys = {
  status: ['github-status'] as const,
  authUrl: ['github-auth-url'] as const,
}

export function useGithubStatus() {
  return useQuery({
    queryKey: githubKeys.status,
    queryFn: async () => {
      const res = await api.api.github.status.$get()
      assertStatus(res, 200)
      return res.json()
    },
    retry: false,
  })
}

export function useGithubAuthUrl(enabled: boolean) {
  return useQuery({
    queryKey: githubKeys.authUrl,
    queryFn: async () => {
      const res = await api.api.github['auth-url'].$get()
      assertStatus(res, 200)
      return res.json()
    },
    enabled,
    retry: false,
  })
}

export function useDisconnectGithub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await api.api.github.token.$delete()
      assertStatus(res, 200)
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: githubKeys.status })
    },
  })
}
