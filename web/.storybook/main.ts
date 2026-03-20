import type { StorybookConfig } from '@storybook/react-vite'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@chromatic-com/storybook'),
  ],
  framework: getAbsolutePath('@storybook/react-vite'),
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
