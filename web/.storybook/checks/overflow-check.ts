import type { StorybookCheck } from '#storybook-config/checks/check'
import { throwIfNotEmpty } from '#storybook-config/checks/check'

// addon-vitest's runStory() creates a <div>, appends it to document.body,
// and only removes it at the start of the *next* test (see
// @storybook/preview-api's runStory()) — not at the end of this one. This
// setup file's afterEach never gets `context.canvasElement` itself (that's
// populated inside composeStory().run(), a call this file doesn't make), so
// the still-mounted container is reached the only way available here: as
// the last element appended to body.
function findStoryRoot(): Element | null {
  return document.body.lastElementChild
}

function describeElement(el: Element): string {
  const id = el.id ? `#${el.id}` : ''
  const classAttr = el.getAttribute('class')
  const classes =
    classAttr !== null && classAttr !== ''
      ? `.${classAttr.trim().split(/\s+/).join('.')}`
      : ''
  return `${el.tagName.toLowerCase()}${id}${classes}`
}

// scrollWidth > clientWidth alone doesn't mean an element clips its own
// content — it only does if the element's own `overflow-x` actually clips
// (not `visible`). When it's `visible`, the excess content just paints
// outside the box, fully on-screen; if some ancestor further up *does* clip
// it, that ancestor independently has its own scrollWidth > clientWidth (per
// https://www.w3.org/TR/cssom-view-1/#scrolling-area, unclipped descendant
// overflow keeps bubbling up until a clipping box swallows it) and gets
// caught on its own iteration, so skipping `visible` here loses no coverage.
//
// `text-overflow: ellipsis` is excluded for a different reason: it's a
// deliberate "this is cut off, here's more" affordance (Tailwind's
// `truncate`), not a silent, undiscoverable clip — exactly the class of
// intentional truncation this check isn't meant to flag.
function clipsOwnContent(cs: CSSStyleDeclaration): boolean {
  return cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis'
}

// The standard visually-hidden a11y technique (Tailwind's `sr-only`, Base
// UI's `visuallyHidden` style used for native shadow inputs) shrinks an
// element to a 1x1px box and clips it on purpose, to keep it readable by
// screen readers while invisible to sighted users. A 1x1px box can never
// show meaningfully clipped content to a sighted user either way, so this
// is a safe, general skip rather than a per-story exclusion.
function isVisuallyHidden(el: Element): boolean {
  return el.clientWidth <= 1 && el.clientHeight <= 1
}

// el.scrollWidth > el.clientWidth means the element's content doesn't fit
// inside its own padding box (clientWidth) — i.e. some of it is clipped and
// invisible.
//
// This only measures overflow on the inline-end (right, in LTR) side: the
// CSSOM "scrolling area" a scrollable box exposes never extends past its
// inline-start edge, so content overflowing to the *left* is invisible to
// this check (https://www.w3.org/TR/cssom-view-1/#scrolling-area).
// `position: fixed` elements are invisible to it too — they escape the
// containing block chain, so an off-screen fixed element never shows up in
// any ancestor's scrollWidth.
function findOverflows(root: Element): string[] {
  const overflows: string[] = []
  for (const el of root.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth) continue
    if (isVisuallyHidden(el)) continue
    if (!clipsOwnContent(getComputedStyle(el))) continue

    const overflowPx = el.scrollWidth - el.clientWidth
    overflows.push(
      `${describeElement(el)}: scrollWidth=${String(el.scrollWidth)} > clientWidth=${String(el.clientWidth)} (+${String(overflowPx)}px)`,
    )
  }
  return overflows
}

function isDisabled(storyParameters: unknown): boolean {
  if (typeof storyParameters !== 'object' || storyParameters === null) {
    return false
  }
  if (!('overflowCheck' in storyParameters)) return false
  const { overflowCheck } = storyParameters
  if (typeof overflowCheck !== 'object' || overflowCheck === null) {
    return false
  }
  return 'disable' in overflowCheck && overflowCheck.disable === true
}

export const overflowCheck: StorybookCheck = {
  reset: () => {},
  assert: (storyParameters) => {
    if (isDisabled(storyParameters)) return

    const root = findStoryRoot()
    if (root == null) return

    throwIfNotEmpty(
      findOverflows(root),
      'Story has element(s) overflowing their container (clipped and invisible)',
    )
  },
}
