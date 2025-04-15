import type { TTSService, TtsFactoryConfig } from './types';
import { MicrosoftAzureTtsService } from './microsoft-azure/client';
import { OpenAITtsService } from './openai/client';

/**
 * Creates an instance of a TTS service based on the provided configuration.
 *
 * @param config Configuration specifying the provider and options.
 * @returns An instance of ITtsService.
 * @throws Error if the specified provider is not supported.
 */
export function createTtsService(config: TtsFactoryConfig): TTSService {
  switch (config.provider) {
    case 'openai':
      return new OpenAITtsService(config.options);
    case 'azure':
      return new MicrosoftAzureTtsService(config.options);
    default: {
      // TypeScript exhaustive check
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = config;
      throw new Error(`Unsupported TTS provider: ${(config as any).provider}`);
    }
  }
} 