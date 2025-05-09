import { Command } from 'commander';
import { createScraper } from './scraper';

process.on('unhandledRejection', (reason, promise) => {
  console.error({ err: reason, promise }, 'Unhandled Rejection at Promise');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error({ err: error }, 'Uncaught Exception thrown');
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
  .action(async (url: string, options: { timeout: string /*, proxy?: string */ }) => {
    const timeoutMs = parseInt(options.timeout, 10);
    if (isNaN(timeoutMs)) {
      console.error({ providedTimeout: options.timeout }, 'Invalid timeout value provided. Using default.');
    }
    const effectiveTimeout = isNaN(timeoutMs) ? 15000 : timeoutMs;

    console.info({ url, timeout: effectiveTimeout }, 'Starting scrape via CLI');

    const scraper = createScraper();

    try {
      const html = await scraper.scrape(url);
      console.info({ url, length: html.length, preview: html.substring(0, 500) + '...' }, 'Scrape successful');
      console.log(html);
    } catch (error) {
      console.error({ url, err: error }, 'An unexpected error occurred during CLI scrape');
      process.exitCode = 1;
    }
  });

program.parse(process.argv); 