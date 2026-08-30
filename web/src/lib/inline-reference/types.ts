import type { ComponentType } from 'react'

interface InlineReferenceMatch<TData> {
  /** Start offset within the textblock's flattened text, inclusive. */
  start: number
  /** End offset within the textblock's flattened text, exclusive. */
  end: number
  raw: string
  data: TData
}

// A provider bundles everything needed to turn one kind of inline text
// pattern (e.g. `#123` task mentions) into a live-preview chip: detecting it
// and rendering it. Resolving the match's metadata is the Chip's own
// responsibility (it renders `raw` as a fallback until its data loads).
export interface InlineReferenceProvider<TData> {
  /** Namespaces the ProseMirror plugin key and widget decoration keys. */
  id: string
  /** Finds every match within a single textblock's flattened text. */
  findMatches: (text: string) => Array<InlineReferenceMatch<TData>>
  /** Renders the chip that replaces the raw text; falls back to rendering `raw` while its data is unresolved. */
  Chip: ComponentType<{ data: TData; raw: string }>
  /** Renders the block-level card that replaces the whole paragraph when it consists of exactly one reference and nothing else; falls back to rendering `raw` while its data is unresolved (see the paragraph-is-a-single-reference rule in plugin.tsx). */
  Card: ComponentType<{ data: TData; raw: string }>
}
