import type { ITtsService, TtsFactoryConfig } from './types';
import { OpenAITtsService } from './providers/openai';

/**
 * Creates an instance of a TTS service based on the provided configuration.
 *
 * @param config Configuration specifying the provider and options.
 * @returns An instance of ITtsService.
 * @throws Error if the specified provider is not supported.
 */
export function createTtsService(config: TtsFactoryConfig): ITtsService {
  switch (config.provider) {
    case 'openai':
      // Pass providerOptions directly to the OpenAI service constructor
      // The OpenAITtsService constructor handles extracting relevant options
      return new OpenAITtsService(config.providerOptions);
    // Add cases for other providers here later
    // case 'google':
    //   return new GoogleTtsService(config.providerOptions);
    default:
      throw new Error(`Unsupported TTS provider: ${config.provider}`);
  }
} 