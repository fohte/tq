import '@web/index.css'

import type { Preview } from '@storybook/react-vite'
import { ContextFilterProvider } from '@web/hooks/use-context-filter'

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
          <Story />
        </ContextFilterProvider>
      )
    },
  ],
}

export default preview
