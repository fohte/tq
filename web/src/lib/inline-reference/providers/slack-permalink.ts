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
// is captured up to the next whitespace rather than excluding punctuation
// characters from the class, since a dot is a legitimate mid-query character
// (e.g. `thread_ts=1699999999.000100`). Trailing punctuation a human typed
// around the URL (wrapping parens, a sentence-ending period, ...) is
// stripped separately below instead.
const SLACK_PERMALINK_URL_PATTERN =
  /https:\/\/[a-z0-9-]+\.slack\.com\/archives\/[A-Z0-9]+\/p\d+(?:\?\S*)?/gi

// Trims from the end only, so mid-query characters like the dot above are
// untouched.
const TRAILING_PUNCTUATION_PATTERN = /[)\]},.!?]+$/

export const slackPermalinkProvider: InlineReferenceProvider<SlackPermalinkData> =
  {
    id: 'slack-permalink',

    findMatches(text) {
      const matches = []
      for (const match of text.matchAll(SLACK_PERMALINK_URL_PATTERN)) {
        const raw = match[0].replace(TRAILING_PUNCTUATION_PATTERN, '')
        matches.push({
          start: match.index,
          end: match.index + raw.length,
          raw,
          data: { url: raw },
        })
      }
      return matches
    },

    Chip: SlackPermalinkChip,
    Card: SlackPermalinkCard,
  }
