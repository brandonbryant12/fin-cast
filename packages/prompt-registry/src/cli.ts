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
  .command('create <promptKey> <version>')
  .description('Create a new prompt')
  .requiredOption('--template-file <file>', 'Path to template file')
  .requiredOption('--input-schema <file>', 'Path to JSON input schema file')
  .requiredOption('--output-schema <file>', 'Path to JSON output schema file')
  .requiredOption('--instructions <text>', 'User instructions text')
  .requiredOption('--temperature <number>', 'Temperature')
  .requiredOption('--maxTokens <number>', 'Max tokens')
  .option('--activate', 'Activate this version', false)
  .action(async (promptKey, version, opts) => {
    const template = await fs.readFile(opts.templateFile, 'utf8');
    const inputSchema = JSON.parse(await fs.readFile(opts.inputSchema, 'utf8'));
    const outputSchema = JSON.parse(await fs.readFile(opts.outputSchema, 'utf8'));

    const temperature = parseFloat(opts.temperature as string);
    const maxTokens = parseInt(opts.maxTokens as string, 10);

    const fields = {
      promptKey,
      version,
      template,
      inputSchema,
      outputSchema,
      userInstructions: opts.instructions,
      temperature: temperature.toString(),
      maxTokens,
      activate: opts.activate,
    };

    const created = await registry.create(fields);
    console.log('Created prompt version:', created);
    process.exit(0);
  });

program
  .command('update <promptKey> <version>')
  .description('Update instructions, maxTokens or temperature')
  .option('--instructions <text>')
  .option('--temperature <number>', 'New temperature')
  .option('--maxTokens <number>', 'New max tokens')
  .action(async (promptKey, version, opts) => {
    const fields: Record<string, unknown> = {};
    if (opts.instructions) fields.userInstructions = opts.instructions;
    if (opts.temperature !== undefined) fields.temperature = parseFloat(opts.temperature as string);
    if (opts.maxTokens !== undefined) fields.maxTokens = parseInt(opts.maxTokens as string, 10);

    if (Object.keys(fields).length === 0) {
      console.error('Nothing to update');
      process.exit(1);
    }

    await db
      .update(promptDefinition)
      .set(fields)
      .where(and(eq(promptDefinition.promptKey, promptKey), eq(promptDefinition.version, version)));
    console.log('Updated prompt', promptKey, version);
    process.exit(0);
  });

program
  .command('compile <promptKey>')
  .description('Compile a prompt using provided placeholders JSON')
  .option('--version <version>', 'Specific version; defaults to active')
  .requiredOption('--placeholders <json>', 'JSON string with placeholders')
  .action(async (promptKey, options) => {
    const version = options.version ?? 'active';
    const placeholders = JSON.parse(options.placeholders);
    const prompt = await registry.get(promptKey, version);
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