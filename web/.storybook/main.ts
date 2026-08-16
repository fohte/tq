import type { StorybookConfig } from '@storybook/react-vite'
import type { Plugin, PluginOption } from 'vite'

function isPwaPlugin(plugin: Plugin): boolean {
  return plugin.name.startsWith('vite-plugin-pwa')
}

// vite-plugin-pwa runs on every Vite build that loads web/vite.config.ts,
// including this Storybook build — it then tries to precache Storybook's own
// runtime chunk (sb-manager/globals-runtime.js, ~3.2 MB), which exceeds
// workbox's default precache size limit and fails the build. Storybook's
// static output isn't a PWA, so drop the plugin here.
function withoutPwaPlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins.flatMap((plugin): PluginOption[] => {
    if (plugin === false || plugin == null) return []
    if (Array.isArray(plugin)) return withoutPwaPlugins(plugin)
    if (plugin instanceof Promise) return [plugin]
    return isPwaPlugin(plugin) ? [] : [plugin]
  })
}

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  staticDirs: ['../public'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal(viteConfig) {
    return {
      ...viteConfig,
      plugins: withoutPwaPlugins(viteConfig.plugins ?? []),
    }
  },
}

export default config
