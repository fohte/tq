import { eq } from 'drizzle-orm'
import { okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { assets } from '#db/schema'
import {
  AssetNotFoundError,
  AssetTooLargeError,
  deleteAsset,
  getAssetSignedUrl,
  InvalidAssetTypeError,
  MAX_SIZE_BYTES,
  uploadAsset,
} from '#services/assets'
import * as r2 from '#services/r2'
import { makeFile, setupTestDb } from '#testing'

vi.mock('#services/r2')

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'
const SIGNED_URL = 'https://signed.example.com/assets/test'

beforeEach(() => {
  vi.mocked(r2.putObject).mockReset().mockReturnValue(okAsync(undefined))
  vi.mocked(r2.getObjectSignedUrl)
    .mockReset()
    .mockReturnValue(okAsync(SIGNED_URL))
  vi.mocked(r2.deleteObjectByKey)
    .mockReset()
    .mockReturnValue(okAsync(undefined))
})

function normalize(asset: typeof assets.$inferSelect) {
  return {
    ...asset,
    id: 'ID',
    r2Key: asset.r2Key.replace(asset.id, 'ID'),
    createdAt: 'DATE',
  }
}

describe('uploadAsset', () => {
  it('stores metadata and uploads the file body to R2', async () => {
    const file = makeFile('photo.png', 'image/png', 1234)

    const asset = (await uploadAsset(file))._unsafeUnwrap()

    expect(normalize(asset)).toEqual({
      id: 'ID',
      r2Key: 'assets/ID',
      contentType: 'image/png',
      sizeBytes: 1234,
      createdAt: 'DATE',
    })
    expect(vi.mocked(r2.putObject).mock.calls).toEqual([
      [asset.r2Key, Buffer.alloc(1234), 'image/png'],
    ])
  })

  it('rejects unsupported content types', async () => {
    const file = makeFile('doc.pdf', 'application/pdf', 100)

    const error = (await uploadAsset(file))._unsafeUnwrapErr()

    expect(error).toEqual(new InvalidAssetTypeError())
    expect(r2.putObject).not.toHaveBeenCalled()
  })

  it('rejects files larger than the size limit', async () => {
    const file = makeFile('big.png', 'image/png', MAX_SIZE_BYTES + 1)

    const error = (await uploadAsset(file))._unsafeUnwrapErr()

    expect(error).toEqual(new AssetTooLargeError())
    expect(r2.putObject).not.toHaveBeenCalled()
  })
})

describe('getAssetSignedUrl', () => {
  it('returns a signed URL for an existing asset', async () => {
    const asset = (
      await uploadAsset(makeFile('photo.png', 'image/png', 10))
    )._unsafeUnwrap()

    const url = (await getAssetSignedUrl(asset.id))._unsafeUnwrap()

    expect(url).toBe(SIGNED_URL)
    expect(vi.mocked(r2.getObjectSignedUrl).mock.calls).toEqual([
      [asset.r2Key, 3600],
    ])
  })

  it('returns AssetNotFoundError when getting a signed URL for a non-existent asset', async () => {
    const error = (await getAssetSignedUrl(TEST_UUID))._unsafeUnwrapErr()

    expect(error).toEqual(new AssetNotFoundError())
  })
})

describe('deleteAsset', () => {
  it('deletes the R2 object and the DB row', async () => {
    const asset = (
      await uploadAsset(makeFile('photo.png', 'image/png', 10))
    )._unsafeUnwrap()

    const deleted = await deleteAsset(asset.id)
    deleted._unsafeUnwrap()

    expect(vi.mocked(r2.deleteObjectByKey).mock.calls).toEqual([[asset.r2Key]])
    const rows = await db.select().from(assets).where(eq(assets.id, asset.id))
    expect(rows).toEqual([])
  })

  it('returns AssetNotFoundError when deleting a non-existent asset', async () => {
    const error = (await deleteAsset(TEST_UUID))._unsafeUnwrapErr()

    expect(error).toEqual(new AssetNotFoundError())
  })
})
