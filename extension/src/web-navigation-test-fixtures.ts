import { TQ_ORIGIN } from '#config'

export function makeWebNavigationDetails(
  overrides: Partial<chrome.webNavigation.WebNavigationBaseCallbackDetails> = {},
): chrome.webNavigation.WebNavigationBaseCallbackDetails {
  return {
    documentLifecycle: 'active',
    frameId: 0,
    frameType: 'outermost_frame',
    parentFrameId: -1,
    processId: 1,
    tabId: 9,
    timeStamp: 0,
    url: `${TQ_ORIGIN}/tasks/42`,
    ...overrides,
  }
}
