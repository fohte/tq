export type ContextValue = 'work' | 'personal'
export const contextValues = [
  '',
  'work',
  'personal',
] as const satisfies readonly (ContextValue | '')[]

export const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
}

export type PlanValue = 'day' | 'week'
export const planValues = ['', 'day', 'week'] as const satisfies readonly (
  PlanValue | ''
)[]

export const planLabels: Record<PlanValue, string> = {
  day: 'today',
  week: 'this week',
}
