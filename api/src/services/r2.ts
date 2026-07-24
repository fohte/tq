import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { err, ok, type Result, ResultAsync } from 'neverthrow'

export class R2ConfigError extends Error {
  constructor() {
    super(
      'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables are required',
    )
    this.name = 'R2ConfigError'
  }
}

export class R2OperationError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`R2 ${operation} failed`, { cause })
    this.name = 'R2OperationError'
  }
}

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
}

function getConfig(): Result<R2Config, R2ConfigError> {
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
    return err(new R2ConfigError())
  }

  return ok({ accountId, accessKeyId, secretAccessKey, bucketName })
}

function getClient(
  config: Pick<R2Config, 'accountId' | 'accessKeyId' | 'secretAccessKey'>,
): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

function withR2<T>(
  operation: string,
  run: (config: R2Config, client: S3Client) => Promise<T>,
): ResultAsync<T, R2ConfigError | R2OperationError> {
  return getConfig().asyncAndThen((config) =>
    ResultAsync.fromPromise(
      run(config, getClient(config)),
      (cause) => new R2OperationError(operation, cause),
    ),
  )
}

export function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): ResultAsync<void, R2ConfigError | R2OperationError> {
  return withR2('putObject', (config, client) =>
    client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    ),
  ).map(() => undefined)
}

export function getObjectSignedUrl(
  key: string,
  expiresInSeconds: number,
): ResultAsync<string, R2ConfigError | R2OperationError> {
  return withR2('getObjectSignedUrl', (config, client) =>
    getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucketName, Key: key }),
      { expiresIn: expiresInSeconds },
    ),
  )
}

export function deleteObjectByKey(
  key: string,
): ResultAsync<void, R2ConfigError | R2OperationError> {
  return withR2('deleteObjectByKey', (config, client) =>
    client.send(
      new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }),
    ),
  ).map(() => undefined)
}
