import type { StorybookConfig } from '@storybook/react-vite'
import { fileURLToPath } from 'url'

function isRecordAlias(alias: unknown): alias is Record<string, string> {
  return typeof alias === 'object' && alias != null && !Array.isArray(alias)
}

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal(config) {
    config.resolve ??= {}
    const existing = config.resolve.alias
    const base = isRecordAlias(existing) ? { ...existing } : {}
    base['@web'] = fileURLToPath(new URL('../src', import.meta.url))
    config.resolve.alias = base
    return config
  },
}

export default config
