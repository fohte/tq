import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const MOCK_ENV = {
  R2_ACCOUNT_ID: 'test-account-id',
  R2_ACCESS_KEY_ID: 'test-access-key-id',
  R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
  R2_BUCKET_NAME: 'test-bucket',
}

function setEnv() {
  for (const [key, value] of Object.entries(MOCK_ENV)) {
    process.env[key] = value
  }
}

function clearEnv() {
  for (const key of Object.keys(MOCK_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
}

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  setEnv()
  s3Mock.reset()
})

afterEach(() => {
  clearEnv()
})

// Dynamically import to allow env vars to be set before module evaluation
async function importService() {
  return await import('@api/services/r2')
}

describe('putObject', () => {
  it('sends a PutObjectCommand with the given key, body, and content type', async () => {
    const { putObject } = await importService()
    s3Mock.on(PutObjectCommand).resolves({})

    await putObject('images/abc', Buffer.from('hello'), 'image/png')

    expect(
      s3Mock.commandCalls(PutObjectCommand).map((call) => call.args[0].input),
    ).toEqual([
      {
        Bucket: 'test-bucket',
        Key: 'images/abc',
        Body: Buffer.from('hello'),
        ContentType: 'image/png',
      },
    ])
  })

  it('throws when R2 environment variables are missing', async () => {
    const { putObject } = await importService()
    clearEnv()

    await expect(
      putObject('images/abc', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow('environment variables are required')
  })
})

describe('getObjectSignedUrl', () => {
  it('returns a signed URL scoped to the configured bucket and key', async () => {
    const { getObjectSignedUrl } = await importService()

    const url = await getObjectSignedUrl('images/abc', 3600)
    const parsed = new URL(url)

    expect({
      origin: parsed.origin,
      pathname: parsed.pathname,
      expiresIn: parsed.searchParams.get('X-Amz-Expires'),
    }).toEqual({
      origin: 'https://test-bucket.test-account-id.r2.cloudflarestorage.com',
      pathname: '/images/abc',
      expiresIn: '3600',
    })
  })
})

describe('deleteObjectByKey', () => {
  it('sends a DeleteObjectCommand with the given key', async () => {
    const { deleteObjectByKey } = await importService()
    s3Mock.on(DeleteObjectCommand).resolves({})

    await deleteObjectByKey('images/abc')

    expect(
      s3Mock
        .commandCalls(DeleteObjectCommand)
        .map((call) => call.args[0].input),
    ).toEqual([{ Bucket: 'test-bucket', Key: 'images/abc' }])
  })
})
