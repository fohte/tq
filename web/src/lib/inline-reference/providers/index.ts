import { createElement, type ReactNode } from 'react'

import { githubUrlProvider } from '#lib/inline-reference/providers/github-url'
import { projectUrlProvider } from '#lib/inline-reference/providers/project-url'
import { taskMentionProvider } from '#lib/inline-reference/providers/task-mention'
import { taskUrlProvider } from '#lib/inline-reference/providers/task-url'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

interface RenderedInlineReferenceMatch {
  start: number
  end: number
  raw: string
  key: string
  chip: ReactNode
}

interface InlineReferenceProviderEntry {
  findMatches(
    text: string,
    fallbackText?: string,
  ): RenderedInlineReferenceMatch[]
  registerPlugin<TPlugin>(
    createPlugin: <TData>(provider: InlineReferenceProvider<TData>) => TPlugin,
    usePlugin: (plugin: TPlugin) => void,
  ): void
}

function createProviderEntry<TData>(
  provider: InlineReferenceProvider<TData>,
): InlineReferenceProviderEntry {
  return {
    findMatches(text, fallbackText) {
      return provider.findMatches(text).map((match) => ({
        start: match.start,
        end: match.end,
        raw: match.raw,
        key: `${provider.id}:${match.raw}:${String(match.start)}`,
        chip: createElement(provider.Chip, {
          data: match.data,
          raw: fallbackText ?? match.raw,
        }),
      }))
    },
    registerPlugin(createPlugin, usePlugin) {
      usePlugin(createPlugin(provider))
    },
  }
}

export const inlineReferenceProviders = [
  createProviderEntry(taskMentionProvider),
  createProviderEntry(taskUrlProvider),
  createProviderEntry(projectUrlProvider),
  createProviderEntry(githubUrlProvider),
] as const

export function findInlineReferenceMatches(
  text: string,
  fallbackText?: string,
): RenderedInlineReferenceMatch[] {
  return inlineReferenceProviders
    .flatMap((provider) => provider.findMatches(text, fallbackText))
    .sort((left, right) => left.start - right.start || right.end - left.end)
}
