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

export type CommitmentValue = 'inbox' | 'active' | 'someday'
export const commitmentValues = [
  '',
  'inbox',
  'active',
  'someday',
] as const satisfies readonly (CommitmentValue | '')[]

export const commitmentLabels: Record<CommitmentValue, string> = {
  inbox: 'Inbox',
  active: 'Active',
  someday: 'Someday',
}

export type PlanValue = 'day' | 'week'
export const planValues = ['', 'day', 'week'] as const satisfies readonly (
  PlanValue | ''
)[]

export const planLabels: Record<PlanValue, string> = {
  day: 'today',
  week: 'this week',
}
