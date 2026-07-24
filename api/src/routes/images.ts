import type { images } from '@api/db/schema'
import {
  deleteImage,
  getImageSignedUrl,
  ImageNotFoundError,
  ImageTooLargeError,
  InvalidImageTypeError,
  uploadImage,
} from '@api/services/images'
import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const uploadSchema = z.object({ file: z.instanceof(File) })

function imageToResponse(image: typeof images.$inferSelect, url: string) {
  return {
    id: image.id,
    r2Key: image.r2Key,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    url,
  }
}

export const imagesApp = new Hono()
  .post('/', zValidator('form', uploadSchema), async (c) => {
    const { file } = c.req.valid('form')

    const result = await uploadImage(file).andThen((image) =>
      getImageSignedUrl(image.id).map((url) => imageToResponse(image, url)),
    )

    return result.match(
      (body) => c.json(body, 201),
      (error) => {
        if (error instanceof InvalidImageTypeError) {
          return c.json({ error: error.message }, 400)
        }
        if (error instanceof ImageTooLargeError) {
          return c.json({ error: error.message }, 413)
        }
        captureWithFingerprint(error, 'api.images.upload-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    const result = await getImageSignedUrl(id)

    return result.match(
      (url) => c.json({ url }, 200),
      (error) => {
        if (error instanceof ImageNotFoundError) {
          return c.json({ error: error.message }, 404)
        }
        captureWithFingerprint(error, 'api.images.get-signed-url-failed', {
          extras: { imageId: id },
        })
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    const result = await deleteImage(id)

    return result.match(
      () => c.body(null, 204),
      (error) => {
        if (error instanceof ImageNotFoundError) {
          return c.json({ error: error.message }, 404)
        }
        captureWithFingerprint(error, 'api.images.delete-failed', {
          extras: { imageId: id },
        })
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
