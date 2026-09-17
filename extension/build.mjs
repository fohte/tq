import { mkdir, readFile, writeFile } from 'node:fs/promises'

import * as esbuild from 'esbuild'

import { TQ_ORIGIN } from '#config'

await esbuild.build({
  entryPoints: ['src/content.ts', 'src/background.ts'],
  bundle: true,
  format: 'iife',
  outdir: 'dist',
  define: { 'process.env.TQ_ORIGIN': JSON.stringify(TQ_ORIGIN) },
})

const manifest = JSON.parse(await readFile('manifest.template.json', 'utf8'))
manifest.host_permissions = [`${TQ_ORIGIN}/*`]

await mkdir('dist', { recursive: true })
await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
