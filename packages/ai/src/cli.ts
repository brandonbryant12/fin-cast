import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import playSound from 'play-sound';
import type { TtsOptions, LLMServiceConfig, ChatOptions, ChatResponse } from './index';
import { createTtsService, createLLMService } from './index';

dotenv.config();

function ensureApiKey(envVar = 'OPENAI_API_KEY'): string {
  // eslint-disable-next-line no-restricted-properties
  const apiKey = process.env[envVar];
  if (!apiKey) {
    console.error(`Error: Environment variable ${envVar} is not set.`);
    process.exit(1);
  }
  return apiKey;
}

// --- Main Program --- 
const program = new Command();

program
  .name('ai-cli')
  .description('CLI tool to interact with AI services (TTS, LLM)')
  .version('0.1.0');

// --- TTS Subcommand --- 
const ttsCommand = program.command('tts')
  .description('Text-to-Speech operations');

interface TtsSynthesizeOptions {
  voice: string;
  model: 'tts-1' | 'tts-1-hd';
  format: string;
  speed: string;
  output?: string;
}

ttsCommand
  .command('synthesize <text>')
  .description('Synthesize text and play it, or save to an audio file')
  .option('--voice <voice>', 'Voice model to use (e.g., alloy, nova)', 'alloy')
  .option('--model <model>', 'TTS model (e.g., tts-1, tts-1-hd)', 'tts-1')
  .option('--format <format>', 'Audio format (e.g., mp3, opus)', 'mp3')
  .option('--speed <speed>', 'Speech speed (0.25 to 4.0)', '1.0')
  .option('-o, --output <file>', 'Save audio to file instead of playing')
  .action(async (text: string, options: TtsSynthesizeOptions) => {
    ensureApiKey();
    const player = playSound({});
    let tempFilePath: string | null = null;

    console.log(options.output ? `Synthesizing text to ${options.output}...` : 'Synthesizing text for playback...');

    try {
      const ttsService = createTtsService({ provider: 'openai' }); 
      const speed = parseFloat(options.speed);
      const format = options.format || 'mp3';

      const serviceOptions: TtsOptions = {
        voice: options.voice,
        format: format as any,
        speed: isNaN(speed) ? 1.0 : speed,
      };

      const audioBuffer = await ttsService.synthesize(text, serviceOptions);

      if (options.output) {
        await fs.writeFile(options.output, audioBuffer);
        console.log(`Successfully saved audio to ${path.resolve(options.output)}`);
      } else {
        const tempFileName = `ai-cli-tts-${crypto.randomBytes(6).toString('hex')}.${format}`;
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
  .command('list-voices')
  .description('List available voices for the TTS provider')
  .action(async () => {
    ensureApiKey();
    console.log('Fetching available voices...');
    try {
      const ttsService = createTtsService({ provider: 'openai' });
      const voices = await ttsService.getVoices();
      if (voices.length === 0) {
        console.log('No voices found for the provider.');
      } else {
        console.log('Available voices:');
        voices.forEach(v => console.log(` - ${v.name} (ID: ${v.id})`));
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
      process.exitCode = 1;
    }
  });

const llmCommand = program.command('llm')
  .description('Large Language Model operations');

interface LlmChatOptions {
  provider: 'openai' | 'gemini' | 'anthropic';
  model?: string;
}

llmCommand
  .command('chat <prompt>')
  .description('Send a prompt to the chat model')
  .option('--provider <provider>', 'LLM provider to use (openai, gemini, anthropic)', 'openai')
  .option('--model <model>', 'LLM model to use (optional, provider-specific)')
  .action(async (prompt: string, options: LlmChatOptions) => {
    const { provider, model } = options;
    let apiKeyEnvVar: string;
    let llmConfig: LLMServiceConfig;

    switch (provider) {
      case 'openai':
        apiKeyEnvVar = 'OPENAI_API_KEY';
        const openaiApiKey = ensureApiKey(apiKeyEnvVar);
        llmConfig = { provider: 'openai', options: { apiKey: openaiApiKey } };
        break;
      case 'gemini':
        apiKeyEnvVar = 'GEMINI_API_KEY';
        const geminiApiKey = ensureApiKey(apiKeyEnvVar);
        llmConfig = { provider: 'gemini', options: { apiKey: geminiApiKey } };
        break;
      case 'anthropic':
        apiKeyEnvVar = 'ANTHROPIC_API_KEY';
        console.error('Anthropic provider not yet implemented in CLI.');
        process.exit(1);
      default:
        console.error(`Unsupported LLM provider: ${provider}`);
        process.exit(1);
    }

    console.log(`Sending prompt to ${provider} LLM...`);

    try {
      const llmService = createLLMService(llmConfig);

      const chatOptions: ChatOptions = {};
      if (model) {
        chatOptions.model = model;
      }

      const response: ChatResponse = await llmService.chatCompletion(prompt, chatOptions);

      console.log("\nLLM Response:");
      console.log(response.content);

    } catch (error) {
      console.error(`Error interacting with ${provider} LLM:`, error);
      process.exitCode = 1;
    }
  });

program.parse(process.argv); 