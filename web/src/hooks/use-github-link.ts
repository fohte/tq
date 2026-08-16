import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { projectKeys } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

export type ResolveGithubUrlResult = InferResponseType<
  typeof api.api.github.resolve.$post,
  200
>

export type GithubLink = NonNullable<
  InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>['githubLink']
>

export function useResolveGithubUrl() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await api.api.github.resolve.$post({ json: { url } })
      // eslint-disable-next-line no-restricted-syntax -- React Query mutationFn boundary: must throw with the server-provided error message to signal failure
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
  })
}

export function useCreateTaskFromGithubUrl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (url: string) => {
      const res = await api.api.tasks['from-github'].$post({ json: { url } })
      // eslint-disable-next-line no-restricted-syntax -- React Query mutationFn boundary: must throw with the server-provided error message to signal failure
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useLinkTaskToGithub(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (url: string) => {
      const res = await api.api.tasks[':taskId']['github-link'].$post({
        param: { taskId },
        json: { url },
      })
      // eslint-disable-next-line no-restricted-syntax -- React Query mutationFn boundary: must throw with the server-provided error message to signal failure
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUnlinkTaskFromGithub(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await api.api.tasks[':taskId']['github-link'].$delete({
        param: { taskId },
      })
      // eslint-disable-next-line no-restricted-syntax -- React Query mutationFn boundary: must throw with the server-provided error message to signal failure
      if (!res.ok) throw new Error((await res.json()).error)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

// There is no server-side background schedule (see api's github-sync
// service) — GitHub sync only happens while a client triggers it. Mounted
// once at the app root, this covers "on open" and "on window focus regain"
// via React Query's refetchOnMount/refetchOnWindowFocus defaults, and
// "periodically while focused" via refetchInterval, which React Query
// automatically pauses while the tab isn't visible.
const GITHUB_SYNC_INTERVAL_MS = 60_000

export function useGithubSync() {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['github-sync'],
    queryFn: async () => {
      const res = await api.api.github.sync.$post()
      // eslint-disable-next-line neverthrow/must-use-result -- unwrapOrThrow already handles the Result (throws on Err); the plugin can't see through a custom wrapper
      unwrapOrThrow(assertOk(res))
      await queryClient.invalidateQueries({ queryKey: taskKeys.all })
      return null
    },
    staleTime: 0,
    retry: false,
    refetchInterval: GITHUB_SYNC_INTERVAL_MS,
  })
}

// Single-task counterpart of useGithubSync, for an immediate refresh of one
// task's link when its detail view opens, instead of waiting for the next
// app-wide sync. `hasLink` gates the query so an unlinked task's detail view
// doesn't fire a request the server would just no-op anyway.
export function useSyncTaskGithubLink(taskId: string, hasLink: boolean) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['github-sync', 'task', taskId],
    queryFn: async () => {
      const res = await api.api.tasks[':taskId']['github-link'].sync.$post({
        param: { taskId },
      })
      // eslint-disable-next-line neverthrow/must-use-result -- unwrapOrThrow already handles the Result (throws on Err); the plugin can't see through a custom wrapper
      unwrapOrThrow(assertOk(res))
      await queryClient.invalidateQueries({
        queryKey: taskKeys.detail(taskId),
      })
      return null
    },
    enabled: hasLink,
    staleTime: 0,
    retry: false,
  })
}
