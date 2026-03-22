import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { InferResponseType } from 'hono/client'

type Comment = InferResponseType<
  (typeof api.api.tasks)[':taskId']['comments']['$get'],
  200
>[number]

export type { Comment }

const commentKeys = {
  all: (taskId: string) => ['tasks', taskId, 'comments'] as const,
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: commentKeys.all(taskId),
    queryFn: async () => {
      const res = await api.api.tasks[':taskId'].comments.$get({
        param: { taskId },
      })
      if (!res.ok) throw new Error('Failed to fetch comments')
      return res.json()
    },
  })
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await api.api.tasks[':taskId'].comments.$post({
        param: { taskId },
        json: { content },
      })
      if (!res.ok) throw new Error('Failed to create comment')
      return res.json()
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.all(taskId),
      })

      const previous = queryClient.getQueryData<Comment[]>(
        commentKeys.all(taskId),
      )

      const now = new Date().toISOString()
      const optimistic: Comment = {
        id: `optimistic-${crypto.randomUUID()}`,
        taskId,
        content,
        createdAt: now,
        updatedAt: now,
      }

      queryClient.setQueryData<Comment[]>(commentKeys.all(taskId), (old) => [
        ...(old ?? []),
        optimistic,
      ])

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentKeys.all(taskId), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(taskId) })
    },
  })
}

export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string
      content: string
    }) => {
      const res = await api.api.tasks[':taskId'].comments[':commentId'].$patch({
        param: { taskId, commentId },
        json: { content },
      })
      if (!res.ok) throw new Error('Failed to update comment')
      return res.json()
    },
    onMutate: async ({ commentId, content }) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.all(taskId),
      })

      const previous = queryClient.getQueryData<Comment[]>(
        commentKeys.all(taskId),
      )

      queryClient.setQueryData<Comment[]>(
        commentKeys.all(taskId),
        (old) =>
          old?.map((c) =>
            c.id === commentId
              ? { ...c, content, updatedAt: new Date().toISOString() }
              : c,
          ) ?? [],
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentKeys.all(taskId), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(taskId) })
    },
  })
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await api.api.tasks[':taskId'].comments[':commentId'].$delete(
        {
          param: { taskId, commentId },
        },
      )
      if (!res.ok) throw new Error('Failed to delete comment')
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({
        queryKey: commentKeys.all(taskId),
      })

      const previous = queryClient.getQueryData<Comment[]>(
        commentKeys.all(taskId),
      )

      queryClient.setQueryData<Comment[]>(
        commentKeys.all(taskId),
        (old) => old?.filter((c) => c.id !== commentId) ?? [],
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentKeys.all(taskId), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(taskId) })
    },
  })
}
