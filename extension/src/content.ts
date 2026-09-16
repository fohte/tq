import type { LookupMessage, LookupResult } from '#background'
import {
  type ChipAppearance,
  chipAppearance,
  type ChipState,
  syncChipNextTo,
} from '#chip'
import { githubLookupUrl } from '#github-url'

const STATE_LABEL_SELECTOR = '[data-component="StateLabel"]'

// Set once the background lookup settles; until then, stays null so no chip
// is shown for a state we don't actually know yet.
let currentAppearance: ChipAppearance | null = null

function insertChips(): number {
  const stateLabels = document.querySelectorAll(STATE_LABEL_SELECTOR)
  stateLabels.forEach((stateLabel) => {
    syncChipNextTo(stateLabel, currentAppearance)
  })
  return stateLabels.length
}

function setState(state: ChipState): void {
  currentAppearance = chipAppearance(state)
  insertChips()
}

if (insertChips() === 0) {
  console.warn('tq: no GitHub state label found; chip was not inserted')
}

new MutationObserver(insertChips).observe(document.body, {
  childList: true,
  subtree: true,
})

function toChipState(result: LookupResult): ChipState {
  if (!result.ok) return { kind: 'error' }
  if (!result.task) return { kind: 'unlinked' }
  return {
    kind: 'linked',
    taskId: result.task.id,
    taskNumber: result.task.number,
  }
}

const lookupUrl = githubLookupUrl(location.href)
if (lookupUrl !== null) {
  chrome.runtime
    .sendMessage<LookupMessage, LookupResult>({
      type: 'lookup',
      url: lookupUrl,
    })
    .then((result) => {
      setState(toChipState(result))
    })
    .catch((error: unknown) => {
      console.warn('tq: lookup failed', error)
      setState({ kind: 'error' })
    })
}
