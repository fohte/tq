import path from 'node:path'

import type { Meta, StoryFn } from '@storybook/react-vite'
import { composeStories } from '@storybook/react-vite'
import { describe, expect, test } from 'vitest'

type StoryFile = {
  default: Meta
  [name: string]: StoryFn | Meta
}

function getAllStoryFiles() {
  const storyFiles = Object.entries(
    import.meta.glob<StoryFile>('./**/*.stories.@(ts|tsx)', {
      eager: true,
    }),
  )

  return storyFiles.map(([filePath, storyFile]) => {
    const componentName = path
      .basename(filePath)
      .replace(/\.stories\.[^/.]+$/, '')
    return { filePath, storyFile, componentName }
  })
}

describe('Storybook Smoke Tests', () => {
  const storyFiles = getAllStoryFiles()

  expect(storyFiles.length).toBeGreaterThan(0)

  for (const { storyFile, componentName, filePath } of storyFiles) {
    const meta = storyFile.default
    const title = meta.title ?? componentName

    describe(title, () => {
      let stories: { name: string; story: { run: () => Promise<void> } }[]
      try {
        const composed = composeStories(storyFile)
        stories = Object.entries(composed).map(([name, story]) => ({
          name,
          story: story as { run: () => Promise<void> },
        }))
      } catch (e) {
        throw new Error(`Failed to compose stories for ${filePath}: ${e}`)
      }

      if (stories.length === 0) {
        throw new Error(
          `No stories found in ${filePath}. Ensure at least one named export exists.`,
        )
      }

      for (const { name, story } of stories) {
        test(name, async () => {
          await story.run()
        })
      }
    })
  }
})
