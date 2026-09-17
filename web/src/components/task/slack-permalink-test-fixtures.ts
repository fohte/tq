import type { SlackPermalinkPreview } from '#hooks/use-slack-permalink-preview'

export function makeSlackPermalinkPreview(
  overrides: Partial<SlackPermalinkPreview> = {},
): SlackPermalinkPreview {
  return {
    channelId: 'C0123ABCDEF',
    channelName: 'general',
    isPrivate: false,
    authorName: 'Hayato Kawai',
    authorAvatarUrl: null,
    text: 'Deploy finished, everything looks green.',
    ts: '1699999999.000100',
    isThreadReply: false,
    ...overrides,
  }
}
