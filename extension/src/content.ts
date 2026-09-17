import type {
  CreateMessage,
  CreateResult,
  LookupMessage,
  LookupResult,
} from '#background'
import {
  type ChipAppearance,
  chipAppearance,
  type ChipState,
  syncChipNextTo,
} from '#chip'
import { githubLookupUrl } from '#github-url'

const STATE_LABEL_SELECTOR = '[data-component="StateLabel"]'
// Matches chip.ts's private CHIP_ATTR constant; duplicated here rather than
// exported since it's already part of the DOM contract asserted in tests.
const CHIP_SELECTOR = '[data-tq-chip]'

const CREATING_APPEARANCE: ChipAppearance = {
  text: 'tq: creating...',
  href: null,
  variant: 'empty',
}
const CREATE_FAILED_APPEARANCE: ChipAppearance = {
  text: 'tq: failed',
  href: null,
  variant: 'empty',
}

let currentAppearance: ChipAppearance | null = null
let lookedUpUrl: string | null = null
let creating = false
// Bumped every time refreshLookup starts a new URL context, so an in-flight
// lookup or create request can tell it's stale even if the user navigates
// back to the same URL before it resolves (a plain URL-equality check can't
// tell that case apart from "still current").
let generation = 0

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
  creating = false
  const thisGeneration = ++generation
  insertChips()
  if (url === null) return

  chrome.runtime
    .sendMessage<LookupMessage, LookupResult>({ type: 'lookup', url })
    .then((result) => {
      // A later navigation may have already started a newer lookup; drop
      // this response instead of overwriting it with a stale one.
      if (thisGeneration !== generation) return
      currentAppearance = chipAppearance(toChipState(result))
      insertChips()
    })
    .catch((error: unknown) => {
      if (thisGeneration !== generation) return
      console.warn('tq: lookup failed', error)
      currentAppearance = null
      insertChips()
    })
}

// Clicking the "+ tq" chip creates a task for the current issue/PR and opens
// it. A chip already showing a linked task has its own `href` and navigates
// via the browser's default link behavior instead.
function createTaskAndOpen(url: string): void {
  const thisGeneration = generation
  creating = true
  currentAppearance = CREATING_APPEARANCE
  insertChips()

  chrome.runtime
    .sendMessage<CreateMessage, CreateResult>({ type: 'create', url })
    .then((result) => {
      // A navigation may have started a newer lookup while this was in
      // flight; drop the response instead of acting on a stale one.
      if (thisGeneration !== generation) return
      creating = false

      if (!result.ok) {
        currentAppearance = CREATE_FAILED_APPEARANCE
        insertChips()
        return
      }

      const appearance = chipAppearance({
        kind: 'linked',
        taskId: result.task.id,
        taskNumber: result.task.number,
      })
      currentAppearance = appearance
      insertChips()
      if (appearance?.href != null) {
        location.href = appearance.href
      }
    })
    .catch((error: unknown) => {
      if (thisGeneration !== generation) return
      creating = false
      console.warn('tq: create failed', error)
      currentAppearance = CREATE_FAILED_APPEARANCE
      insertChips()
    })
}

document.addEventListener('click', (event) => {
  if (creating || lookedUpUrl === null) return
  if (!(event.target instanceof Element)) return
  const chip = event.target.closest(CHIP_SELECTOR)
  // A chip with an href is already linked; let it navigate normally instead
  // of creating a duplicate task.
  if (chip === null || chip.hasAttribute('href')) return
  createTaskAndOpen(lookedUpUrl)
})

if (insertChips() === 0) {
  console.warn('tq: no GitHub state label found; chip was not inserted')
}

new MutationObserver(() => {
  refreshLookup()
  insertChips()
}).observe(document.body, { childList: true, subtree: true })

refreshLookup()
