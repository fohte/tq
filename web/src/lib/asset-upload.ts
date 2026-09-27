import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from 'api/constants/assets'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { api } from '#lib/api'

const ASSET_PATH_PATTERN = /^\/api\/assets\/([^/]+)$/

export function parseAssetId(src: string): string | null {
  return ASSET_PATH_PATTERN.exec(src)?.[1] ?? null
}

// Refresh signed URLs before the server-issued 1-hour expiry actually lapses.
const SIGNED_URL_CACHE_TTL_MS = 55 * 60 * 1000

export class UnsupportedAssetTypeError extends Error {
  constructor() {
    super(
      `Unsupported image type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    )
    this.name = 'UnsupportedAssetTypeError'
  }
}

export class AssetTooLargeError extends Error {
  constructor() {
    super(`Image too large. Maximum size is ${String(MAX_SIZE_BYTES)} bytes`)
    this.name = 'AssetTooLargeError'
  }
}

export function uploadAssetFile(
  file: File,
): ResultAsync<string, UnsupportedAssetTypeError | AssetTooLargeError | Error> {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return errAsync(new UnsupportedAssetTypeError())
  }
  if (file.size > MAX_SIZE_BYTES) {
    return errAsync(new AssetTooLargeError())
  }

  return ResultAsync.fromPromise(
    api.api.assets.$post({ form: { file } }),
    (cause) => new Error('Failed to upload image', { cause }),
  ).andThen((res) => {
    if (!res.ok) return errAsync(new Error('Failed to upload image'))
    return ResultAsync.fromPromise(
      res.json(),
      (cause) => new Error('Failed to upload image', { cause }),
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
      console.error('Failed to upload pasted/dropped image', settled.reason)
      continue
    }
    const { file, result } = settled.value
    if (result.isErr()) {
      console.error('Failed to upload pasted/dropped image', result.error)
      continue
    }
    const node = createNode(result.value, file.name)
    if (node != null) nodes.push(node)
  }
  return nodes
}

interface CacheEntry {
  url: string
  expiresAt: number
}

const cacheById = new Map<string, CacheEntry>()
// Reverse lookup so a failed <img> load (which only exposes the resolved
// signed URL, not the original /api/assets/:id path) can find its asset id.
const idBySignedUrl = new Map<string, string>()

function fetchSignedUrl(id: string): ResultAsync<string, Error> {
  return ResultAsync.fromPromise(
    api.api.assets[':id'].$get({ param: { id } }),
    (cause) => new Error('Failed to fetch signed image URL', { cause }),
  ).andThen((res) => {
    if (!res.ok) return errAsync(new Error('Failed to fetch signed image URL'))
    return ResultAsync.fromPromise(
      res.json(),
      (cause) => new Error('Failed to fetch signed image URL', { cause }),
    ).map(({ url }) => {
      cacheById.set(id, {
        url,
        expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
      })
      idBySignedUrl.set(url, id)
      return url
    })
  })
}

export function resolveAssetSrc(src: string): ResultAsync<string, Error> {
  const id = parseAssetId(src)
  if (id == null) return okAsync(src)

  const cached = cacheById.get(id)
  if (cached && cached.expiresAt > Date.now()) {
    return okAsync(cached.url)
  }

  return fetchSignedUrl(id)
}

export async function handleAssetLoadError(event: Event): Promise<void> {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return

  const id = idBySignedUrl.get(target.src)
  if (id == null) return

  cacheById.delete(id)
  const result = await fetchSignedUrl(id)
  if (result.isErr()) {
    console.error('Failed to refresh signed image URL', result.error)
    return
  }
  target.src = result.value
}
