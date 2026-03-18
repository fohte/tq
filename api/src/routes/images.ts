import { Hono } from 'hono'

export const imagesApp = new Hono()
  .post('/', (c) => {
    // TODO: implement image upload (multipart/form-data, JPEG/PNG/GIF/WebP, 10MB limit)
    return c.json({ message: 'not implemented' }, 501)
  })
  .get('/:id', (c) => {
    // TODO: implement signed URL retrieval
    void c.req.param('id')
    return c.json({ message: 'not implemented' }, 501)
  })
  .delete('/:id', (c) => {
    // TODO: implement image deletion
    void c.req.param('id')
    return c.json(null, 501)
  })
