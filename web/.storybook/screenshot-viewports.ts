export const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const
export const MOBILE_VIEWPORT = { width: 375, height: 667 } as const

// Storybook's CSF indexer statically parses `tags` in *.stories.tsx and
// requires string literals there (importing these constants fails with
// "CSF: Expected tag to be string literal"), so story files must repeat
// these values as literals instead of importing them.
export const MOBILE_ONLY_TAG = 'mobile-only'
export const DESKTOP_ONLY_TAG = 'desktop-only'
