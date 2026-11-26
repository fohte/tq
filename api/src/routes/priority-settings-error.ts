import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { HTTPException } from 'hono/http-exception'

export function throwPrioritySettingsError(error: Error): never {
  captureWithFingerprint(error, ['api.priority-settings', '{{ default }}'])
  // eslint-disable-next-line no-restricted-syntax -- convert the consumed Result error into the HTTP boundary response
  throw new HTTPException(500, { message: 'Internal server error' })
}
