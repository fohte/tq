import { Schema } from '@milkdown/kit/prose/model'
import { EditorState, TextSelection } from '@milkdown/kit/prose/state'
import { describe, expect, it } from 'vitest'

import { findActiveMentionQuery } from '#lib/inline-reference/providers/task-mention-autocomplete-query'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
  },
  marks: {},
})

function stateWithCursorAtEnd(text: string) {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text(text)]),
  ])
  return EditorState.create({
    doc,
    schema,
    selection: TextSelection.create(doc, 1 + text.length),
  })
}

describe('findActiveMentionQuery', () => {
  it('detects an empty query right after typing #', () => {
    expect(findActiveMentionQuery(stateWithCursorAtEnd('hello #'))).toEqual({
      from: 7,
      to: 8,
      query: '',
    })
  })

  it('detects a numeric query', () => {
    expect(findActiveMentionQuery(stateWithCursorAtEnd('hello #12'))).toEqual({
      from: 7,
      to: 10,
      query: '12',
    })
  })

  it('detects a title-text query', () => {
    expect(findActiveMentionQuery(stateWithCursorAtEnd('#dep'))).toEqual({
      from: 1,
      to: 5,
      query: 'dep',
    })
  })

  it('stops matching once a space ends the mention', () => {
    expect(
      findActiveMentionQuery(stateWithCursorAtEnd('hello #12 wor')),
    ).toBeUndefined()
  })

  it('returns undefined when there is no #', () => {
    expect(
      findActiveMentionQuery(stateWithCursorAtEnd('hello world')),
    ).toBeUndefined()
  })

  it('ignores a hash directly preceded by a word character', () => {
    expect(
      findActiveMentionQuery(stateWithCursorAtEnd('color#123')),
    ).toBeUndefined()
  })

  it('ignores a hash preceded by another hash', () => {
    expect(
      findActiveMentionQuery(stateWithCursorAtEnd('##123')),
    ).toBeUndefined()
  })

  it('ignores a hash directly preceded by a slash (URL fragment)', () => {
    expect(
      findActiveMentionQuery(stateWithCursorAtEnd('a/#foo')),
    ).toBeUndefined()
  })

  it('returns undefined when the selection is not collapsed', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello #12')]),
    ])
    const state = EditorState.create({
      doc,
      schema,
      selection: TextSelection.create(doc, 1, 3),
    })
    expect(findActiveMentionQuery(state)).toBeUndefined()
  })
})
