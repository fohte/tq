import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { assets } from '#db/schema'
import {
  AssetNotFoundError,
  AssetTooLargeError,
  deleteAsset,
  getAssetSignedUrl,
  InvalidAssetTypeError,
  uploadAsset,
} from '#services/assets'

const uploadSchema = z.object({ file: z.instanceof(File) })

function assetToResponse(asset: typeof assets.$inferSelect, url: string) {
  return {
    id: asset.id,
    r2Key: asset.r2Key,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    url,
  }
}

export const assetsApp = new Hono()
  .post('/', zValidator('form', uploadSchema), async (c) => {
    const { file } = c.req.valid('form')

    const result = await uploadAsset(file).andThen((asset) =>
      getAssetSignedUrl(asset.id).map((url) => assetToResponse(asset, url)),
    )

    return result.match(
      (body) => c.json(body, 201),
      (error) => {
        if (error instanceof InvalidAssetTypeError) {
          return c.json({ error: error.message }, 400)
        }
        if (error instanceof AssetTooLargeError) {
          return c.json({ error: error.message }, 413)
        }
        captureWithFingerprint(error, 'api.assets.upload-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    const result = await getAssetSignedUrl(id)

    return result.match(
      (url) => c.json({ url }, 200),
      (error) => {
        if (error instanceof AssetNotFoundError) {
          return c.json({ error: error.message }, 404)
        }
        captureWithFingerprint(error, 'api.assets.get-signed-url-failed', {
          extras: { assetId: id },
        })
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const result = await deleteAsset(id)

    return result.match(
      () => c.body(null, 204),
      (error) => {
        if (error instanceof AssetNotFoundError) {
          return c.json({ error: error.message }, 404)
        }
        captureWithFingerprint(error, 'api.assets.delete-failed', {
          extras: { assetId: id },
        })
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
