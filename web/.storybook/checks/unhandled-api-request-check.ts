import type { StorybookCheck } from '#storybook-config/checks/check'
import { throwIfNotEmpty } from '#storybook-config/checks/check'
import { unhandledApiRequestUrls } from '#storybook-config/unhandled-api-requests'

export const unhandledApiRequestCheck: StorybookCheck = {
  reset: () => {
    unhandledApiRequestUrls.length = 0
  },
  assert: () => {
    // A story hitting an /api/ endpoint with no MSW handler gets MSW's error
    // response instead of real data, so the screenshot captures a broken UI
    // state without failing — see web/.storybook/preview.tsx's
    // onUnhandledRequest, which populates this array.
    throwIfNotEmpty(
      unhandledApiRequestUrls,
      'Story made unhandled /api/ request(s); add an MSW handler for',
    )
  },
}
