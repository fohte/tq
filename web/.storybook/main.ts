import type { StorybookConfig } from '@storybook/react-vite'
import { fileURLToPath } from 'url'

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
    config.resolve.alias = {
      ...((config.resolve.alias as Record<string, string>) ?? {}),
      '@web': fileURLToPath(new URL('../src', import.meta.url)),
    }
    return config
  },
}

export default config
