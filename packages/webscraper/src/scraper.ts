import axios, { type AxiosRequestConfig, isAxiosError } from 'axios';
import type { ScraperOptions } from './types';
import { logger } from './config/logger';

export class ScraperError extends Error {
  public readonly originalError?: unknown;
  public readonly statusCode?: number;
  public readonly url: string;

  constructor(message: string, url: string, options?: { cause?: unknown; statusCode?: number }) {
    super(message);
    this.name = 'ScraperError';
    this.url = url;
    this.originalError = options?.cause;
    this.statusCode = options?.statusCode;
    // Ensure stack trace capture (if available)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScraperError);
    }
  }
}

/**
 * Fetches the HTML content for a given URL using axios, with proxy support.
 * @param url The URL of the page to scrape.
 * @param options Optional configuration including proxy settings, headers, timeout.
 * @returns A promise that resolves with the HTML content as a string.
 * @throws Throws a ScraperError if the fetch fails or the response is not successful.
 */
export async function scrape(url: string, options?: ScraperOptions): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = options?.timeout ?? 15000; // Default 15 seconds timeout

  const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  const requestConfig: AxiosRequestConfig = {
    url: url,
    method: 'get',
    responseType: 'text',
    proxy: options?.proxy,
    headers: {
      'User-Agent': defaultUserAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      ...(options?.headers ?? {}),
    },
    timeout: timeoutMs,
    signal: controller.signal,
    maxRedirects: 5,
    validateStatus: function (status) {
        return status >= 200 && status < 300;
    },
  };

  const timeoutId = setTimeout(() => {
      logger.warn({ url, timeout: timeoutMs }, `Scraping timed out after ${timeoutMs}ms`);
      controller.abort(`Request timed out after ${timeoutMs}ms`);
  }, timeoutMs);


  try {
    logger.debug({ msg: "Scraping URL", url, proxy: options?.proxy });
    const response = await axios.request(requestConfig);
    clearTimeout(timeoutId);
    logger.debug({ msg: "Scrape successful", url, status: response.status });
    return response.data;
  } catch (error) {
    clearTimeout(timeoutId);
    let errorMessage = `Failed to scrape URL: ${url}.`;
    let statusCode: number | undefined;
    let cause: unknown = error;

    if (isAxiosError(error)) {
        statusCode = error.response?.status;
        errorMessage += ` Status: ${statusCode ?? 'N/A'}.`;
        if (error.code) errorMessage += ` Code: ${error.code}.`;
        logger.error({
            msg: "Axios error during scrape",
            url,
            code: error.code,
            status: statusCode,
            requestConfig: { method: error.config?.method, url: error.config?.url },
            responseHeaders: error.response?.headers,
            responseDataSample: typeof error.response?.data === 'string' ? error.response.data.substring(0, 100) + '...' : '[non-string data]',
            err: error.message
        }, errorMessage);
    } else if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = `Scraping timed out for URL: ${url} after ${timeoutMs}ms.`;
        logger.error({ msg: "Timeout error during scrape", url, timeout: timeoutMs, err: error }, errorMessage);
        cause = error;
    } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
        logger.error({ msg: "Generic error during scrape", url, err: error }, errorMessage);
        cause = error;
    } else {
        errorMessage += ` Unknown error occurred.`;
        logger.error({ msg: "Unknown error during scrape", url, err: error }, errorMessage);
        cause = error;
    }

    throw new ScraperError(errorMessage, url, { cause, statusCode });
  }
} 