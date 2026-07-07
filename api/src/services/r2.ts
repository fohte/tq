import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getConfig() {
  const accountId = process.env['R2_ACCOUNT_ID']
  const accessKeyId = process.env['R2_ACCESS_KEY_ID']
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY']
  const bucketName = process.env['R2_BUCKET_NAME']

  if (
    accountId == null ||
    accountId === '' ||
    accessKeyId == null ||
    accessKeyId === '' ||
    secretAccessKey == null ||
    secretAccessKey === '' ||
    bucketName == null ||
    bucketName === ''
  ) {
    throw new Error(
      'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables are required',
    )
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName }
}

function getClient() {
  const { accountId, accessKeyId, secretAccessKey } = getConfig()

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { bucketName } = getConfig()
  const client = getClient()

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function getObjectSignedUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const { bucketName } = getConfig()
  const client = getClient()

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucketName, Key: key }),
    { expiresIn: expiresInSeconds },
  )
}

export async function deleteObjectByKey(key: string): Promise<void> {
  const { bucketName } = getConfig()
  const client = getClient()

  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
}
