import type { TTSService, TtsFactoryConfig } from './types';
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
    default:
      throw new Error(`Unsupported TTS provider: ${config.provider}`);
  }
} 