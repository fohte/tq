import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { Context } from 'hono'

import { IntegrationConfigError } from '#integrations/errors'
import { SlackApiError } from '#integrations/slack/index'
import {
  SlackChannelNotFoundError,
  SlackMessageNotFoundError,
  SlackNotConnectedError,
} from '#integrations/slack/messages'
import { InvalidSlackPermalinkError } from '#integrations/slack/permalink'

// Route-level error -> HTTP status/body mapping for routes/slack.ts's
// /resolve, mirroring routes/github-link-error.ts's mapping for the GitHub
// equivalent.
export function slackLinkErrorResponse(
  c: Context,
  error: Error,
  fingerprintPrefix: string,
) {
  if (error instanceof InvalidSlackPermalinkError) {
    return c.json({ error: error.message }, 400)
  }
  // No Slack connection: client-actionable (connect Slack first), safe to
  // relay directly.
  if (error instanceof SlackNotConnectedError) {
    return c.json({ error: error.message }, 400)
  }
  if (
    error instanceof SlackChannelNotFoundError ||
    error instanceof SlackMessageNotFoundError
  ) {
    return c.json({ error: error.message }, 404)
  }
  // A rejected request to Slack itself (e.g. the message or channel is
  // inaccessible with every connected account's token).
  if (error instanceof SlackApiError && error.rejected) {
    return c.json({ error: error.message }, 404)
  }
  if (error instanceof IntegrationConfigError) {
    captureWithFingerprint(error, `api.${fingerprintPrefix}.config-error`)
    return c.json({ error: 'Internal server error' }, 500)
  }
  captureWithFingerprint(error, `api.${fingerprintPrefix}.failed`)
  return c.json({ error: 'Internal server error' }, 500)
}
