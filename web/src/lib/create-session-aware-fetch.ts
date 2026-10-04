import { Result } from 'neverthrow'

import { reloadPage } from '#lib/reload-page'
import { SESSION_RELOAD_MARKER_KEY } from '#lib/storage-keys'

function trySessionStorage<T>(op: () => T, fallback: T): T {
  return Result.fromThrowable(op, (error) => error)()
    .mapErr((error) => {
      console.error('sessionStorage access failed for the reload marker', error)
      return error
    })
    .unwrapOr(fallback)
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
    reloadPage()
  })

  notice.append(heading, body, button)
  document.body.appendChild(notice)
}

/** Creates a fetch client with reload state initialized from session storage. */
export function createSessionAwareFetch() {
  // Read once per page load. A later request in the same page must not see a
  // marker written by this load and mistake it for a prior failed reload.
  let reloadAlreadyFailed = readReloadMarker()

  // Guards a burst of concurrent requests within the same page load from
  // each independently triggering their own reload.
  let reloadTriggered = false

  return async function sessionAwareFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Cloudflare Access redirects expired sessions to a cross-origin login
    // page without CORS headers. Manual mode exposes the redirect so a full
    // navigation can rerun the Access session check.
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
      reloadPage()
    }

    // Never resolve: the page is about to be replaced by the reload, or the
    // notice above is now telling the user what to do instead.
    return new Promise<Response>(() => {})
  }
}
