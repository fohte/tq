import { eq } from 'drizzle-orm'
import { errAsync, ResultAsync } from 'neverthrow'

import { ALLOWED_CONTENT_TYPES, MAX_SIZE_BYTES } from '#constants/assets'
import { db } from '#db/connection'
import { assets } from '#db/schema'
import { firstOrErr, type RowNotFoundError } from '#lib/drizzle-utils'
import {
  deleteObjectByKey,
  getObjectSignedUrl,
  putObject,
  type R2ConfigError,
  type R2OperationError,
} from '#services/r2'

export { MAX_SIZE_BYTES }

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60

export class InvalidAssetTypeError extends Error {
  constructor() {
    super(
      `Unsupported content type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    )
    this.name = 'InvalidAssetTypeError'
  }
}

export class AssetTooLargeError extends Error {
  constructor() {
    super(`File too large. Maximum size is ${String(MAX_SIZE_BYTES)} bytes`)
    this.name = 'AssetTooLargeError'
  }
}

export class AssetNotFoundError extends Error {
  constructor() {
    super('Asset not found')
    this.name = 'AssetNotFoundError'
  }
}

export function uploadAsset(
  file: File,
): ResultAsync<
  typeof assets.$inferSelect,
  | InvalidAssetTypeError
  | AssetTooLargeError
  | R2ConfigError
  | R2OperationError
  | RowNotFoundError
> {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return errAsync(new InvalidAssetTypeError())
  }
  if (file.size > MAX_SIZE_BYTES) {
    return errAsync(new AssetTooLargeError())
  }

  const id = crypto.randomUUID()
  const r2Key = `assets/${id}`

  return ResultAsync.fromSafePromise(file.arrayBuffer())
    .andThen((buffer) => putObject(r2Key, Buffer.from(buffer), file.type))
    .andThen(() =>
      ResultAsync.fromSafePromise(
        db
          .insert(assets)
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

export function getAssetSignedUrl(
  id: string,
): ResultAsync<string, AssetNotFoundError | R2ConfigError | R2OperationError> {
  return ResultAsync.fromSafePromise(
    db.query.assets.findFirst({ where: eq(assets.id, id) }),
  ).andThen((asset) => {
    if (!asset) return errAsync(new AssetNotFoundError())
    return getObjectSignedUrl(asset.r2Key, SIGNED_URL_EXPIRES_IN_SECONDS)
  })
}

export function deleteAsset(
  id: string,
): ResultAsync<void, AssetNotFoundError | R2ConfigError | R2OperationError> {
  return ResultAsync.fromSafePromise(
    db.query.assets.findFirst({ where: eq(assets.id, id) }),
  ).andThen((asset) => {
    if (!asset) return errAsync(new AssetNotFoundError())

    // Delete the DB row first: if deleteObjectByKey fails afterward, the
    // orphan is just an unreferenced R2 object, not a DB row pointing at a
    // now-missing one (which would render as a permanently broken asset).
    return ResultAsync.fromSafePromise(
      db.delete(assets).where(eq(assets.id, id)),
    ).andThen(() => deleteObjectByKey(asset.r2Key))
  })
}
