import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createTtsService, type TTSProvider } from '@repo/tts'; 
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { openaiPersonalityMap } from './personalities/personalities';
import { personalities, PersonalityId } from './personalities/personalities';

const getDirname = (metaUrl: string): string => {
  const filename = fileURLToPath(metaUrl);
  return path.dirname(filename);
};

const currentDirPath = getDirname(import.meta.url);

const envPath = path.resolve(currentDirPath, '../../../.env');
dotenv.config({ path: envPath });

// Helper function to ensure API key is available
function ensureApiKey(envVar: string): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    console.error(`Error: Environment variable ${envVar} is not set.`);
    console.error(`Attempted to load .env file from: ${envPath}`);
    console.error('Please ensure the API key is defined in your .env file at the root of the monorepo.');
    process.exit(1);
  }
  return apiKey;
}

// --- Commander Setup ---
const program = new Command();

program
  .name('podcast-cli')
  .description('CLI tool for podcast package operations')
  .version('0.1.0');

program
  .command('generate-previews')
  .description('Generate audio preview snippets for personalities and save as MP3 files')
  .option('--provider <provider>', 'TTS provider to use', 'openai')
  .option('--format <format>', 'Audio format for previews', 'mp3')
  .action(async (options: { provider: string; format: string }) => {
    const { provider, format } = options;

    // --- Provider Validation and Setup ---
    let apiKey: string;
    let voiceMap: Record<PersonalityId, string>;
    let apiKeyEnvVar: string;

    if (provider.toLowerCase() === 'openai') {
      apiKeyEnvVar = 'OPENAI_API_KEY';
      apiKey = ensureApiKey(apiKeyEnvVar);
      voiceMap = openaiPersonalityMap;
    } else {
      console.error(`Error: Unsupported provider \'${provider}\'. Currently only \'openai\' is supported.`);
      process.exit(1);
    }

    const outputDir = path.resolve(currentDirPath, 'personalities', provider);

    try {
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`Ensured output directory exists: ${outputDir}`);
    } catch (error) {
      console.error(`Failed to create output directory ${outputDir}:`, error);
      process.exitCode = 1;
      return;
    }

    console.log(`\nStarting audio preview generation for ${provider}...`);
    console.log(`Outputting ${format.toUpperCase()} files to: ${outputDir}`);

    // --- TTS Service Instantiation ---
    const ttsService = createTtsService({ provider: provider as TTSProvider, options: { apiKey } });

    let hasError = false;

    // --- Generation Loop ---
    for (const personality of personalities) {
      if (!personality.previewPhrase) {
        console.warn(`Skipping ${personality.name}: No preview phrase defined.`);
        continue;
      }

      const voice = voiceMap[personality.name];
      if (!voice) {
        console.warn(`Skipping ${personality.name}: No voice mapping found for provider '${provider}'.`);
        continue;
      }

      const outputFilePath = path.join(outputDir, `${personality.name}.${format}`);
      console.log(`Generating preview for ${personality.name} (using voice '${voice}')...`);

      try {
        const audioBuffer = await ttsService.synthesize(personality.previewPhrase, {
          voice: voice,
          format: format as 'mp3' | 'opus' | 'aac' | 'flac', // Cast format, assuming it matches OpenAI's accepted types
          // Note: Speed option is available in OpenAI TTS but not specified in personality, using default.
        });
        await fs.writeFile(outputFilePath, audioBuffer);
        console.log(` -> Successfully saved preview for ${personality.name} to ${outputFilePath}.`);
      } catch (error) {
        console.error(` -> Failed to generate or save preview for ${personality.name}:`, error instanceof Error ? error.message : error);
        hasError = true;
      }
    }

    // --- Summary --- 
    console.log("\nPreview generation complete.");
    if (hasError) {
      console.warn("Errors occurred during generation. Check logs above for details.");
      process.exitCode = 1;
    } else {
      console.log("All previews generated successfully (or skipped where applicable).");
    }
  });

program.parse(process.argv); 