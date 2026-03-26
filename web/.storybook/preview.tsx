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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Storybook globals typing is `any`
      const theme = context.globals['theme'] ?? 'dark'
      document.documentElement.classList.toggle('dark', theme === 'dark')
      return (
        <ContextFilterProvider>
          <Story />
        </ContextFilterProvider>
      )
    },
  ],
}

export default preview
