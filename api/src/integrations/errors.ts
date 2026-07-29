export class IntegrationConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationConfigError'
  }
}

export class OAuthTokenMissingError extends Error {
  constructor() {
    super('No OAuth token found. Please authenticate first.')
    this.name = 'OAuthTokenMissingError'
  }
}

export class TokenRefreshError extends Error {
  /**
   * True when the provider itself rejected the refresh token (e.g.
   * `invalid_grant` from revocation or expiry) — a normal OAuth outcome the
   * client can recover from by re-authenticating. False for a
   * network/parse/schema failure, which must be reported to Sentry instead.
   */
  readonly rejected: boolean

  constructor(message: string, cause?: unknown, rejected = false) {
    super(`Token refresh failed: ${message}`, { cause })
    this.name = 'TokenRefreshError'
    this.rejected = rejected
  }
}
