import type { ComponentType } from 'react'

export interface InlineReferenceMatch<TData> {
  /** Start offset within the textblock's flattened text, inclusive. */
  start: number
  /** End offset within the textblock's flattened text, exclusive. */
  end: number
  raw: string
  data: TData
}

// A provider bundles everything needed to turn one kind of inline text
// pattern (e.g. `#123` task mentions) into a live-preview chip: detecting it,
// resolving its metadata, and rendering it.
export interface InlineReferenceProvider<TData> {
  /** Namespaces the ProseMirror plugin key and widget decoration keys. */
  id: string
  /** Finds every match within a single textblock's flattened text. */
  findMatches: (text: string) => Array<InlineReferenceMatch<TData>>
  /** True only when `data`'s metadata is already resolved and can be rendered synchronously. */
  isReady: (data: TData) => boolean
  /** Fire-and-forget: starts loading `data`'s metadata if not already loading or loaded. */
  ensureLoaded: (data: TData) => void
  /** Subscribes to metadata changes; the plugin calls `notify` to redraw. Returns an unsubscribe function. */
  subscribe: (notify: () => void) => () => void
  /** Renders the chip that replaces the raw text once `isReady(data)` is true. */
  Chip: ComponentType<{ data: TData }>
}
