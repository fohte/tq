import '#index.css'

import {
  configureUnhandledApiRequestCheck,
  reportUnhandledApiRequest,
} from '@fohte/storybook-addon/preview'
import type { Preview } from '@storybook/react-vite'
import { initialize, mswLoader } from 'msw-storybook-addon'

import { StoryRouter } from '#storybook-config/story-router'

configureUnhandledApiRequestCheck({ pathPrefixes: ['/api/'] })

initialize({
  onUnhandledRequest: ({ url }, print) => {
    if (reportUnhandledApiRequest(url)) {
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
    // Checkbox's `after:-inset-x-3 after:-inset-y-2` pseudo-element enlarges
    // its click/touch target past its visible box on purpose, but paints
    // nothing (no border/background), so nothing is ever visibly cut off
    // wherever Checkbox renders.
    overflowCheck: { globalIgnoreSelectors: ['[data-slot="checkbox"]'] },
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

      return <StoryRouter component={() => <Story />} />
    },
  ],
  loaders: [mswLoader],
}

export default preview
