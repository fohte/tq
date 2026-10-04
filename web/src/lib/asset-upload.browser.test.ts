import { beforeEach, describe, expect, it, vi } from 'vitest'

import videoFixtureAsset from '#components/ui/markdown-editor-video-fixture.webm?url'
import {
  handleAssetLoadError,
  resolveAssetDetails,
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

function signedAssetResponse(url: string, contentType = 'image/png') {
  return {
    ok: true,
    json: () => Promise.resolve({ url, contentType }),
  }
}

function videoFixtureUrl(version: string): string {
  return `${new URL(videoFixtureAsset, document.baseURI).href}#${version}`
}

describe('resolveAssetDetails', () => {
  it('resolves an asset path through the API', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue(
      signedAssetResponse('https://cdn.example.com/asset.png'),
    )

    const result = await resolveAssetDetails('/api/assets/asset-123')

    const getOutput = () => ({
      asset: result._unsafeUnwrap(),
      calls: mocks['mockGet']?.mock.calls,
    })
    expect(getOutput()).toEqual({
      asset: {
        url: 'https://cdn.example.com/asset.png',
        contentType: 'image/png',
      },
      calls: [[{ param: { id: 'asset-123' } }]],
    })
  })

  it('leaves the former image path unchanged', async () => {
    const mocks = await getMocks()

    const result = await resolveAssetDetails('/api/images/asset-123')

    const getOutput = () => ({
      asset: result._unsafeUnwrap(),
      calls: mocks['mockGet']?.mock.calls,
    })
    expect(getOutput()).toEqual({
      asset: { url: '/api/images/asset-123', contentType: null },
      calls: [],
    })
  })

  it('leaves external URLs unchanged', async () => {
    const mocks = await getMocks()

    const result = await resolveAssetDetails('https://example.com/foo.png')

    const getOutput = () => ({
      asset: result._unsafeUnwrap(),
      calls: mocks['mockGet']?.mock.calls,
    })
    expect(getOutput()).toEqual({
      asset: { url: 'https://example.com/foo.png', contentType: null },
      calls: [],
    })
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

  it('defers file size validation to the API', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost']).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'server-accepted' }),
    })

    const result = await uploadAssetFile(
      makeFile('big.png', 'image/png', 10 * 1024 * 1024 + 1),
    )

    expect(result._unsafeUnwrap()).toBe('/api/assets/server-accepted')
  })

  it('returns the API error when an upload is rejected', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockPost']).mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'File too large. Maximum size is 2048 bytes',
        }),
    })

    const result = await uploadAssetFile(makeFile('photo.png', 'image/png', 10))

    expect(result._unsafeUnwrapErr().message).toBe(
      'File too large. Maximum size is 2048 bytes',
    )
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
// each test below uses its own asset id rather than resetting the cache.
describe('resolveAssetSrc', () => {
  it('passes through URLs that are not /api/assets/:id paths', async () => {
    const mocks = await getMocks()

    const result = await resolveAssetSrc('https://example.com/foo.png')

    expect(result._unsafeUnwrap()).toBe('https://example.com/foo.png')
    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('fetches and caches the signed URL for a matching path', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet']).mockResolvedValue(
      signedAssetResponse('https://signed.example.com/a'),
    )

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
        .mockResolvedValueOnce(
          signedAssetResponse('https://signed.example.com/first'),
        )
        .mockResolvedValueOnce(
          signedAssetResponse('https://signed.example.com/second'),
        )

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
      'Failed to fetch signed asset URL',
    )
  })
})

function makeErrorEvent(target: EventTarget | null): Event {
  const event = new Event('error')
  Object.defineProperty(event, 'target', { value: target, configurable: true })
  return event
}

describe('handleAssetLoadError', () => {
  it('does nothing when the event target is neither an image nor video', async () => {
    const mocks = await getMocks()

    await handleAssetLoadError(makeErrorEvent(null))

    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('does nothing when the failed src was never resolved from an asset id', async () => {
    const mocks = await getMocks()
    const img = document.createElement('img')
    img.src = 'https://unrelated.example.com/x.png'

    await handleAssetLoadError(makeErrorEvent(img))

    expect(mocks['mockGet']).not.toHaveBeenCalled()
  })

  it('refreshes the signed URL and swaps the failed <img> src', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet'])
      .mockResolvedValueOnce(
        signedAssetResponse('https://signed.example.com/stale'),
      )
      .mockResolvedValueOnce(
        signedAssetResponse('https://signed.example.com/fresh'),
      )

    const resolved = await resolveAssetSrc('/api/assets/error-test')
    const img = document.createElement('img')
    img.src = resolved._unsafeUnwrap()

    await handleAssetLoadError(makeErrorEvent(img))

    expect(img.src).toBe('https://signed.example.com/fresh')
    expect(mocks['mockGet']).toHaveBeenCalledTimes(2)
  })

  it('refreshes a failed <video> URL and restores its playback position after metadata loads', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet'])
      .mockResolvedValueOnce(
        signedAssetResponse(videoFixtureUrl('video-stale'), 'video/webm'),
      )
      .mockResolvedValueOnce(
        signedAssetResponse(videoFixtureUrl('video-fresh'), 'video/webm'),
      )

    const resolved = await resolveAssetSrc('/api/assets/video-refresh-test')
    const video = document.createElement('video')
    video.src = resolved._unsafeUnwrap()
    let currentTime = 37
    const currentTimeWrites = vi.fn((time: number) => {
      currentTime = time
    })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: currentTimeWrites,
    })

    await handleAssetLoadError(makeErrorEvent(video))
    video.dispatchEvent(new Event('loadedmetadata'))

    const actual = () => ({
      src: video.src,
      currentTime,
      currentTimeWrites: currentTimeWrites.mock.calls,
      requestCount: mocks['mockGet']?.mock.calls.length,
    })

    expect(actual()).toEqual({
      src: videoFixtureUrl('video-fresh'),
      currentTime: 37,
      currentTimeWrites: [[37]],
      requestCount: 2,
    })
  })

  it('does not refresh a video again during the per-element cooldown', async () => {
    const mocks = await getMocks()
    assertDefined(mocks['mockGet'])
      .mockResolvedValueOnce(
        signedAssetResponse(videoFixtureUrl('cooldown-stale'), 'video/webm'),
      )
      .mockResolvedValueOnce(
        signedAssetResponse(videoFixtureUrl('cooldown-fresh'), 'video/webm'),
      )
      .mockResolvedValueOnce(
        signedAssetResponse(videoFixtureUrl('cooldown-newer'), 'video/webm'),
      )

    const resolved = await resolveAssetSrc('/api/assets/video-cooldown-test')
    const video = document.createElement('video')
    video.src = resolved._unsafeUnwrap()

    await handleAssetLoadError(makeErrorEvent(video))
    await handleAssetLoadError(makeErrorEvent(video))

    const actual = () => ({
      src: video.src,
      requestCount: mocks['mockGet']?.mock.calls.length,
    })

    expect(actual()).toEqual({
      src: videoFixtureUrl('cooldown-fresh'),
      requestCount: 2,
    })
  })

  it('keeps stale URLs usable by other media nodes until the signed URL expires', async () => {
    vi.useFakeTimers()
    try {
      const mocks = await getMocks()
      assertDefined(mocks['mockGet'])
        .mockResolvedValueOnce(
          signedAssetResponse('https://signed.example.com/shared-stale'),
        )
        .mockResolvedValueOnce(
          signedAssetResponse('https://signed.example.com/shared-fresh'),
        )
        .mockResolvedValueOnce(
          signedAssetResponse('https://signed.example.com/shared-peer-fresh'),
        )

      const resolved = await resolveAssetSrc('/api/assets/shared-media-test')
      const firstImage = document.createElement('img')
      const peerImage = document.createElement('img')
      firstImage.src = resolved._unsafeUnwrap()
      peerImage.src = resolved._unsafeUnwrap()

      await handleAssetLoadError(makeErrorEvent(firstImage))
      await handleAssetLoadError(makeErrorEvent(peerImage))

      const expiredImage = document.createElement('img')
      expiredImage.src = resolved._unsafeUnwrap()
      vi.advanceTimersByTime(60 * 60 * 1000)
      await handleAssetLoadError(makeErrorEvent(expiredImage))

      const actual = () => ({
        firstImageSrc: firstImage.src,
        peerImageSrc: peerImage.src,
        expiredImageSrc: expiredImage.src,
        requestCount: mocks['mockGet']?.mock.calls.length,
      })

      expect(actual()).toEqual({
        firstImageSrc: 'https://signed.example.com/shared-fresh',
        peerImageSrc: 'https://signed.example.com/shared-peer-fresh',
        expiredImageSrc: 'https://signed.example.com/shared-stale',
        requestCount: 3,
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
