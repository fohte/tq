import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { projectKeys } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'

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
      if (!res.ok) throw new Error((await res.json()).error)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
