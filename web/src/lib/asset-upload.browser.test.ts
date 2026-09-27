import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AssetTooLargeError,
  handleAssetLoadError,
  parseAssetId,
  resolveAssetSrc,
  UnsupportedAssetTypeError,
  uploadAssetFile,
  uploadAssetFiles,
} from '#lib/asset-upload'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => {
  const mockPost = vi.fn()
  const mockGet = vi.fn()

  return {
    api: {
      api: {
        assets: {
          $post: mockPost,
          ':id': { $get: mockGet },
        },
      },
    },
    __mocks: { mockPost, mockGet },
  }
})

async function getMocks() {
  const mod = await import('#lib/api')
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

describe('parseAssetId', () => {
  it('extracts the id from an /api/assets/:id path', () => {
    expect(parseAssetId('/api/assets/abc-123')).toBe('abc-123')
  })

  it('does not extract ids from the former image path', () => {
    expect(parseAssetId('/api/images/abc-123')).toBeNull()
  })

  it('returns null for URLs that do not match the pattern', () => {
    expect(parseAssetId('https://example.com/foo.png')).toBeNull()
  })
})

describe('uploadAssetFile', () => {
  it('uploads the file and returns the markdown-embeddable path', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'new-id' }),
    })

    const result = await uploadAssetFile(makeFile('photo.png', 'image/png', 10))

    expect(result._unsafeUnwrap()).toBe('/api/assets/new-id')
  })

  it('rejects unsupported file types without calling the API', async () => {
    const mocks = await getMocks()

    const result = await uploadAssetFile(
      makeFile('doc.pdf', 'application/pdf', 10),
    )

    expect(result._unsafeUnwrapErr()).toEqual(new UnsupportedAssetTypeError())
    expect(mocks['mockPost']).not.toHaveBeenCalled()
  })

  it('rejects files exceeding the size limit without calling the API', async () => {
    const mocks = await getMocks()

    const result = await uploadAssetFile(
      makeFile('big.png', 'image/png', 10 * 1024 * 1024 + 1),
    )

    expect(result._unsafeUnwrapErr()).toEqual(new AssetTooLargeError())
    expect(mocks['mockPost']).not.toHaveBeenCalled()
  })

  it('fails when the upload request fails', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost']).mockResolvedValue({ ok: false })

    const result = await uploadAssetFile(makeFile('photo.png', 'image/png', 10))

    expect(result._unsafeUnwrapErr().message).toBe('Failed to upload image')
  })
})

describe('uploadAssetFiles', () => {
  function fileList(...files: File[]): FileList {
    // jsdom has no real DataTransfer/FileList constructor; uploadAssetFiles
    // only calls Array.from(files), so a plain array satisfies it at runtime.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only array-like stand-in for FileList
    return files as unknown as FileList
  }

  it('uploads every file in parallel and builds a node per success', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost'])
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'id-a' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'id-b' }),
      })

    const nodes = await uploadAssetFiles(
      fileList(
        makeFile('a.png', 'image/png', 10),
        makeFile('b.png', 'image/png', 10),
      ),
      (src, alt) => ({ src, alt }),
    )

    expect(nodes).toEqual([
      { src: '/api/assets/id-a', alt: 'a.png' },
      { src: '/api/assets/id-b', alt: 'b.png' },
    ])
  })

  it('skips files that fail to upload without failing the whole batch', async () => {
    const mocks = await getMocks()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    assertDefined(mocks['mockPost'])
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'id-b' }),
      })

    const nodes = await uploadAssetFiles(
      fileList(
        makeFile('a.png', 'image/png', 10),
        makeFile('b.png', 'image/png', 10),
      ),
      (src, alt) => ({ src, alt }),
    )

    expect(nodes).toEqual([{ src: '/api/assets/id-b', alt: 'b.png' }])
    expect(consoleError).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })
})

// resolveAssetSrc/handleAssetLoadError share module-level cache state, so
// each test below uses its own image id rather than resetting the cache.
describe('resolveAssetSrc', () => {
  it('passes through URLs that are not /api/assets/:id paths', async () => {
    const mocks = await getMocks()

    const result = await resolveAssetSrc('https://example.com/foo.png')

    expect(result._unsafeUnwrap()).toBe('https://example.com/foo.png')
    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('fetches and caches the signed URL for a matching path', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://signed.example.com/a' }),
    })

    const first = await resolveAssetSrc('/api/assets/cache-test-1')
    const second = await resolveAssetSrc('/api/assets/cache-test-1')

    expect(first._unsafeUnwrap()).toBe('https://signed.example.com/a')
    expect(second._unsafeUnwrap()).toBe('https://signed.example.com/a')
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

      const first = await resolveAssetSrc('/api/assets/cache-test-2')
      vi.advanceTimersByTime(56 * 60 * 1000)
      const second = await resolveAssetSrc('/api/assets/cache-test-2')

      expect(first._unsafeUnwrap()).toBe('https://signed.example.com/first')
      expect(second._unsafeUnwrap()).toBe('https://signed.example.com/second')
      expect(mocks['mockGet']).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails when the signed URL request fails', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue({ ok: false })

    const result = await resolveAssetSrc('/api/assets/cache-test-3')

    expect(result._unsafeUnwrapErr().message).toBe(
      'Failed to fetch signed image URL',
    )
  })
})

function makeErrorEvent(target: EventTarget | null): Event {
  const event = new Event('error')
  Object.defineProperty(event, 'target', { value: target, configurable: true })
  return event
}

describe('handleAssetLoadError', () => {
  it('does nothing when the event target is not an image element', async () => {
    const mocks = await getMocks()

    await handleAssetLoadError(makeErrorEvent(null))

    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('does nothing when the failed src was never resolved from an image id', async () => {
    const mocks = await getMocks()
    const img = document.createElement('img')
    img.src = 'https://unrelated.example.com/x.png'

    await handleAssetLoadError(makeErrorEvent(img))

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

    const resolved = await resolveAssetSrc('/api/assets/error-test')
    const img = document.createElement('img')
    img.src = resolved._unsafeUnwrap()

    await handleAssetLoadError(makeErrorEvent(img))

    expect(img.src).toBe('https://signed.example.com/fresh')
    expect(mocks['mockGet']).toHaveBeenCalledTimes(2)
  })
})
