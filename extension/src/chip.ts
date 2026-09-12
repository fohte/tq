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
        href: `https://tq.fohte.net/tasks/${state.taskId}`,
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

export function syncChipNextTo(
  stateLabel: Element,
  appearance: ChipAppearance | null,
): void {
  const sibling = stateLabel.nextElementSibling
  const existing =
    sibling !== null && sibling.hasAttribute(CHIP_ATTR) ? sibling : null

  if (appearance === null) {
    existing?.remove()
    return
  }

  ensureStylesInjected()

  if (existing !== null) {
    if (!matchesAppearance(existing, appearance)) {
      applyAppearance(existing, appearance)
    }
    return
  }

  const chip = document.createElement('a')
  applyAppearance(chip, appearance)
  stateLabel.insertAdjacentElement('afterend', chip)
}
