import { TQ_ORIGIN } from '#config'

export type ChipState =
  | { kind: 'linked'; taskId: string; taskNumber: number }
  | { kind: 'unlinked' }
  | { kind: 'error' }

export interface ChipAppearance {
  text: string
  href: string | null
  variant: 'linked' | 'empty'
}

export function chipAppearance(state: ChipState): ChipAppearance | null {
  switch (state.kind) {
    case 'linked':
      return {
        text: `tq #${String(state.taskNumber)}`,
        href: `${TQ_ORIGIN}/tasks/${state.taskId}`,
        variant: 'linked',
      }
    case 'unlinked':
      return { text: '+ tq', href: null, variant: 'empty' }
    case 'error':
      return null
  }
}

const CHIP_ATTR = 'data-tq-chip'
const STYLE_ELEMENT_ID = 'tq-chip-styles'

// Keyed by the state label reference instead of DOM position: some other
// browser extensions (e.g. Refined GitHub) rewrap a state label in a newly
// created parent, which would otherwise strand the chip in the old parent
// and make a position-scoped lookup miss it.
const chipsByStateLabel = new WeakMap<Element, Element>()

function ensureStylesInjected(): void {
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) return

  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = `
    [${CHIP_ATTR}] {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
      padding: 3px 11px;
      border: 1px solid var(--borderColor-default);
      border-radius: 2em;
      font-size: 12px;
      text-decoration: none;
    }
    [${CHIP_ATTR}="linked"] {
      color: var(--fgColor-accent);
    }
    [${CHIP_ATTR}="empty"] {
      color: var(--fgColor-muted);
    }
  `
  document.head.append(style)
}

function matchesAppearance(chip: Element, appearance: ChipAppearance): boolean {
  return (
    chip.getAttribute(CHIP_ATTR) === appearance.variant &&
    chip.textContent === appearance.text &&
    chip.getAttribute('href') === appearance.href
  )
}

function applyAppearance(chip: Element, appearance: ChipAppearance): void {
  chip.setAttribute(CHIP_ATTR, appearance.variant)
  chip.textContent = appearance.text
  if (appearance.href !== null) {
    chip.setAttribute('href', appearance.href)
  } else {
    chip.removeAttribute('href')
  }
}

function findExistingChip(stateLabel: Element): Element | null {
  const tracked = chipsByStateLabel.get(stateLabel)
  if (tracked !== undefined && tracked.isConnected) return tracked

  // Fall back to a direct-child scan for a chip this call didn't create
  // itself (e.g. inserted by another instance of this content script) so
  // it's adopted instead of duplicated.
  const parent = stateLabel.parentElement
  if (parent === null) return null
  const adjacent = Array.from(parent.children).find((child) =>
    child.hasAttribute(CHIP_ATTR),
  )
  if (adjacent === undefined) return null

  chipsByStateLabel.set(stateLabel, adjacent)
  return adjacent
}

export function syncChipNextTo(
  stateLabel: Element,
  appearance: ChipAppearance | null,
): void {
  const existing = findExistingChip(stateLabel)

  if (appearance === null) {
    existing?.remove()
    return
  }

  ensureStylesInjected()

  if (existing !== null) {
    if (!matchesAppearance(existing, appearance)) {
      applyAppearance(existing, appearance)
    }
    // The label was moved into a different parent (e.g. rewrapped by
    // another extension) without the chip following along; bring it back
    // next to the label instead of leaving it behind.
    if (existing.parentElement !== stateLabel.parentElement) {
      stateLabel.insertAdjacentElement('afterend', existing)
    }
    return
  }

  const chip = document.createElement('a')
  applyAppearance(chip, appearance)
  stateLabel.insertAdjacentElement('afterend', chip)
  chipsByStateLabel.set(stateLabel, chip)
}
