import '#index.css'

import {
  configureUnhandledApiRequestCheck,
  reportUnhandledApiRequest,
} from '@fohte/storybook-addon/preview'
import type { Preview } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { initialize, mswLoader } from 'msw-storybook-addon'

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
    overflowCheck: { ignoreSelectors: ['[data-slot="checkbox"]'] },
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

      const rootRoute = createRootRoute({
        validateSearch: (search: Record<string, unknown>) => search,
        component: () => <Story />,
      })
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })

      return <RouterProvider router={router} />
    },
  ],
  loaders: [mswLoader],
}

export default preview
