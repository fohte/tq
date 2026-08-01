import '#index.css'

import type { Preview } from '@storybook/react-vite'
import { initialize, mswLoader } from 'msw-storybook-addon'

import { ContextFilterProvider } from '#hooks/use-context-filter'
import { TagFilterProvider } from '#hooks/use-tag-filter'

initialize({
  onUnhandledRequest: ({ url: requestUrl }, print) => {
    const url = new URL(requestUrl)
    // Only error on same-origin API requests; let Storybook assets, HMR, and third-party requests pass through
    if (
      url.origin === self.location.origin &&
      url.pathname.startsWith('/api/')
    ) {
      print.error()
    }
  },
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
  },
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [
    (Story, context) => {
      const theme: unknown = context.globals['theme']
      const themeValue = typeof theme === 'string' ? theme : 'dark'
      document.documentElement.classList.toggle('dark', themeValue === 'dark')
      return (
        <ContextFilterProvider>
          <TagFilterProvider>
            <Story />
          </TagFilterProvider>
        </ContextFilterProvider>
      )
    },
  ],
  loaders: [mswLoader],
}

export default preview
