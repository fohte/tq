export const allTasksQuery = {
  context: 'all',
  status: 'all',
  limit: 'unlimited',
} as const

export const taskListDefaults = {
  context: 'all' as const,
  status: ['todo'] as ('todo' | 'completed')[],
  limit: 20,
}

export const taskSearchDefaults = {
  context: 'all' as const,
  status: ['all'] as ['all'],
  limit: 20,
}
