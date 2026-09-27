import { ALLOWED_CONTENT_TYPES } from 'api/constants/assets'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { api } from '#lib/api'

const ASSET_PATH_PATTERN = /^\/api\/assets\/([^/]+)$/

export function parseAssetId(src: string): string | null {
  return ASSET_PATH_PATTERN.exec(src)?.[1] ?? null
}

export const ASSET_FILE_ACCEPT = [
  'image/*',
  ...ALLOWED_CONTENT_TYPES.filter((contentType) =>
    contentType.startsWith('video/'),
  ),
].join(',')

// Refresh signed URLs before the server-issued 1-hour expiry actually lapses.
const SIGNED_URL_CACHE_TTL_MS = 55 * 60 * 1000

export class UnsupportedAssetTypeError extends Error {
  constructor() {
    super(
      `Unsupported asset type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    )
    this.name = 'UnsupportedAssetTypeError'
  }
}

function readApiErrorMessage(body: unknown): string | null {
  if (
    typeof body !== 'object' ||
    body == null ||
    !('error' in body) ||
    typeof body.error !== 'string'
  ) {
    return null
  }
  return body.error
}

export function uploadAssetFile(
  file: File,
): ResultAsync<string, UnsupportedAssetTypeError | Error> {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return errAsync(new UnsupportedAssetTypeError())
  }
  return ResultAsync.fromPromise(
    api.api.assets.$post({ form: { file } }),
    (cause) => new Error('Failed to upload asset', { cause }),
  ).andThen((res) => {
    if (!res.ok) {
      return ResultAsync.fromPromise(
        res.json(),
        (cause) => new Error('Failed to upload asset', { cause }),
      ).andThen((body) => {
        const errorMessage = readApiErrorMessage(body)
        if (errorMessage != null) return errAsync(new Error(errorMessage))
        return errAsync(
          new Error(`Failed to upload asset (status ${String(res.status)})`),
        )
      })
    }
    return ResultAsync.fromPromise(
      res.json(),
      (cause) => new Error('Failed to upload asset', { cause }),
    ).map(({ id }) => `/api/assets/${id}`)
  })
}

/**
 * Upload every file in a paste/drop FileList in parallel, converting each
 * successful upload into an editor node via `createNode`. Failed uploads are
 * logged and skipped rather than failing the whole batch. Generic over the
 * node type so this module doesn't need to depend on ProseMirror/Milkdown's
 * internal types.
 */
export async function uploadAssetFiles<T>(
  files: FileList,
  createNode: (src: string, alt: string) => T | null | undefined,
): Promise<T[]> {
  const results = await Promise.allSettled(
    Array.from(files).map(async (file) => ({
      file,
      result: await uploadAssetFile(file),
    })),
  )

  const nodes: T[] = []
  for (const settled of results) {
    if (settled.status === 'rejected') {
      console.error('Failed to upload pasted/dropped asset', settled.reason)
      continue
    }
    const { file, result } = settled.value
    if (result.isErr()) {
      console.error('Failed to upload pasted/dropped asset', result.error)
      continue
    }
    const node = createNode(result.value, file.name)
    if (node != null) nodes.push(node)
  }
  return nodes
}

interface CacheEntry {
  asset: ResolvedAsset
  expiresAt: number
}

export interface ResolvedAsset {
  url: string
  contentType: string | null
}

const cacheById = new Map<string, CacheEntry>()
const pendingById = new Map<string, ResultAsync<ResolvedAsset, Error>>()
// Reverse lookup so a failed media load (which only exposes the resolved
// signed URL, not the original /api/assets/:id path) can find its asset id.
const idBySignedUrl = new Map<string, string>()

function getAssetDetails(id: string): ResultAsync<ResolvedAsset, Error> {
  const cached = cacheById.get(id)
  if (cached && cached.expiresAt > Date.now()) {
    return okAsync(cached.asset)
  }

  const pending = pendingById.get(id)
  if (pending) return pending

  const result = ResultAsync.fromPromise(
    api.api.assets[':id'].$get({ param: { id } }),
    (cause) => new Error('Failed to fetch signed asset URL', { cause }),
  ).andThen((res) => {
    if (!res.ok) return errAsync(new Error('Failed to fetch signed asset URL'))
    return ResultAsync.fromPromise(
      res.json(),
      (cause) => new Error('Failed to fetch signed asset URL', { cause }),
    ).map(({ url, contentType }) => {
      const asset = { url, contentType }
      cacheById.set(id, {
        asset,
        expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
      })
      idBySignedUrl.set(url, id)
      return asset
    })
  })
  pendingById.set(id, result)
  void result.then(() => pendingById.delete(id))
  return result
}

export function resolveAssetDetails(
  src: string,
): ResultAsync<ResolvedAsset, Error> {
  const id = parseAssetId(src)
  if (id == null) return okAsync({ url: src, contentType: null })

  return getAssetDetails(id)
}

export function resolveAssetSrc(src: string): ResultAsync<string, Error> {
  return resolveAssetDetails(src).map(({ url }) => url)
}

export async function handleAssetLoadError(event: Event): Promise<void> {
  const target = event.target
  if (!(
    target instanceof HTMLImageElement || target instanceof HTMLVideoElement
  ))
    return

  const previousSrc = target.src
  const failedSrc =
    target instanceof HTMLVideoElement
      ? target.currentSrc || target.src
      : target.src
  const id = idBySignedUrl.get(failedSrc)
  if (id == null) return

  cacheById.delete(id)
  const result = await getAssetDetails(id)
  if (result.isErr()) {
    console.error('Failed to refresh signed asset URL', result.error)
    return
  }
  if (target.src !== previousSrc || result.value.url === previousSrc) return

  if (target instanceof HTMLVideoElement) {
    const currentTime = target.currentTime
    if (Number.isFinite(currentTime) && currentTime > 0) {
      const refreshedSrc = result.value.url
      target.addEventListener(
        'loadedmetadata',
        () => {
          if (target.src === refreshedSrc) target.currentTime = currentTime
        },
        { once: true },
      )
    }
  }
  target.src = result.value.url
}
