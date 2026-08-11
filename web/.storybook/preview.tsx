import '#index.css'

import type { Preview } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { initialize, mswLoader } from 'msw-storybook-addon'

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
