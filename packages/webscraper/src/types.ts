import type { AppLogger } from '@repo/logger';
import type { AxiosRequestConfig } from 'axios';

export interface ScraperOptions {
  proxy?: AxiosRequestConfig['proxy'];
  headers?: Record<string, string>;
  timeout?: number;
  logger?: AppLogger; // Add optional logger instance
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