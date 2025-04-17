import type { AppLogger } from '@repo/logger';

export interface ScraperOptions {
  /**
   * Proxy URL (e.g. from http_proxy/https_proxy env).
   */
  proxy?: string;
  headers?: Record<string, string>;
  timeout?: number;
  logger?: AppLogger;
  /**
   * If true, disables SSL certificate validation (rejectUnauthorized: false).
   */
  allowUnsignedCerts?: boolean;
}

/**
 * Interface defining the scraper methods.
 */
export interface Scraper {
  /**
   * Fetches and cleans the primary textual content from a given URL.
   * @param url The URL of the page to scrape.
   * @param options Optional configuration including proxy, headers, timeout, and logger.
   * @returns A promise that resolves with the cleaned text content as a string.
   * @throws Throws a ScraperError if the fetch or processing fails.
   */
  scrape: (url: string, options?: ScraperOptions) => Promise<string>;
} 