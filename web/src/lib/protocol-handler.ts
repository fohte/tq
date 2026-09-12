import { err, ok, Result } from 'neverthrow'

const TQ_PROTOCOL = 'web+tq:'

export interface ProtocolHandlerTarget {
  to: string
  search: Record<string, string>
  hash: string
}

const TOP_TARGET: ProtocolHandlerTarget = { to: '/', search: {}, hash: '' }

const parseUrl = Result.fromThrowable(
  (raw: string) => new URL(raw),
  () => undefined,
)

// Rejects protocol-relative paths (`//...`) to prevent escaping the app origin.
function isSafeInternalPath(to: string): boolean {
  return !to.startsWith('//')
}

export function resolveProtocolHandlerTarget(
  rawUrl: string,
): ProtocolHandlerTarget {
  return parseUrl(rawUrl)
    .andThen((url) => {
      if (url.protocol !== TQ_PROTOCOL) return err(undefined)
      const to = `/${url.host}${url.pathname}`
      if (!isSafeInternalPath(to)) return err(undefined)
      return ok<ProtocolHandlerTarget>({
        to,
        // Last value wins for a repeated key — no destination route reads a
        // multi-valued search param today.
        search: Object.fromEntries(url.searchParams),
        hash: url.hash.replace(/^#/, ''),
      })
    })
    .mapErr(() => {
      console.error('failed to resolve protocol handler target', rawUrl)
      return undefined
    })
    .unwrapOr(TOP_TARGET)
}
