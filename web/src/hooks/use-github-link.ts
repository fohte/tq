import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { projectKeys } from '#hooks/use-projects'
import { taskKeys } from '#hooks/use-task-queries'
import type { TaskDetail } from '#hooks/use-tasks'
import { api } from '#lib/api'
import {
  assertOkWithMessage,
  assertOkWithMessageOrThrow,
  unwrapOrThrow,
} from '#lib/assert-response'

export type ResolveGithubUrlResult = InferResponseType<
  typeof api.api.github.resolve.$post,
  200
>

export type GithubLink = InferResponseType<
  (typeof api.api.tasks)[':id']['$get'],
  200
>['githubLinks'][number]

export type GithubBlocker = TaskDetail['githubBlockers'][number]

export type GithubUrlCandidate = Pick<
  GithubLink,
  'owner' | 'repo' | 'number' | 'kind' | 'url' | 'state' | 'title'
>

async function resolveGithubUrl(url: string): Promise<ResolveGithubUrlResult> {
  const res = await api.api.github.resolve.$post({ json: { url } })
  return unwrapOrThrow(await assertOkWithMessage(res)).json()
}

export function useResolveGithubUrl() {
  return useMutation({
    mutationFn: resolveGithubUrl,
  })
}

export function useResolveGithubUrlQuery(url: string, enabled: boolean) {
  return useQuery({
    queryKey: ['github-url-resolve', url],
    queryFn: () => resolveGithubUrl(url),
    enabled: enabled && url !== '',
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLinkTaskToGithub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskId, url }: { taskId: string; url: string }) => {
      const res = await api.api.tasks[':taskId']['github-link'].$post({
        param: { taskId },
        json: { url },
      })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.taskId),
      })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUnlinkTaskFromGithub(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (linkId: string) => {
      const res = await api.api.tasks[':taskId']['github-link'][
        ':linkId'
      ].$delete({
        param: { taskId, linkId },
      })
      await assertOkWithMessageOrThrow(res)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateGithubLinkNotifyEvents(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      linkId,
      notifyEvents,
    }: {
      linkId: string
      notifyEvents: GithubLink['notifyEvents']
    }) => {
      const res = await api.api.tasks[':taskId']['github-link'][
        ':linkId'
      ].$patch({
        param: { taskId, linkId },
        json: { notifyEvents },
      })
      return unwrapOrThrow(await assertOkWithMessage(res)).json()
    },
    onMutate: async ({ linkId, notifyEvents }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(taskId) })
      const previousDetail = queryClient.getQueryData<TaskDetail>(
        taskKeys.detail(taskId),
      )

      if (previousDetail) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), {
          ...previousDetail,
          githubLinks: previousDetail.githubLinks.map((link) =>
            link.id === linkId ? { ...link, notifyEvents } : link,
          ),
          githubBlockers: previousDetail.githubBlockers.map((blocker) =>
            blocker.id === linkId ? { ...blocker, notifyEvents } : blocker,
          ),
        })
      }

      return { previousDetail }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          taskKeys.detail(taskId),
          context.previousDetail,
        )
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
      void queryClient.invalidateQueries({ queryKey: taskKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
