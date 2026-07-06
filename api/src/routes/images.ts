import type { images } from '@api/db/schema'
import {
  deleteImage,
  getImageSignedUrl,
  ImageNotFoundError,
  ImageTooLargeError,
  InvalidImageTypeError,
  uploadImage,
} from '@api/services/images'
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

    try {
      const image = await uploadImage(file)
      const url = await getImageSignedUrl(image.id)
      return c.json(imageToResponse(image, url), 201)
    } catch (error) {
      if (error instanceof InvalidImageTypeError) {
        return c.json({ error: error.message }, 400)
      }
      if (error instanceof ImageTooLargeError) {
        return c.json({ error: error.message }, 413)
      }
      throw error
    }
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id')

    try {
      const url = await getImageSignedUrl(id)
      return c.json({ url }, 200)
    } catch (error) {
      if (error instanceof ImageNotFoundError) {
        return c.json({ error: error.message }, 404)
      }
      throw error
    }
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id')

    try {
      await deleteImage(id)
      return c.body(null, 204)
    } catch (error) {
      if (error instanceof ImageNotFoundError) {
        return c.json({ error: error.message }, 404)
      }
      throw error
    }
  })
