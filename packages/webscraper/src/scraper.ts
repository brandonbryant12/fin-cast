import https from 'node:https';
import * as cheerio from 'cheerio';
import superagent from 'superagent';
import type { ScraperOptions, Scraper } from './types';
import type { AppLogger } from '@repo/logger';

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
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScraperError);
    }
  }
}

/**
 * Factory function to create a Scraper instance.
 * @returns An object implementing the Scraper interface.
 */
export const createScraper = (): Scraper => {
  /**
   * Internal scrape implementation.
   */
  const scrape = async (url: string, options?: ScraperOptions): Promise<string> => {
    const controller = new AbortController();
    const timeoutMs = options?.timeout ?? 15000; // Default 15 seconds timeout
    const logger: AppLogger | Console = options?.logger ?? console; // Use passed logger or fallback to console

    const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    let req = superagent
      .get(url)
      .set('User-Agent', defaultUserAgent)
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
      .set('Accept-Language', 'en-US,en;q=0.5')
      .timeout({ response: timeoutMs, deadline: timeoutMs })
      .disableTLSCerts();

    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        req = req.set(key, value as string);
      });
    }

    // Proxy and agent support
    let agent: any = undefined;
    const allowUnsignedCerts = options?.allowUnsignedCerts === true;
    if (options?.proxy) {
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      let proxyUrl: string;
      if (typeof options.proxy === 'string') {
        proxyUrl = options.proxy;
      } else {
        const { protocol = 'http', host, port, auth } = options.proxy;
        proxyUrl = `${protocol}://${auth ? auth + '@' : ''}${host}${port ? ':' + port : ''}`;
      }
      agent = new HttpsProxyAgent(proxyUrl);
      if (allowUnsignedCerts && agent.options) {
        agent.options.rejectUnauthorized = false;
      }
    } else {
      agent = new https.Agent({ rejectUnauthorized: !allowUnsignedCerts });
    }
    req = req.agent(agent);

    let timeoutId: NodeJS.Timeout | undefined;
    try {
      timeoutId = setTimeout(() => {
        logger.warn({ url, timeout: timeoutMs }, `Scraping timed out after ${timeoutMs}ms`);
        controller.abort();
      }, timeoutMs);

      logger.debug({ msg: "Scraping URL", url, proxy: options?.proxy });
      const response = await req;
      if (timeoutId) clearTimeout(timeoutId);
      logger.debug({ msg: "Scrape successful", url, status: response.status });
      
      // Parse HTML and extract relevant content
      const html = response.text;
      const $ = cheerio.load(html);

      // Remove common non-content elements
      $('script, style, nav, header, footer, aside, form, iframe, noscript').remove();

      // Attempt to add newlines for block elements for better structure
      $('p, div, li, h1, h2, h3, h4, h5, h6, br').after('\n');

      // Extract text from the body, or fallback to root if no body
      const body = $('body');
      const content = (body.length ? body.text() : $.root().text()) ?? '';

      // Clean up whitespace: replace multiple spaces/newlines with a single newline, trim
      const cleanedContent = content.replace(/[ \t]*\n[ \t\n]*/g, '\n').replace(/^\n+|\n+$/g, '').trim();

      return cleanedContent;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      let errorMessage = `Failed to scrape URL: ${url}.`;
      let statusCode: number | undefined;
      let cause: unknown = error;

      if (error && typeof error === 'object' && 'status' in error) {
        statusCode = (error as any).status;
        errorMessage += ` Status: ${statusCode ?? 'N/A'}.`;
        if ((error as any).code) errorMessage += ` Code: ${(error as any).code}.`;
        logger.error({
          msg: "Superagent error during scrape",
          url,
          code: (error as any).code,
          status: statusCode,
          err: (error as any).message
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
  };

  // Return the scraper object conforming to the Scraper interface
  return {
    scrape,
  };
}; 