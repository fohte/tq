// Cloudflare Access redirects an expired session cross-origin to its login
// page. Fetch follows that redirect by default, and the browser then blocks
// it as a CORS error since the redirect target has no CORS headers. Using
// `redirect: 'manual'` surfaces the redirect as an opaque response instead,
// so it can be detected and turned into a full reload (which re-runs the
// Cloudflare Access session check as a real navigation).
export async function sessionAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, { ...init, redirect: 'manual' })
  if (res.type === 'opaqueredirect' && typeof location !== 'undefined') {
    location.reload()
    // Never resolve: the page is about to be replaced by the reload.
    return new Promise<Response>(() => {})
  }
  return res
}
