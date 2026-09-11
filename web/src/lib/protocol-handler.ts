import { err, ok, Result } from 'neverthrow'

const TQ_PROTOCOL = 'web+tq:'

export type ProtocolHandlerTarget =
  { to: '/tasks/$taskId'; params: { taskId: string } } | { to: '/' }

const TOP_TARGET: ProtocolHandlerTarget = { to: '/' }

const parseUrl = Result.fromThrowable(
  (raw: string) => new URL(raw),
  () => undefined,
)

// Must only ever return one of the two typed targets above — never a path
// built from url.host/url.pathname — or a crafted web+tq:// link could
// redirect outside the app's own router.
export function resolveProtocolHandlerTarget(
  rawUrl: string,
): ProtocolHandlerTarget {
  return parseUrl(rawUrl)
    .andThen((url) => {
      if (url.protocol !== TQ_PROTOCOL) return err(undefined)
      const taskId = /^\/([^/]+)$/.exec(url.pathname)?.[1]
      if (url.host === 'tasks' && taskId != null) {
        return ok<ProtocolHandlerTarget>({
          to: '/tasks/$taskId',
          params: { taskId },
        })
      }
      return err(undefined)
    })
    .mapErr(() => {
      console.error('failed to resolve protocol handler target', rawUrl)
      return undefined
    })
    .unwrapOr(TOP_TARGET)
}
