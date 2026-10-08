import { Button } from '@fohte/ui/button'
import { Pencil } from 'lucide-react'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { ReactNode } from 'react'

import { findInlineReferenceMatches } from '#lib/inline-reference/providers/index'
import { cn } from '#lib/utils'

interface MarkdownNode {
  type: string
  value: string | undefined
  url: string | undefined
  alt: string | undefined
  children: MarkdownNode[]
}

interface RenderedSegment {
  kind: 'text' | 'interactive'
  key: string
  node: ReactNode
}

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function normalizeNode(value: unknown): MarkdownNode | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    typeof value.type !== 'string'
  )
    return undefined

  const children =
    'children' in value && Array.isArray(value.children)
      ? value.children
          .map(normalizeNode)
          .filter((child): child is MarkdownNode => child != null)
      : []

  return {
    type: value.type,
    value:
      'value' in value && typeof value.value === 'string'
        ? value.value
        : undefined,
    url:
      'url' in value && typeof value.url === 'string' ? value.url : undefined,
    alt:
      'alt' in value && typeof value.alt === 'string' ? value.alt : undefined,
    children,
  }
}

function plainText(nodes: MarkdownNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'inlineCode')
        return node.value ?? ''
      if (node.type === 'image') return node.alt ?? ''
      return plainText(node.children)
    })
    .join('')
}

function safeHref(href: string): string | undefined {
  const protocol = /^[a-z][a-z\d+.-]*:/i.exec(href)?.[0].toLowerCase()
  return protocol == null || SAFE_LINK_PROTOCOLS.has(protocol)
    ? href
    : undefined
}

function wrapNode(
  node: MarkdownNode,
  content: ReactNode,
  key: string,
): ReactNode {
  switch (node.type) {
    case 'emphasis':
      return <em key={key}>{content}</em>
    case 'strong':
      return <strong key={key}>{content}</strong>
    case 'delete':
      return <del key={key}>{content}</del>
    default:
      return content
  }
}

function renderLeafNode(
  node: MarkdownNode,
  key: string,
): ReactNode | undefined {
  switch (node.type) {
    case 'text':
    case 'html':
      return node.value ?? ''
    case 'inlineCode':
      return (
        <code key={key} className="rounded-sm bg-muted px-1 py-0.5 text-xs">
          {node.value}
        </code>
      )
    case 'break':
      return <br key={key} />
    case 'image':
      return node.alt ?? ''
    default:
      return undefined
  }
}

function renderSimpleNodes(
  nodes: MarkdownNode[],
  keyPrefix: string,
): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}:${node.type}:${String(index)}`
    const leaf = renderLeafNode(node, key)
    if (leaf !== undefined) return leaf

    const children = renderSimpleNodes(node.children, key)
    if (
      node.type === 'emphasis' ||
      node.type === 'strong' ||
      node.type === 'delete'
    )
      return wrapNode(node, children, key)

    return children.length > 0 ? <span key={key}>{children}</span> : ''
  })
}

function renderChip(chip: ReactNode): ReactNode {
  return (
    <span className="inline-reference-chip inline-flex select-none align-middle">
      {chip}
    </span>
  )
}

function renderInlineNodes(
  nodes: MarkdownNode[],
  keyPrefix: string,
): RenderedSegment[] {
  const segments: RenderedSegment[] = []
  let textNodes: ReactNode[] = []

  const flushText = () => {
    if (textNodes.length === 0) return
    segments.push({
      kind: 'text',
      key: `${keyPrefix}:text:${String(segments.length)}`,
      node: <>{textNodes}</>,
    })
    textNodes = []
  }

  const addInteractive = (node: ReactNode, key: string) => {
    flushText()
    segments.push({ kind: 'interactive', key, node })
  }

  nodes.forEach((node, index) => {
    const key = `${keyPrefix}:${node.type}:${String(index)}`

    if (node.type === 'text') {
      const text = node.value ?? ''
      let cursor = 0
      for (const match of findInlineReferenceMatches(text)) {
        if (
          match.start < cursor ||
          match.end <= match.start ||
          match.end > text.length
        )
          continue
        if (match.start > cursor)
          textNodes.push(text.slice(cursor, match.start))
        addInteractive(renderChip(match.chip), `${key}:${match.key}`)
        cursor = match.end
      }
      if (cursor < text.length) textNodes.push(text.slice(cursor))
      return
    }

    if (node.type === 'link') {
      const href = node.url
      if (href == null) {
        textNodes.push(...renderSimpleNodes(node.children, key))
        return
      }

      const label = plainText(node.children)
      const reference = findInlineReferenceMatches(
        href,
        label || undefined,
      ).find((match) => match.start === 0 && match.end === href.length)
      if (reference != null) {
        addInteractive(renderChip(reference.chip), `${key}:${reference.key}`)
        return
      }

      const safeUrl = safeHref(href)
      if (safeUrl == null) {
        textNodes.push(...renderSimpleNodes(node.children, key))
        return
      }

      addInteractive(
        <a className="text-current underline underline-offset-2" href={safeUrl}>
          {renderSimpleNodes(node.children, key)}
        </a>,
        key,
      )
      return
    }

    if (
      node.type === 'emphasis' ||
      node.type === 'strong' ||
      node.type === 'delete'
    ) {
      for (const child of renderInlineNodes(node.children, key)) {
        const wrapped = wrapNode(node, child.node, `${key}:${child.key}`)
        if (child.kind === 'text') textNodes.push(wrapped)
        else addInteractive(wrapped, child.key)
      }
      return
    }

    const leaf = renderLeafNode(node, key)
    if (leaf !== undefined) {
      textNodes.push(leaf)
      return
    }

    textNodes.push(...renderSimpleNodes(node.children, key))
  })

  flushText()
  return segments
}

export function renderChecklistItemMarkdown({
  content,
  checked,
  bold,
  onEdit,
}: {
  content: string
  checked: boolean
  bold: boolean
  onEdit: () => void
}): ReactNode {
  // A punctuation prefix keeps the parser in a paragraph for input such as `1. step`;
  // checklist content supports inline Markdown, not block-level Markdown.
  const paragraph = fromMarkdown(`!${content}`).children[0]
  const parsedNodes =
    paragraph?.type === 'paragraph'
      ? paragraph.children
          .map(normalizeNode)
          .filter((node): node is MarkdownNode => node != null)
      : []
  const [firstNode, ...remainingNodes] = parsedNodes
  const nodes =
    firstNode?.type === 'text' && firstNode.value?.startsWith('!') === true
      ? [{ ...firstNode, value: firstNode.value.slice(1) }, ...remainingNodes]
      : parsedNodes
  const segments = renderInlineNodes(nodes, 'checklist-item')
  const hasEditableText = segments.some((segment) => segment.kind === 'text')

  return (
    <span
      className={cn(
        'block truncate font-mono text-xs',
        checked ? 'text-muted-foreground line-through' : 'text-foreground',
        bold && 'font-semibold',
      )}
    >
      {segments.map((segment) =>
        segment.kind === 'text' ? (
          <Button
            key={segment.key}
            type="button"
            variant="ghost"
            onClick={onEdit}
            className={cn(
              'inline h-auto min-h-0 justify-start overflow-hidden rounded-none border-0 bg-transparent p-0 text-left font-mono text-xs shadow-none transition-none hover:bg-transparent active:translate-y-0',
              bold ? 'font-semibold' : 'font-normal',
              checked ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {segment.node}
          </Button>
        ) : (
          <span key={segment.key}>{segment.node}</span>
        ),
      )}
      {!hasEditableText && (
        <Button
          key="checklist-item:edit"
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Edit ${content}`}
          onClick={onEdit}
          className="ml-1 inline-flex align-middle text-muted-foreground"
        >
          <Pencil className="size-3" />
        </Button>
      )}
    </span>
  )
}
