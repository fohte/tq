import { describe, expect, it } from 'vitest'

import {
  imageAttrsToText,
  imageBlockAttrsToText,
  textToImageAttrs,
  textToImageBlockAttrs,
} from '#lib/image-source-reveal/markdown'

describe('imageAttrsToText', () => {
  it('formats src and alt without a title', () => {
    expect(
      imageAttrsToText({
        src: 'https://example.com/a.png',
        alt: 'a cat',
        title: '',
      }),
    ).toBe('![a cat](https://example.com/a.png)')
  })

  it('formats src, alt, and title', () => {
    expect(
      imageAttrsToText({
        src: 'https://example.com/a.png',
        alt: 'a cat',
        title: 'my cat',
      }),
    ).toBe('![a cat](https://example.com/a.png "my cat")')
  })
})

describe('imageBlockAttrsToText', () => {
  it('formats the ratio as a 2-decimal alt slot', () => {
    expect(
      imageBlockAttrsToText({
        src: 'https://example.com/a.png',
        caption: '',
        ratio: 1,
      }),
    ).toBe('![1.00](https://example.com/a.png)')
  })

  it('includes the caption as the title', () => {
    expect(
      imageBlockAttrsToText({
        src: 'https://example.com/a.png',
        caption: 'my cat',
        ratio: 0.85,
      }),
    ).toBe('![0.85](https://example.com/a.png "my cat")')
  })
})

describe('textToImageAttrs', () => {
  it('parses src and alt without a title', () => {
    expect(textToImageAttrs('![a cat](https://example.com/a.png)')).toEqual({
      src: 'https://example.com/a.png',
      alt: 'a cat',
      title: '',
    })
  })

  it('parses src, alt, and title', () => {
    expect(
      textToImageAttrs('![a cat](https://example.com/a.png "my cat")'),
    ).toEqual({
      src: 'https://example.com/a.png',
      alt: 'a cat',
      title: 'my cat',
    })
  })

  it('round-trips through imageAttrsToText', () => {
    const attrs = {
      src: 'https://example.com/a.png',
      alt: 'a cat',
      title: 'my cat',
    }
    expect(textToImageAttrs(imageAttrsToText(attrs))).toEqual(attrs)
  })

  it('returns null for text that is not image markdown', () => {
    expect(textToImageAttrs('not an image')).toBeNull()
  })
})

describe('textToImageBlockAttrs', () => {
  it('parses the alt slot as the ratio', () => {
    expect(
      textToImageBlockAttrs('![0.85](https://example.com/a.png "my cat")'),
    ).toEqual({
      src: 'https://example.com/a.png',
      caption: 'my cat',
      ratio: 0.85,
    })
  })

  it('falls back to ratio 1 when the alt slot is not a number', () => {
    expect(
      textToImageBlockAttrs('![a cat](https://example.com/a.png)'),
    ).toEqual({ src: 'https://example.com/a.png', caption: '', ratio: 1 })
  })

  it('falls back to ratio 1 when the alt slot is zero', () => {
    expect(textToImageBlockAttrs('![0](https://example.com/a.png)')).toEqual({
      src: 'https://example.com/a.png',
      caption: '',
      ratio: 1,
    })
  })

  it('round-trips through imageBlockAttrsToText', () => {
    const attrs = {
      src: 'https://example.com/a.png',
      caption: 'my cat',
      ratio: 0.85,
    }
    expect(textToImageBlockAttrs(imageBlockAttrsToText(attrs))).toEqual(attrs)
  })

  it('returns null for text that is not image markdown', () => {
    expect(textToImageBlockAttrs('not an image')).toBeNull()
  })
})
