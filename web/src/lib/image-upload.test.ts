import {
  handleImageLoadError,
  parseImageId,
  resolveImageSrc,
  uploadImageFile,
} from '@web/lib/image-upload'
import { assertDefined } from '@web/lib/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@web/lib/api', () => {
  const mockPost = vi.fn()
  const mockGet = vi.fn()

  return {
    api: {
      api: {
        images: {
          $post: mockPost,
          ':id': { $get: mockGet },
        },
      },
    },
    __mocks: { mockPost, mockGet },
  }
})

async function getMocks() {
  const mod = await import('@web/lib/api')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- accessing test-only __mocks property injected by vi.mock
  const typed = mod as unknown as {
    __mocks: Record<string, ReturnType<typeof vi.fn>>
  }
  return typed.__mocks
}

beforeEach(async () => {
  const mocks = await getMocks()
  for (const mock of Object.values(mocks)) {
    mock.mockReset()
  }
})

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('parseImageId', () => {
  it('extracts the id from an /api/images/:id path', () => {
    expect(parseImageId('/api/images/abc-123')).toBe('abc-123')
  })

  it('returns null for URLs that do not match the pattern', () => {
    expect(parseImageId('https://example.com/foo.png')).toBeNull()
  })
})

describe('uploadImageFile', () => {
  it('uploads the file and returns the markdown-embeddable path', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'new-id' }),
    })

    const path = await uploadImageFile(makeFile('photo.png', 'image/png', 10))

    expect(path).toBe('/api/images/new-id')
  })

  it('rejects unsupported file types without calling the API', async () => {
    const mocks = await getMocks()

    await expect(
      uploadImageFile(makeFile('doc.pdf', 'application/pdf', 10)),
    ).rejects.toThrow('Unsupported image type')
    expect(mocks['mockPost']).not.toHaveBeenCalled()
  })

  it('rejects files exceeding the size limit without calling the API', async () => {
    const mocks = await getMocks()

    await expect(
      uploadImageFile(makeFile('big.png', 'image/png', 10 * 1024 * 1024 + 1)),
    ).rejects.toThrow('Image too large')
    expect(mocks['mockPost']).not.toHaveBeenCalled()
  })

  it('throws when the upload request fails', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost']).mockResolvedValue({ ok: false })

    await expect(
      uploadImageFile(makeFile('photo.png', 'image/png', 10)),
    ).rejects.toThrow('Failed to upload image')
  })
})

describe('resolveImageSrc', () => {
  it('passes through URLs that are not /api/images/:id paths', async () => {
    const mocks = await getMocks()

    const result = await resolveImageSrc('https://example.com/foo.png')

    expect(result).toBe('https://example.com/foo.png')
    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('fetches and caches the signed URL for a matching path', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://signed.example.com/a' }),
    })

    const first = await resolveImageSrc('/api/images/cache-test-1')
    const second = await resolveImageSrc('/api/images/cache-test-1')

    expect(first).toBe('https://signed.example.com/a')
    expect(second).toBe('https://signed.example.com/a')
    expect(mocks['mockGet']).toHaveBeenCalledTimes(1)
  })

  it('refetches once the cached signed URL is close to expiry', async () => {
    vi.useFakeTimers()
    try {
      const mocks = await getMocks()
      assertDefined(mocks['mockGet'])
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ url: 'https://signed.example.com/first' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ url: 'https://signed.example.com/second' }),
        })

      const first = await resolveImageSrc('/api/images/cache-test-2')
      vi.advanceTimersByTime(56 * 60 * 1000)
      const second = await resolveImageSrc('/api/images/cache-test-2')

      expect(first).toBe('https://signed.example.com/first')
      expect(second).toBe('https://signed.example.com/second')
      expect(mocks['mockGet']).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('throws when the signed URL request fails', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({ ok: false })

    await expect(resolveImageSrc('/api/images/cache-test-3')).rejects.toThrow(
      'Failed to fetch signed image URL',
    )
  })
})

function makeErrorEvent(target: EventTarget | null): Event {
  const event = new Event('error')
  Object.defineProperty(event, 'target', { value: target, configurable: true })
  return event
}

describe('handleImageLoadError', () => {
  it('does nothing when the event target is not an image element', async () => {
    const mocks = await getMocks()

    await handleImageLoadError(makeErrorEvent(null))

    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('does nothing when the failed src was never resolved from an image id', async () => {
    const mocks = await getMocks()
    const img = document.createElement('img')
    img.src = 'https://unrelated.example.com/x.png'

    await handleImageLoadError(makeErrorEvent(img))

    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('refreshes the signed URL and swaps the failed <img> src', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet'])
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ url: 'https://signed.example.com/stale' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ url: 'https://signed.example.com/fresh' }),
      })

    const resolved = await resolveImageSrc('/api/images/error-test')
    const img = document.createElement('img')
    img.src = resolved

    await handleImageLoadError(makeErrorEvent(img))

    expect(img.src).toBe('https://signed.example.com/fresh')
    expect(mocks['mockGet']).toHaveBeenCalledTimes(2)
  })
})
