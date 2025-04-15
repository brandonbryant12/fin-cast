
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import type { ChatOptions, ChatResponse } from './types';
import { createLLMService } from './index';

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
  .name('llm-cli')
  .description('CLI tool to interact with AI services (TTS, LLM)')
  .version('0.1.0');

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