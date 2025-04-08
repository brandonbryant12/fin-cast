import { Command } from 'commander';
import { logger } from './config/logger';
import { scrape, ScraperError } from './scraper';

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ err: reason, promise }, 'Unhandled Rejection at Promise');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception thrown');
  process.exit(1);
});

const program = new Command();

program
  .name('scrape-cli')
  .description('CLI tool to scrape HTML content from a URL')
  .version('0.1.0');

program
  .argument('<url>', 'The URL to scrape')
  .option('-t, --timeout <milliseconds>', 'Request timeout in milliseconds', '15000')
  .action(async (url: string, options: { timeout: string }) => {
    const timeoutMs = parseInt(options.timeout, 10);
    if (isNaN(timeoutMs)) {
      logger.error({ providedTimeout: options.timeout }, 'Invalid timeout value provided. Using default.');
    }

    logger.info({ url, timeout: isNaN(timeoutMs) ? 15000 : timeoutMs }, 'Starting scrape via CLI');

    try {
      const html = await scrape(url, { timeout: isNaN(timeoutMs) ? undefined : timeoutMs });
      // Log the first 500 characters as info, or consider logging to a file for full content
      logger.info({ url, length: html.length, preview: html.substring(0, 500) + '...' }, 'Scrape successful');
      // Alternatively, print directly to stdout if that's the desired behavior:
      // console.log(html);
    } catch (error) {
      if (error instanceof ScraperError) {
        logger.error({
          msg: 'Scraping failed',
          url: error.url,
          statusCode: error.statusCode,
          originalError: error.originalError instanceof Error ? error.originalError.message : String(error.originalError),
          err: error
        }, error.message);
      } else {
        logger.error({ url, err: error }, 'An unexpected error occurred during CLI scrape');
      }
      process.exitCode = 1; // Indicate failure
    }
  });

program.parse(process.argv); 