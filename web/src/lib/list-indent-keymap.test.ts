import type { Node } from '@milkdown/kit/prose/model'
import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, TextSelection } from '@milkdown/kit/prose/state'
import { describe, expect, it } from 'vitest'

import { isAtListItemStart, isNestedListItem } from '#lib/list-indent-keymap'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
    },
    bullet_list: { content: 'list_item+', group: 'block' },
    list_item: { content: 'paragraph block*' },
    text: { group: 'inline' },
  },
  marks: {},
})
const listItemType = schema.nodes['list_item']

const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('solo')]),
  schema.node('bullet_list', null, [
    schema.node('list_item', null, [
      schema.node('paragraph', null, [schema.text('top')]),
      schema.node('bullet_list', null, [
        schema.node('list_item', null, [
          schema.node('paragraph', null, [schema.text('nested')]),
        ]),
      ]),
    ]),
  ]),
])

function posOf(root: Node, text: string): number {
  const matches: number[] = []
  root.descendants((node, pos) => {
    if (node.isText && node.text === text) matches.push(pos)
  })
  const found = matches[0]
  if (found == null) throw new Error(`text not found in doc: ${text}`)
  return found
}

function stateWithCursor(offset: number, endOffset = offset): EditorState {
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, offset, endOffset),
  })
}

describe('isAtListItemStart', () => {
  it("is true right before a top-level list item's text", () => {
    const state = stateWithCursor(posOf(doc, 'top'))
    expect(isAtListItemStart(state, listItemType)).toBe(true)
  })

  it("is true right before a nested list item's text", () => {
    const state = stateWithCursor(posOf(doc, 'nested'))
    expect(isAtListItemStart(state, listItemType)).toBe(true)
  })

  it('is false mid-text within a list item', () => {
    const state = stateWithCursor(posOf(doc, 'top') + 1)
    expect(isAtListItemStart(state, listItemType)).toBe(false)
  })

  it('is false at the start of a paragraph outside any list item', () => {
    const state = stateWithCursor(posOf(doc, 'solo'))
    expect(isAtListItemStart(state, listItemType)).toBe(false)
  })

  it('is false for a non-collapsed selection', () => {
    const start = posOf(doc, 'top')
    const state = stateWithCursor(start, start + 3)
    expect(isAtListItemStart(state, listItemType)).toBe(false)
  })
})

describe('isNestedListItem', () => {
  it('is false for a top-level list item', () => {
    const state = stateWithCursor(posOf(doc, 'top'))
    expect(isNestedListItem(state, listItemType)).toBe(false)
  })

  it('is true for a list item nested inside another list item', () => {
    const state = stateWithCursor(posOf(doc, 'nested'))
    expect(isNestedListItem(state, listItemType)).toBe(true)
  })
})
