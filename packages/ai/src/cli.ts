import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import playSound from 'play-sound';
import type { TtsOptions, ChatOptions, ChatResponse } from './index';
import { createTtsService, createLLMService, PersonalityId, personalities as allPersonalities } from './index';

// Get directory path in ESM
const currentFilePath = import.meta.url ? fileURLToPath(import.meta.url) : '';
const currentDirPath = currentFilePath ? path.dirname(currentFilePath) : '';

dotenv.config({ path: path.resolve(currentDirPath, '../.env') });

function ensureApiKey(envVar = 'OPENAI_API_KEY'): string {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    console.error(`Error: Environment variable ${envVar} is not set.`);
    process.exit(1);
  }
  return apiKey;
}

function getProviderConfig(provider: string): { apiKeyEnvVar: string, serviceConfig: any } {
  const providerConfigs = {
    'openai': {
      apiKeyEnvVar: 'OPENAI_API_KEY',
      serviceConfig: (apiKey: string, model?: string) => ({
        provider: 'openai',
        options: { apiKey, ...(model ? { model } : {}) }
      })
    },
    'gemini': {
      apiKeyEnvVar: 'GEMINI_API_KEY',
      serviceConfig: (apiKey: string) => ({
        provider: 'gemini',
        options: { apiKey }
      })
    },
    'anthropic': {
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      serviceConfig: (apiKey: string) => ({
        provider: 'anthropic',
        options: { apiKey }
      })
    }
  };

  const config = providerConfigs[provider as keyof typeof providerConfigs];
  if (!config) {
    console.error(`Unsupported provider: ${provider}`);
    process.exit(1);
  }
  
  return config;
}

const program = new Command();

program
  .name('ai-cli')
  .description('CLI tool to interact with AI services (TTS, LLM)')
  .version('0.1.0');

const ttsCommand = program.command('tts')
  .description('Text-to-Speech operations');

interface TtsSynthesizeOptions {
  voice: string;
  model: string;
  format: string;
  speed: string;
  output?: string;
  provider: string;
}

ttsCommand
  .command('synthesize <text>')
  .description('Synthesize text and play it, or save to an audio file')
  .option('--voice <voice>', 'Voice model to use (e.g., alloy, nova)', 'alloy')
  .option('--model <model>', 'TTS model (e.g., tts-1, tts-1-hd)', 'tts-1')
  .option('--speed <speed>', 'Speech speed (0.25 to 4.0)', '1.0')
  .option('--provider <provider>', 'TTS provider to use', 'openai')
  .option('-o, --output <file>', 'Save audio to file instead of playing')
  .action(async (text: string, options: TtsSynthesizeOptions) => {
    const { apiKeyEnvVar, serviceConfig } = getProviderConfig(options.provider);
    const apiKey = ensureApiKey(apiKeyEnvVar);
    const player = playSound({});
    let tempFilePath: string | null = null;

    console.log(options.output ? `Synthesizing text to ${options.output}...` : 'Synthesizing text for playback...');

    try {
      const ttsService = createTtsService(serviceConfig(apiKey, options.model));
      const speed = parseFloat(options.speed);

      const serviceOptions: TtsOptions = {
        personality: PersonalityId.Arthur,
        format: 'mp3',
        speed: isNaN(speed) ? 1.0 : speed,
      };

      const audioBuffer = await ttsService.synthesize(text, serviceOptions);

      if (options.output) {
        await fs.writeFile(options.output, audioBuffer);
        console.log(`Successfully saved audio to ${path.resolve(options.output)}`);
      } else {
        const tempFileName = `ai-cli-tts-${crypto.randomBytes(6).toString('hex')}.${'mp3'}`;
        tempFilePath = path.join(os.tmpdir(), tempFileName);
        await fs.writeFile(tempFilePath, audioBuffer);
        console.log('Playing audio...');
        
        await new Promise<void>((resolve, reject) => {
          player.play(tempFilePath!, (err) => {
            if (err) {
              console.error(`Error playing audio file ${tempFilePath}:`, err);
              reject(err);
            } else {
              console.log('Playback finished.');
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error('Error during TTS synthesis or playback:', error);
      process.exitCode = 1;
    } finally {
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error(`Failed to clean up temporary file ${tempFilePath}:`, cleanupError);
        }
      }
    }
  });

ttsCommand
  .command('list-personalities')
  .description('List available voices for the TTS provider')
  .option('--provider <provider>', 'TTS provider to use', 'openai')
  .action(async (options: { provider: string }) => {
    const { apiKeyEnvVar, serviceConfig } = getProviderConfig(options.provider);
    const apiKey = ensureApiKey(apiKeyEnvVar);
    console.log('Fetching available voices...');
    try {
      const ttsService = createTtsService(serviceConfig(apiKey));
      const personalities = await ttsService.getAvailablePersonalities();
      if (personalities.length === 0) {
        console.log('No voices found for the provider.');
      } else {
        console.log('Available voices:');
        personalities.forEach(v => console.log(` - ${v.name} (ID: ${v.id}) ${v.previewPhrase ? '[Has Phrase]' : ''}`));
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
      process.exitCode = 1;
    }
  });

ttsCommand
  .command('generate-previews')
  .description('Generate audio preview snippets and save as MP3 files')
  .option('--provider <provider>', 'TTS provider to use', 'openai')
  .option('--format <format>', 'Audio format for previews', 'mp3')
  .action(async (options: { provider: string, format: string }) => {
    const { provider, format } = options;
    const { apiKeyEnvVar, serviceConfig } = getProviderConfig(provider);
    const apiKey = ensureApiKey(apiKeyEnvVar);

    const previewsDir = path.resolve(currentDirPath, `tts/${provider}/previews`);

    try {
      await fs.mkdir(previewsDir, { recursive: true });
      console.log(`Ensured preview directory exists: ${previewsDir}`);
    } catch (error) {
      console.error(`Failed to create preview directory ${previewsDir}:`, error);
      process.exitCode = 1;
      return;
    }

    console.log(`Starting audio preview generation for ${provider}...`);
    console.log(`Outputting MP3 files to: ${previewsDir}`);

    const ttsService = createTtsService(serviceConfig(apiKey));

    let hasError = false;
    const personalityIdsToProcess = allPersonalities.map(p => p.id);

    for (const personality of allPersonalities) {
      if (!personality.previewPhrase) {
        console.warn(`Skipping ${personality.name} (${personality.id}): No preview phrase defined.`);
        continue;
      }

      const outputFilePath = path.join(previewsDir, `${personality.id}.${format}`);
      console.log(`Generating preview for ${personality.name} (${personality.id}) -> ${outputFilePath}...`);

      try {
        const audioBuffer = await ttsService.synthesize(personality.previewPhrase, {
          personality: personality.id,
          format: format as 'mp3',
        });
        await fs.writeFile(outputFilePath, audioBuffer);
        console.log(` -> Successfully saved preview for ${personality.name} to ${outputFilePath}.`);
      } catch (error) {
        console.error(` -> Failed to generate or save preview for ${personality.name}:`, error instanceof Error ? error.message : error);
        hasError = true;
      }
    }

    console.log("\nPreview generation complete.");
    if (hasError) {
      console.warn("Errors occurred during generation. Check logs above for details.");
      process.exitCode = 1;
    } else {
      console.log("All previews generated successfully.");
    }
  });

const llmCommand = program.command('llm')
  .description('Large Language Model operations');

interface LlmChatOptions {
  provider: string;
  model?: string;
}

llmCommand
  .command('chat <prompt>')
  .description('Send a prompt to the chat model')
  .option('--provider <provider>', 'LLM provider to use (openai, gemini, anthropic)', 'openai')
  .option('--model <model>', 'LLM model to use (optional, provider-specific)')
  .action(async (prompt: string, options: LlmChatOptions) => {
    const { provider, model } = options;
    
    try {
      const { apiKeyEnvVar, serviceConfig } = getProviderConfig(provider);
      const apiKey = ensureApiKey(apiKeyEnvVar);
      
      console.log(`Sending prompt to ${provider} LLM...`);
      
      const llmService = createLLMService(serviceConfig(apiKey, model));
      const chatOptions: ChatOptions = model ? { model } : {};
      const response: ChatResponse = await llmService.chatCompletion(prompt, chatOptions);

      console.log("\nLLM Response:");
      console.log(response.content);
    } catch (error) {
      console.error(`Error interacting with ${provider} LLM:`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);