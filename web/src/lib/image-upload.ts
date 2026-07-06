import { api } from '@web/lib/api'

const IMAGE_PATH_PATTERN = /^\/api\/images\/([^/]+)$/

export function parseImageId(src: string): string | null {
  return IMAGE_PATH_PATTERN.exec(src)?.[1] ?? null
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

// Refresh signed URLs before the server-issued 1-hour expiry actually lapses.
const SIGNED_URL_CACHE_TTL_MS = 55 * 60 * 1000

export class UnsupportedImageTypeError extends Error {
  constructor() {
    super(
      `Unsupported image type. Allowed types: ${ACCEPTED_IMAGE_TYPES.join(', ')}`,
    )
    this.name = 'UnsupportedImageTypeError'
  }
}

export class ImageTooLargeError extends Error {
  constructor() {
    super(
      `Image too large. Maximum size is ${String(MAX_IMAGE_SIZE_BYTES)} bytes`,
    )
    this.name = 'ImageTooLargeError'
  }
}

export async function uploadImageFile(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new UnsupportedImageTypeError()
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageTooLargeError()
  }

  const res = await api.api.images.$post({ form: { file } })
  if (!res.ok) throw new Error('Failed to upload image')
  const { id } = await res.json()
  return `/api/images/${id}`
}

interface CacheEntry {
  url: string
  expiresAt: number
}

const cacheById = new Map<string, CacheEntry>()
// Reverse lookup so a failed <img> load (which only exposes the resolved
// signed URL, not the original /api/images/:id path) can find its image id.
const idBySignedUrl = new Map<string, string>()

async function fetchSignedUrl(id: string): Promise<string> {
  const res = await api.api.images[':id'].$get({ param: { id } })
  if (!res.ok) throw new Error('Failed to fetch signed image URL')
  const { url } = await res.json()
  cacheById.set(id, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS })
  idBySignedUrl.set(url, id)
  return url
}

export async function resolveImageSrc(src: string): Promise<string> {
  const id = parseImageId(src)
  if (id == null) return src

  const cached = cacheById.get(id)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }

  return fetchSignedUrl(id)
}

export async function handleImageLoadError(event: Event): Promise<void> {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return

  const id = idBySignedUrl.get(target.src)
  if (id == null) return

  cacheById.delete(id)
  target.src = await fetchSignedUrl(id)
}
