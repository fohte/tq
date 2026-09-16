import type { LookupMessage, LookupResult } from '#background'
import {
  type ChipAppearance,
  chipAppearance,
  type ChipState,
  syncChipNextTo,
} from '#chip'
import { githubLookupUrl } from '#github-url'

const STATE_LABEL_SELECTOR = '[data-component="StateLabel"]'

let currentAppearance: ChipAppearance | null = null
let lookedUpUrl: string | null = null

function insertChips(): number {
  const stateLabels = document.querySelectorAll(STATE_LABEL_SELECTOR)
  stateLabels.forEach((stateLabel) => {
    syncChipNextTo(stateLabel, currentAppearance)
  })
  return stateLabels.length
}

function toChipState(result: LookupResult): ChipState {
  if (!result.ok) return { kind: 'error' }
  if (!result.task) return { kind: 'unlinked' }
  return {
    kind: 'linked',
    taskId: result.task.id,
    taskNumber: result.task.number,
  }
}

// GitHub navigates between issue/PR pages via Turbo (same-document DOM
// morphing, no script reload), so a fresh lookup must be triggered whenever
// the URL changes under us instead of only once at content-script load.
function refreshLookup(): void {
  const url = githubLookupUrl(location.href)
  if (url === lookedUpUrl) return
  lookedUpUrl = url
  currentAppearance = null
  insertChips()
  if (url === null) return

  chrome.runtime
    .sendMessage<LookupMessage, LookupResult>({ type: 'lookup', url })
    .then((result) => {
      // A later navigation may have already started a newer lookup; drop
      // this response instead of overwriting it with a stale one.
      if (url !== lookedUpUrl) return
      currentAppearance = chipAppearance(toChipState(result))
      insertChips()
    })
    .catch((error: unknown) => {
      if (url !== lookedUpUrl) return
      console.warn('tq: lookup failed', error)
      currentAppearance = null
      insertChips()
    })
}

if (insertChips() === 0) {
  console.warn('tq: no GitHub state label found; chip was not inserted')
}

new MutationObserver(() => {
  refreshLookup()
  insertChips()
}).observe(document.body, { childList: true, subtree: true })

refreshLookup()
