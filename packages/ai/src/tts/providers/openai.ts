import OpenAI from 'openai';
import type { TTSService, TtsOptions } from '../types';
import { PersonalityId, personalities as allPersonalities, type PersonalityInfo } from '../personalities';

interface OpenAITtsOptions extends TtsOptions {
  apiKey?: string;
  model?: 'tts-1' | 'tts-1-hd';
}

export class OpenAITtsService implements TTSService {
  private openai: OpenAI;
  private defaultModel: 'tts-1' | 'tts-1-hd';
  private personalityToVoiceMap: Record<PersonalityId, string> = {
    [PersonalityId.Arthur]: 'onyx',
    [PersonalityId.Chloe]: 'shimmer',
    [PersonalityId.Maya]: 'nova',
    [PersonalityId.Samuel]: 'alloy',
    [PersonalityId.Evelyn]: 'fable',
    [PersonalityId.David]: 'echo',
  };
  private defaultVoice = 'alloy';

  constructor(options?: OpenAITtsOptions) {
    const apiKey = options?.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Provide it in the options object.');
    }
    this.openai = new OpenAI({ apiKey });
    this.defaultModel = options?.model ?? 'tts-1';
  }

  async synthesize(text: string, options?: OpenAITtsOptions): Promise<Buffer> {
    const requestedPersonality = options?.personality;
    let targetVoice = this.defaultVoice;

    if (requestedPersonality) {
      const mappedVoice = this.personalityToVoiceMap[requestedPersonality];
      if (mappedVoice) {
        targetVoice = mappedVoice;
      } else {
         console.warn(`Personality ${requestedPersonality} requested but no mapping found for OpenAI TTS. Using default voice ${this.defaultVoice}.`);
      }
    } else {
       console.warn(`No personality requested for OpenAI TTS. Using default voice ${this.defaultVoice}.`);
    }

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

  async getAvailablePersonalities(): Promise<PersonalityInfo[]> {
    const supportedIds = Object.keys(this.personalityToVoiceMap) as PersonalityId[];
    return Promise.resolve(
        allPersonalities.filter(p => supportedIds.includes(p.id))
    );
  }
}