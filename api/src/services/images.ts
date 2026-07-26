import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from '@api/constants/images'
import { db } from '@api/db/connection'
import { images } from '@api/db/schema'
import { firstOrErr, type RowNotFoundError } from '@api/lib/drizzle-utils'
import {
  deleteObjectByKey,
  getObjectSignedUrl,
  putObject,
  type R2ConfigError,
  type R2OperationError,
} from '@api/services/r2'
import { eq } from 'drizzle-orm'
import { errAsync, ResultAsync } from 'neverthrow'

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

export function uploadImage(
  file: File,
): ResultAsync<
  typeof images.$inferSelect,
  | InvalidImageTypeError
  | ImageTooLargeError
  | R2ConfigError
  | R2OperationError
  | RowNotFoundError
> {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return errAsync(new InvalidImageTypeError())
  }
  if (file.size > MAX_SIZE_BYTES) {
    return errAsync(new ImageTooLargeError())
  }

  const id = crypto.randomUUID()
  const r2Key = `images/${id}`

  return ResultAsync.fromSafePromise(file.arrayBuffer())
    .andThen((buffer) => putObject(r2Key, Buffer.from(buffer), file.type))
    .andThen(() =>
      ResultAsync.fromSafePromise(
        db
          .insert(images)
          .values({
            id,
            r2Key,
            contentType: file.type,
            sizeBytes: file.size,
          })
          .returning(),
      ),
    )
    .andThen((rows) => firstOrErr(rows))
}

export function getImageSignedUrl(
  id: string,
): ResultAsync<string, ImageNotFoundError | R2ConfigError | R2OperationError> {
  return ResultAsync.fromSafePromise(
    db.query.images.findFirst({ where: eq(images.id, id) }),
  ).andThen((image) => {
    if (!image) return errAsync(new ImageNotFoundError())
    return getObjectSignedUrl(image.r2Key, SIGNED_URL_EXPIRES_IN_SECONDS)
  })
}

export function deleteImage(
  id: string,
): ResultAsync<void, ImageNotFoundError | R2ConfigError | R2OperationError> {
  return ResultAsync.fromSafePromise(
    db.query.images.findFirst({ where: eq(images.id, id) }),
  ).andThen((image) => {
    if (!image) return errAsync(new ImageNotFoundError())

    // Delete the DB row first: if deleteObjectByKey fails afterward, the
    // orphan is just an unreferenced R2 object, not a DB row pointing at a
    // now-missing one (which would render as a permanently broken image).
    return ResultAsync.fromSafePromise(
      db.delete(images).where(eq(images.id, id)),
    ).andThen(() => deleteObjectByKey(image.r2Key))
  })
}
