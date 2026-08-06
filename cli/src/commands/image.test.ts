import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { captureFetch, fakeStdin, spyStdout } from '#test-utils'

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

function requestUrl(input: string | URL | Request): string {
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return input
}

interface CapturedFormRequest {
  method: string
  url: string
  fileName: string
  fileType: string
  fileBytes: Uint8Array
}

function captureMultipartFetch(respond: () => Response): {
  fetchStub: typeof fetch
  calls: Promise<CapturedFormRequest>[]
} {
  const calls: Promise<CapturedFormRequest>[] = []
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    const body = init?.body
    if (!(body instanceof FormData)) {
      throw new Error('expected a multipart/form-data body')
    }
    const file = body.get('file')
    if (!(file instanceof File)) {
      throw new Error('expected a "file" field of type File')
    }
    calls.push(
      file.arrayBuffer().then((buffer) => ({
        method: init?.method ?? 'GET',
        url: requestUrl(input),
        fileName: file.name,
        fileType: file.type,
        fileBytes: new Uint8Array(buffer),
      })),
    )
    return Promise.resolve(respond())
  }) as typeof fetch
  return { fetchStub, calls }
}

describe('image upload', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('sends the file as multipart/form-data to POST /api/images and prints the response', async () => {
    const uploaded = {
      id: 'img1',
      r2Key: 'images/img1.png',
      contentType: 'image/png',
      sizeBytes: 4,
      url: 'https://signed.example/img1',
    }
    const { fetchStub, calls } = captureMultipartFetch(
      () => new Response(JSON.stringify(uploaded), { status: 201 }),
    )
    const write = spyStdout()

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-image-upload-'))
    const filePath = join(tmpDir, 'photo.png')
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10, 0x7f,
    ])
    await writeFile(filePath, pngBytes)

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'image', 'upload', filePath],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    await expect(calls[0]).resolves.toEqual({
      method: 'POST',
      url: `${apiUrl}/api/images`,
      fileName: 'photo.png',
      fileType: 'image/png',
      fileBytes: pngBytes,
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(uploaded, null, 2)}\n`],
    ])
  })

  it('maps a .jpg extension to the image/jpeg content type', async () => {
    const uploaded = { id: 'img2' }
    const { fetchStub, calls } = captureMultipartFetch(
      () => new Response(JSON.stringify(uploaded), { status: 201 }),
    )

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-image-upload-'))
    const filePath = join(tmpDir, 'photo.jpg')
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x10, 0x7f])
    await writeFile(filePath, jpgBytes)

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'image', 'upload', filePath],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    await expect(calls[0]).resolves.toEqual({
      method: 'POST',
      url: `${apiUrl}/api/images`,
      fileName: 'photo.jpg',
      fileType: 'image/jpeg',
      fileBytes: jpgBytes,
    })
  })
})

describe('image get', () => {
  it('prints the signed URL as JSON when --output is not given', async () => {
    const signedUrlResponse = { url: 'https://signed.example/img1' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(signedUrlResponse), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'image', 'get', 'img1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'GET',
        url: `${apiUrl}/api/images/img1`,
        headers: {},
        body: undefined,
      },
    ])
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(signedUrlResponse, null, 2)}\n`],
    ])
  })

  describe('with --output', () => {
    let tmpDir: string | undefined

    afterEach(async () => {
      if (tmpDir != null) {
        await rm(tmpDir, { recursive: true, force: true })
        tmpDir = undefined
      }
    })

    it('downloads the binary from the signed URL, writes it to the file, and never prints it to stdout', async () => {
      const signedUrl = 'https://signed.example/img1?token=abc'
      const binary = new Uint8Array([1, 2, 3, 4])
      const fetchStub = ((input: string | URL | Request) => {
        const url = requestUrl(input)
        if (url === `${apiUrl}/api/images/img1`) {
          return Promise.resolve(
            new Response(JSON.stringify({ url: signedUrl }), { status: 200 }),
          )
        }
        if (url === signedUrl) {
          return Promise.resolve(new Response(binary, { status: 200 }))
        }
        throw new Error(`unexpected fetch to ${url}`)
      }) as typeof fetch
      const write = spyStdout()

      tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-image-get-'))
      const outputPath = join(tmpDir, 'downloaded.png')

      const exitCode = await runCli(
        ['--api-url', apiUrl, 'image', 'get', 'img1', '--output', outputPath],
        fetchStub,
        fakeStdin(true),
      )

      expect(exitCode).toBe(0)
      expect(write.mock.calls).toEqual([
        [`${JSON.stringify({ id: 'img1', output: outputPath }, null, 2)}\n`],
      ])
      const written = await readFile(outputPath)
      expect(new Uint8Array(written)).toEqual(binary)
    })
  })
})

describe('image delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'image', 'delete', 'img1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ deleted: true, id: 'img1' }, null, 2)}\n`],
    ])
  })
})
