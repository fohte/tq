import type { TagCount } from '#lib/tag-tree'

export function makeTagCount(overrides: Partial<TagCount> = {}): TagCount {
  return { name: 'sample', count: 0, ...overrides }
}
