import { chipAppearance, type ChipState, syncChipNextTo } from '#chip'

const STATE_LABEL_SELECTOR = '[data-component="StateLabel"]'

const FIXED_STATE: ChipState = { kind: 'unlinked' }

function insertChips(): number {
  const appearance = chipAppearance(FIXED_STATE)
  const stateLabels = document.querySelectorAll(STATE_LABEL_SELECTOR)
  stateLabels.forEach((stateLabel) => {
    syncChipNextTo(stateLabel, appearance)
  })
  return stateLabels.length
}

if (insertChips() === 0) {
  console.warn('tq: no GitHub state label found; chip was not inserted')
}

// GitHub recreates StateLabel nodes on scroll and in-page navigation.
new MutationObserver(insertChips).observe(document.body, {
  childList: true,
  subtree: true,
})
