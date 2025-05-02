import type { AppLogger as Logger } from '@repo/logger';

/**
 * Configuration options for creating a SecretsManager instance.
 */
export interface CreateSecretsManagerOptions {
  /** The URL of the secrets API endpoint. */
  apiUrl: string;
  /** The URL of the OAuth token endpoint. */
  oauthUrl: string;
  /** The Client ID for OAuth authentication. */
  oauthClientId: string;
  /** The Client Secret for OAuth authentication. */
  oauthClientSecret: string;
  /** Optional logger instance. */
  logger?: Logger;
  /** Optional proxy server URL (e.g., http://user:pass@host:port). */
  proxy?: string;
  /** Whether to reject unauthorized TLS certificates. Defaults to true. */
  rejectUnauthorized?: boolean;
}

/**
 * Interface for the SecretsManager.
 */
export interface SecretsManager {
  /**
   * Fetches secrets from the configured API endpoint.
   * @returns A promise that resolves to the fetched secrets as a record.
   */
  load: () => Promise<Record<string, string | undefined>>;
}
