// Cloudflare Access redirects an expired session cross-origin to its login
// page. Fetch follows that redirect by default, and the browser then blocks
// it as a CORS error since the redirect target has no CORS headers. Using
// `redirect: 'manual'` surfaces the redirect as an opaque response instead,
// so it can be detected and turned into a full reload (which re-runs the
// Cloudflare Access session check as a real navigation). If a previous
// reload already happened and the session is still broken, this shows a
// recovery notice instead of reloading again, so a broken session can't
// reload forever.
export async function sessionAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, { ...init, redirect: 'manual' })

  if (res.type !== 'opaqueredirect') {
    reloadAlreadyFailed = false
    reloadTriggered = false
    removeReloadMarker()
    return res
  }

  if (typeof location === 'undefined') {
    return res
  }

  if (reloadAlreadyFailed) {
    showRecoveryFailedNotice()
  } else if (!reloadTriggered) {
    reloadTriggered = true
    writeReloadMarker()
    location.reload()
  }

  // Never resolve: the page is about to be replaced by the reload, or the
  // notice above is now telling the user what to do instead.
  return new Promise<Response>(() => {})
}

export const SESSION_RELOAD_MARKER_KEY =
  'tq:session-aware-fetch:reload-attempted'

function trySessionStorage<T>(op: () => T, fallback: T): T {
  try {
    return op()
  } catch (error) {
    console.error('sessionStorage access failed for the reload marker', error)
    return fallback
  }
}

function readReloadMarker(): boolean {
  // Storage unavailable is treated the same as "already failed": there is
  // no way to persist a reload attempt across the reload itself, so
  // retrying would risk looping forever with no memory of having tried.
  return trySessionStorage(
    () => sessionStorage.getItem(SESSION_RELOAD_MARKER_KEY) === '1',
    true,
  )
}

function writeReloadMarker(): void {
  trySessionStorage(() => {
    sessionStorage.setItem(SESSION_RELOAD_MARKER_KEY, '1')
  }, undefined)
}

function removeReloadMarker(): void {
  trySessionStorage(() => {
    sessionStorage.removeItem(SESSION_RELOAD_MARKER_KEY)
  }, undefined)
}

// Read once, when this module is evaluated: ES modules only re-evaluate on
// an actual navigation, not on repeated calls within the same page, so this
// snapshot reflects whether a PREVIOUS page load already tried an automatic
// reload and it's still failing. Reading the marker fresh on every call
// instead would race: a request unrelated to that reload (e.g. a debounced
// search query or a background poll) arriving later in this same page's
// life could see the marker this load itself writes below and wrongly
// conclude a previous load had already failed.
let reloadAlreadyFailed = readReloadMarker()

// Guards a burst of concurrent requests within the same page load from each
// independently triggering their own reload.
let reloadTriggered = false

const NOTICE_TEXT = {
  heading: 'Session recovery failed',
  body: "tq couldn't restore your session automatically. Check your Cloudflare Access login, then reload this page.",
  button: 'Reload page',
}

const NOTICE_ID = 'tq-session-recovery-notice'

function showRecoveryFailedNotice(): void {
  if (document.getElementById(NOTICE_ID)) return

  const notice = document.createElement('div')
  notice.id = NOTICE_ID
  notice.setAttribute('role', 'alert')
  notice.className =
    'fixed inset-0 z-max flex flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground'

  const heading = document.createElement('p')
  heading.textContent = NOTICE_TEXT.heading
  heading.className = 'text-xl font-semibold'

  const body = document.createElement('p')
  body.textContent = NOTICE_TEXT.body
  body.className = 'max-w-md'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = NOTICE_TEXT.button
  button.className = 'rounded-md bg-primary px-5 py-2 text-primary-foreground'
  button.addEventListener('click', () => {
    location.reload()
  })

  notice.append(heading, body, button)
  document.body.appendChild(notice)
}
