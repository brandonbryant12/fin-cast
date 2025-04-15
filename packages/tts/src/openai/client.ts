import OpenAI from 'openai';
import type { TTSProvider, TTSService, TtsOptions, Voice } from '../types';

interface OpenAITtsOptions extends TtsOptions {
  apiKey: string;
  model?: 'tts-1' | 'tts-1-hd';
}

export class OpenAITtsService implements TTSService {
  private openai: OpenAI;
  private defaultModel: 'tts-1' | 'tts-1-hd';
  private defaultVoice = 'alloy';
  private voices = ['onyx', 'shimmer','nova', 'alloy', 'fable', 'echo' ] as Voice[];


  constructor(options?: OpenAITtsOptions) {
    const apiKey = options?.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Provide it in the options object.');
    }
    this.openai = new OpenAI({ apiKey });
    this.defaultModel = options?.model ?? 'tts-1';
  }

  getProvider(): TTSProvider {
    return 'openai';
  }

  async synthesize(text: string, options?: OpenAITtsOptions): Promise<Buffer> {
    const targetVoice = options?.voice ?? this.defaultVoice;
    try {
      const response = await this.openai.audio.speech.create({
        model: options?.model ?? this.defaultModel,
        voice: targetVoice,
        input: text,
        response_format: options?.format ?? 'mp3',
        speed: options?.speed ?? 1.0,
      });

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error synthesizing speech with OpenAI:', error);
      throw new Error('Failed to synthesize speech with OpenAI.');
    }
  }
  async getAvailableVoices(): Promise<Voice[]> {
    return this.voices;
  }
}