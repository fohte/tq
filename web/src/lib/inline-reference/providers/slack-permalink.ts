import { SlackPermalinkCard } from '#components/task/slack-permalink-card'
import { SlackPermalinkChip } from '#components/task/slack-permalink-chip'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'

export interface SlackPermalinkData {
  url: string
}

// Scans for a Slack permalink's URL shape only (`/archives/<channelId>/p<digits>`
// with an optional query string); the API's `parseSlackPermalink` is the
// authoritative validator, so this only needs to be permissive enough to
// trigger a resolve attempt. The optional query (`?thread_ts=...&cid=...`)
// is captured up to the next whitespace, so unlike the GitHub URL pattern
// this does not try to exclude trailing punctuation stuck to the query.
const SLACK_PERMALINK_URL_PATTERN =
  /https:\/\/[a-z0-9-]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+(?:\?\S*)?/gi

export const slackPermalinkProvider: InlineReferenceProvider<SlackPermalinkData> =
  {
    id: 'slack-permalink',

    findMatches(text) {
      const matches = []
      for (const match of text.matchAll(SLACK_PERMALINK_URL_PATTERN)) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: { url: match[0] },
        })
      }
      return matches
    },

    Chip: SlackPermalinkChip,
    Card: SlackPermalinkCard,
  }
