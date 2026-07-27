<<<<<<< before updating
import '@api/bootstrap'
||||||| last update
export const greet = (name: string): string => {
  return `Hello, ${name}!`
}
=======
import '#bootstrap'
>>>>>>> after updating

<<<<<<< before updating
import { app } from '@api/app'
import { serve } from '@hono/node-server'

const port = Number(process.env['PORT']) || 3001

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server is running on http://localhost:${String(info.port)}`)
})
||||||| last update
export const greet = (name: string): string => {
  return `Hello, ${name}!`
}
=======
export const greet = (name: string): string => {
  return `Hello, ${name}!`
}
>>>>>>> after updating
