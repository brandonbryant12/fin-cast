import { Command } from 'commander';
import { scrape, ScraperError } from './scraper';

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
  // Add options for proxy if needed by the CLI, reading from env vars or flags
  // .option('-p, --proxy <proxy_url>', 'HTTP/HTTPS proxy URL')
  .action(async (url: string, options: { timeout: string /*, proxy?: string */ }) => {
    const timeoutMs = parseInt(options.timeout, 10);
    if (isNaN(timeoutMs)) {
      console.error({ providedTimeout: options.timeout }, 'Invalid timeout value provided. Using default.');
    }
    const effectiveTimeout = isNaN(timeoutMs) ? 15000 : timeoutMs;

    // Basic proxy parsing example (improve as needed)
    // let proxyConfig: ScraperOptions['proxy'];
    // if (options.proxy) {
    //   try {
    //     const proxyUrl = new URL(options.proxy);
    //     proxyConfig = {
    //       protocol: proxyUrl.protocol.slice(0, -1), // remove ':'
    //       host: proxyUrl.hostname,
    //       port: parseInt(proxyUrl.port, 10),
    //       // Add auth parsing if necessary
    //     };
    //     logger.info({ proxy: { host: proxyUrl.hostname, port: proxyUrl.port } }, 'Using proxy via CLI option');
    //   } catch (e) {
    //     logger.error({ proxyInput: options.proxy, err: e }, 'Invalid proxy URL provided via CLI');
    //     process.exit(1);
    //   }
    // }

    console.info({ url, timeout: effectiveTimeout }, 'Starting scrape via CLI');

    try {
      const html = await scrape(url, {
        timeout: effectiveTimeout,
        // proxy: proxyConfig
      });
      console.info({ url, length: html.length, preview: html.substring(0, 500) + '...' }, 'Scrape successful');
      console.log(html);
    } catch (error) {
      if (error instanceof ScraperError) {
        console.error({
          msg: 'Scraping failed',
          url: error.url,
          statusCode: error.statusCode,
          originalError: error.originalError instanceof Error ? error.originalError.message : String(error.originalError),
          err: error
        }, error.message);
      } else {
        console.error({ url, err: error }, 'An unexpected error occurred during CLI scrape');
      }
      process.exitCode = 1;
    }
  });

program.parse(process.argv); 