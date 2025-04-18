# @repo/webscraper

A reusable package within the monorepo for fetching and extracting the main text content of web pages.
It uses `axios` for robust HTTP/S requests, `cheerio` for basic HTML parsing and cleaning,
and includes support for enterprise environments (e.g., through HTTP/HTTPS proxies).

## Features

- Fetches HTML content from a given URL using `axios`.
- Parses HTML using `cheerio` to extract meaningful text content.
- Removes common non-content elements (scripts, styles, navs, footers, etc.).
- Cleans up whitespace for better readability.
- Returns the cleaned text content of the page.
- Supports optional proxy configuration.
- Supports custom headers and request timeouts.
- Provides a custom `ScraperError` for detailed error handling.
- Integrated logging using `@repo/logger` (or fallback to `console`).

## Installation

This package is intended for internal use within the monorepo. Ensure it's listed as a dependency
in the `package.json` of the consuming application/package (e.g., `apps/server`):

```json
"dependencies": {
  "@repo/webscraper": "workspace:*"
}
```

Then run `pnpm install` from the monorepo root.

## Usage

Import the `scrape` function and optionally the `ScraperError` and `ScraperOptions` types.

```typescript
import { scrape, ScraperError, type ScraperOptions } from '@repo/webscraper';
import { logger } from './path/to/your/logger'; // Assuming logger in consuming app

async function fetchPage(url: string) {
  const options: ScraperOptions = {
    timeout: 20000, // 20 seconds timeout
    // logger: logger, // Optionally pass your logger instance
    // Example proxy configuration (read from environment variables or config)
    /*
    proxy: {
      protocol: 'http', // or 'https'
      host: 'proxy.example.com',
      port: 8080,
      auth: {
        username: process.env.PROXY_USER,
        password: process.env.PROXY_PASSWORD,
      }
    }
    */
  };

  try {
    logger.info({ url }, 'Attempting to scrape URL');
    const html = await scrape(url, options);
    logger.info({ url, length: html.length }, 'Successfully scraped URL');
    // Process the extracted text content
    console.log(html.substring(0, 500));
  } catch (error) {
    if (error instanceof ScraperError) {
      // Handle specific scraping errors
      logger.error({
        msg: 'Scraping failed',
        url: error.url,
        statusCode: error.statusCode,
        originalError: error.originalError?.message, // Log underlying error message
        errorStack: error.stack, // Include stack trace
      }, error.message);
    } else {
      // Handle other unexpected errors
      logger.error({ url, error }, 'An unexpected error occurred');
    }
    // Additional error handling logic (e.g., retry, return error response)
  }
}

// Example usage:
fetchPage('https://example.com');
```

## API

### `scrape(url: string, options?: ScraperOptions): Promise<string>`

- **`url`**: The URL of the page to scrape.
- **`options`**: Optional configuration object (`ScraperOptions`).
  - **`proxy`**: Axios proxy configuration object (`protocol`, `host`, `port`, optional `auth`).
  - **`headers`**: An object containing custom request headers.
  - **`timeout`**: Request timeout in milliseconds (default: 15000).
  - **`logger`**: An optional logger instance compatible with `@repo/logger`'s `AppLogger` type. If not provided, logs will be sent to the `console`.
- **Returns**: A promise that resolves with the page's cleaned text content as a string.
- **Throws**: A `ScraperError` if the request fails (network error, non-2xx status code, timeout).

### `ScraperError`

A custom error class extending `Error` with additional properties:

- **`url`**: The URL that failed to scrape.
- **`statusCode`**: The HTTP status code received (if available).
- **`originalError`**: The underlying error object (e.g., from Axios or AbortController).
- **`logger`**: An optional logger instance (`AppLogger`).

### `ScraperOptions`

An interface defining the optional configuration for the `scrape` function (see above).

## Logging

This package uses `@repo/logger` if a logger instance is provided via `ScraperOptions`, otherwise it falls back to the standard `console`. Logs are automatically tagged with `serviceName: 'webscraper'`.
The log level can be controlled via the `LOG_LEVEL` environment variable (defaults to `info`) when using the default `@repo/logger`.
Pretty printing is enabled when `NODE_ENV` is set to `development`. 