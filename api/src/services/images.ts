import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from '@api/constants/images'
import { db } from '@api/db/connection'
import { images } from '@api/db/schema'
import { firstOrThrow } from '@api/lib/drizzle-utils'
import {
  deleteObjectByKey,
  getObjectSignedUrl,
  putObject,
} from '@api/services/r2'
import { eq } from 'drizzle-orm'

export { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES }

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60

export class InvalidImageTypeError extends Error {
  constructor() {
    super(
      `Unsupported content type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    )
    this.name = 'InvalidImageTypeError'
  }
}

export class ImageTooLargeError extends Error {
  constructor() {
    super(`File too large. Maximum size is ${String(MAX_SIZE_BYTES)} bytes`)
    this.name = 'ImageTooLargeError'
  }
}

export class ImageNotFoundError extends Error {
  constructor() {
    super('Image not found')
    this.name = 'ImageNotFoundError'
  }
}

export async function uploadImage(
  file: File,
): Promise<typeof images.$inferSelect> {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    throw new InvalidImageTypeError()
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new ImageTooLargeError()
  }

  const id = crypto.randomUUID()
  const r2Key = `images/${id}`
  const body = Buffer.from(await file.arrayBuffer())

  await putObject(r2Key, body, file.type)

  return firstOrThrow(
    await db
      .insert(images)
      .values({
        id,
        r2Key,
        contentType: file.type,
        sizeBytes: file.size,
      })
      .returning(),
  )
}

export async function getImageSignedUrl(id: string): Promise<string> {
  const image = await db.query.images.findFirst({
    where: eq(images.id, id),
  })
  if (!image) {
    throw new ImageNotFoundError()
  }

  return getObjectSignedUrl(image.r2Key, SIGNED_URL_EXPIRES_IN_SECONDS)
}

export async function deleteImage(id: string): Promise<void> {
  const image = await db.query.images.findFirst({
    where: eq(images.id, id),
  })
  if (!image) {
    throw new ImageNotFoundError()
  }

  // Delete the DB row first: if deleteObjectByKey fails afterward, the
  // orphan is just an unreferenced R2 object, not a DB row pointing at a
  // now-missing one (which would render as a permanently broken image).
  await db.delete(images).where(eq(images.id, id))
  await deleteObjectByKey(image.r2Key)
}
