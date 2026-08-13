import type { StorybookCheck } from '#storybook-config/checks/check'
import { throwIfNotEmpty } from '#storybook-config/checks/check'

// addon-vitest's runStory() (inside @storybook/preview-api) creates the
// story's container as a bare <div> and appends it to document.body before
// mounting anything into it — this setup file's afterEach never gets
// `context.canvasElement` itself (that's populated inside
// composeStory().run(), a call this file doesn't make), so this is the only
// way to reach the same element. Portal-based components (Base UI's
// Dialog/Select/Popover/etc., this app's own SearchModal) append their own
// <div>s directly to document.body too, but only *after* the story has
// mounted — so the container is reliably the *first* element appended to
// body once a story starts, not the last. A MutationObserver set up in
// reset() (which runs before the story mounts) captures it.
let storyRoot: Element | null = null
let bodyObserver: MutationObserver | null = null

function watchStoryRoot(): void {
  storyRoot = null
  bodyObserver?.disconnect()
  bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          storyRoot = node
          bodyObserver?.disconnect()
          return
        }
      }
    }
  })
  bodyObserver.observe(document.body, { childList: true })
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
function findOverflows(root: Element, ignoreSelectors: string[]): string[] {
  const ignoreSelector = ignoreSelectors.join(',')
  const overflows: string[] = []
  for (const el of root.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth) continue
    if (isVisuallyHidden(el)) continue
    if (ignoreSelector !== '' && el.closest(ignoreSelector) != null) continue
    if (!clipsOwnContent(getComputedStyle(el))) continue

    const overflowPx = el.scrollWidth - el.clientWidth
    overflows.push(
      `${describeElement(el)}: scrollWidth=${String(el.scrollWidth)} > clientWidth=${String(el.clientWidth)} (+${String(overflowPx)}px)`,
    )
  }
  return overflows
}

function overflowCheckParameters(storyParameters: unknown): object | undefined {
  if (typeof storyParameters !== 'object' || storyParameters === null) {
    return undefined
  }
  if (!('overflowCheck' in storyParameters)) return undefined
  const { overflowCheck } = storyParameters
  if (typeof overflowCheck !== 'object' || overflowCheck === null) {
    return undefined
  }
  return overflowCheck
}

function isDisabled(overflowCheck: object | undefined): boolean {
  return (
    overflowCheck !== undefined &&
    'disable' in overflowCheck &&
    overflowCheck.disable === true
  )
}

// Narrower than `overflowCheck.disable`: exempt one intentionally-scrollable
// subtree (e.g. a chip row using `overflow-x-auto`) via a CSS selector in
// the story's own parameters, so the rest of the story still gets checked —
// without adding a check-only attribute to the component being tested.
function ignoreSelectorsOf(overflowCheck: object | undefined): string[] {
  if (overflowCheck === undefined) return []
  if (!('ignoreSelectors' in overflowCheck)) return []
  const { ignoreSelectors } = overflowCheck
  if (!Array.isArray(ignoreSelectors)) return []
  return ignoreSelectors.filter((s): s is string => typeof s === 'string')
}

export const overflowCheck: StorybookCheck = {
  reset: watchStoryRoot,
  assert: (storyParameters) => {
    const params = overflowCheckParameters(storyParameters)
    if (isDisabled(params)) return
    if (storyRoot == null) return

    throwIfNotEmpty(
      findOverflows(storyRoot, ignoreSelectorsOf(params)),
      'Story has element(s) overflowing their container (clipped and invisible)',
    )
  },
}
