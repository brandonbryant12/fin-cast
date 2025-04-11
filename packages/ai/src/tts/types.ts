import { PersonalityId, type PersonalityInfo } from './personalities';

export interface TtsOptions {
  personality?: PersonalityId;
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
}

export interface TTSService {
  synthesize(text: string, options?: TtsOptions): Promise<Buffer>;
  getAvailablePersonalities(): Promise<PersonalityInfo[]>;
}

export interface TtsFactoryConfig {
  provider: 'openai';
  options?: Record<string, any>;
}