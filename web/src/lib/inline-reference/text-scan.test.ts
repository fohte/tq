import { Schema } from '@milkdown/kit/prose/model'
import { describe, expect, it } from 'vitest'

import { collectTextBlockRuns } from '#lib/inline-reference/text-scan'
import { assertDefined, atIndex } from '#lib/test-utils'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline' },
  },
  marks: {},
})

function describeRun(run: ReturnType<typeof collectTextBlockRuns>[number]) {
  return {
    text: run.text,
    offsets: Array.from({ length: run.text.length + 1 }, (_, i) =>
      run.posAt(i),
    ),
    nodeType: run.nodeType,
  }
}

describe('collectTextBlockRuns', () => {
  it('maps a single textblock to 1:1 doc positions', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello #123 world')]),
    ])

    const runs = collectTextBlockRuns(doc)

    expect(runs).toHaveLength(1)
    const actual = describeRun(atIndex(runs, 0))
    const expected = {
      text: 'hello #123 world',
      offsets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      nodeType: 'paragraph',
    }
    expect(actual).toEqual(expected)
  })

  it('produces one independent run per textblock', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('first')]),
      schema.node('paragraph', null, [schema.text('second')]),
    ])

    const runs = collectTextBlockRuns(doc)

    expect(runs.map((r) => r.text)).toEqual(['first', 'second'])
  })

  it('reserves a 1-char placeholder for non-text inline leaves so offsets stay 1:1', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('a'),
        assertDefined(schema.nodes['hard_break']).create(),
        schema.text('b'),
      ]),
    ])

    const runs = collectTextBlockRuns(doc)

    const actual = describeRun(atIndex(runs, 0))
    const expected = {
      text: 'a￼b',
      offsets: [1, 2, 3, 4],
      nodeType: 'paragraph',
    }
    expect(actual).toEqual(expected)
  })

  it('reports the textblock node type for a non-paragraph textblock', () => {
    const headingSchema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: { content: 'inline*', group: 'block' },
        heading: { content: 'inline*', group: 'block' },
        text: { group: 'inline' },
      },
      marks: {},
    })
    const doc = headingSchema.node('doc', null, [
      headingSchema.node('heading', null, [headingSchema.text('title')]),
    ])

    const runs = collectTextBlockRuns(doc)

    expect(runs).toHaveLength(1)
    const actual = describeRun(atIndex(runs, 0))
    const expected = {
      text: 'title',
      offsets: [1, 2, 3, 4, 5, 6],
      nodeType: 'heading',
    }
    expect(actual).toEqual(expected)
  })
})
