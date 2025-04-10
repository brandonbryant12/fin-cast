import OpenAI from 'openai';
import type { TTSService, TtsOptions, VoiceInfo } from '../types';

/**
 * Configuration options specifically for the OpenAI TTS provider.
 */
interface OpenAITtsOptions extends TtsOptions {
  apiKey?: string; // Allow overriding the default API key from env
  model?: 'tts-1' | 'tts-1-hd';
}

/**
 * List of known voices for OpenAI TTS.
 * Based on OpenAI documentation as of late 2023/early 2024.
 * This could potentially be fetched dynamically if OpenAI provides an API endpoint for it in the future.
 */
const OPENAI_VOICES: VoiceInfo[] = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'nova', name: 'Nova' },
  { id: 'shimmer', name: 'Shimmer' },
];

/**
 * Implementation of the ITtsService interface for OpenAI's Text-to-Speech API.
 */
export class OpenAITtsService implements TTSService {
  private openai: OpenAI;
  private defaultModel: 'tts-1' | 'tts-1-hd';

  constructor(options?: OpenAITtsOptions) {
    // API key MUST be provided in options.
    const apiKey = options?.apiKey;
    if (!apiKey) {
      // throw new Error('OpenAI API key is required. Provide it via OPENAI_API_KEY environment variable or in options.');
      throw new Error('OpenAI API key is required. Provide it in the options object.');
    }
    this.openai = new OpenAI({ apiKey });
    this.defaultModel = options?.model ?? 'tts-1'; // Default to standard model
  }

  /**
   * Synthesizes text into speech using the OpenAI API.
   *
   * @param text The text to synthesize.
   * @param options Options including voice, format, speed, and model.
   * @returns A Promise resolving to a Buffer containing the audio data.
   */
  async synthesize(text: string, options?: OpenAITtsOptions): Promise<Buffer> {
    try {
      const response = await this.openai.audio.speech.create({
        model: options?.model ?? this.defaultModel,
        voice: options?.voice ?? 'alloy', // Default voice
        input: text,
        response_format: options?.format ?? 'mp3',
        speed: options?.speed ?? 1.0,
      });

      // The response body is a ReadableStream. Convert it to a Buffer.
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error synthesizing speech with OpenAI:', error);
      // Consider more specific error handling/re-throwing
      throw new Error('Failed to synthesize speech with OpenAI.');
    }
  }

  /**
   * Retrieves the list of available voices for OpenAI TTS.
   *
   * @returns A Promise resolving to an array of VoiceInfo objects.
   */
  async getVoices(): Promise<VoiceInfo[]> {
    // OpenAI currently does not have an API endpoint to list voices dynamically.
    // Return the known list.
    return Promise.resolve(OPENAI_VOICES);
  }
} 