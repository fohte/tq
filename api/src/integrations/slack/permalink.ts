import { err, ok, type Result } from 'neverthrow'

export interface SlackPermalinkRef {
  channelId: string
  ts: string
  threadTs: string | null
}

export class InvalidSlackPermalinkError extends Error {
  constructor(url: string) {
    super(`Not a Slack permalink: ${url}`)
    this.name = 'InvalidSlackPermalinkError'
  }
}

// A permalink's `p<digits>` segment isn't documented as a ts encoding
// anywhere on docs.slack.dev; verified against live permalinks instead
// (fetched via the Slack search API) — the digits are the message's `ts`
// (e.g. "1753880000.123456") with the decimal point removed, so the last 6
// digits are always the microseconds part. `?thread_ts=<parent ts>` is only
// present when the linked message is a thread reply.
const SLACK_PERMALINK_PATTERN =
  /^https:\/\/[a-z0-9-]+\.slack\.com\/archives\/([A-Z0-9]+)\/p(\d{7,})(?:\?(.*))?$/i

function digitsToTs(digits: string): string {
  return `${digits.slice(0, -6)}.${digits.slice(-6)}`
}

export function parseSlackPermalink(
  url: string,
): Result<SlackPermalinkRef, InvalidSlackPermalinkError> {
  const match = SLACK_PERMALINK_PATTERN.exec(url.trim())
  const channelId = match?.[1]
  const digits = match?.[2]
  if (channelId == null || digits == null) {
    return err(new InvalidSlackPermalinkError(url))
  }

  const queryString = match?.[3]
  const threadTs =
    queryString != null
      ? new URLSearchParams(queryString).get('thread_ts')
      : null

  return ok({
    channelId,
    ts: digitsToTs(digits),
    threadTs,
  })
}
