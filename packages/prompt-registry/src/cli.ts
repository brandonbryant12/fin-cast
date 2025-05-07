import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { createDb } from '@repo/db/client';
import { promptDefinition } from '@repo/db/schema';
import { eq, and } from 'drizzle-orm';
import { createPromptRegistry } from './registry';

const getDirname = (metaUrl: string): string => path.dirname(fileURLToPath(metaUrl));
const currentDir = getDirname(import.meta.url);
dotenv.config({ path: path.resolve(currentDir, '../../../.env') });

const ensureEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) {
    console.error(`Environment variable ${key} must be set`);
    process.exit(1);
  }
  return v;
};

const db = createDb({ databaseUrl: ensureEnv('SERVER_POSTGRES_URL') });
const registry = createPromptRegistry({ db });

const program = new Command()
  .name('prompt-registry-cli')
  .description('CLI for managing prompt definitions')
  .version('0.1.0');

program
  .command('create <promptKey>')
  .description('Create a new prompt version (version auto‑increments)')
  .requiredOption('--template-file <file>', 'Path to template file')
  .requiredOption('--input-schema <file>', 'Path to JSON input schema file')
  .requiredOption('--output-schema <file>', 'Path to JSON output schema file')
  .requiredOption('--instructions <text>', 'User instructions text')
  .requiredOption('--temperature <number>', 'Temperature')
  .requiredOption('--maxTokens <number>', 'Max tokens')
  .option('--activate', 'Activate this version', false)
  .action(async (promptKey, opts) => {
    const template = await fs.readFile(opts.templateFile, 'utf8');
    const inputSchema = JSON.parse(await fs.readFile(opts.inputSchema, 'utf8'));
    const outputSchema = JSON.parse(await fs.readFile(opts.outputSchema, 'utf8'));

    const temperature = parseFloat(opts.temperature as string);
    const maxTokens = parseInt(opts.maxTokens as string, 10);

    const fields = {
      template,
      inputSchema,
      outputSchema,
      userInstructions: opts.instructions,
      temperature,
      maxTokens,
      activate: opts.activate,
    };
    const created = await registry.createNewVersion(promptKey, fields);
    console.log('Created prompt version:', created);
    process.exit(0);
  });

program
  .command('compile <promptKey>')
  .description('Compile a prompt using provided placeholders JSON')
  .option('--version <version>', 'Specific version (integer) or "active"; defaults to active')
  .requiredOption('--placeholders <json>', 'JSON string with placeholders')
  .action(async (promptKey, options) => {
    let versionToGet: string | number = options.version ?? 'active';
    if (options.version && options.version !== 'active') {
      const parsedVersion = parseInt(options.version, 10);
      if (isNaN(parsedVersion) || parsedVersion < 1) {
        console.error('Specific version must be a positive integer or "active".');
        process.exit(1);
      }
      versionToGet = parsedVersion;
    }
    
    const placeholders = JSON.parse(options.placeholders);
    const prompt = await registry.get(promptKey);
    const runtime = (prompt as any).compile(placeholders);
    console.log(JSON.stringify(runtime.toMessages(), null, 2));
    process.exit(0);
  });

program
  .command('delete <promptKey>')
  .description('Delete a prompt and all its versions')
  .action(async (promptKey: string) => {
    await db.delete(promptDefinition).where(eq(promptDefinition.promptKey, promptKey));
    console.log('Deleted prompt', promptKey);
    process.exit(0);
  });

program.parse(process.argv);