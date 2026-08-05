export abstract class BoundaryError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause })
    this.name = new.target.name
  }
}

export class NetworkError extends BoundaryError {}

export class FileIoError extends BoundaryError {}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
