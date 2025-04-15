export interface TtsOptions {
  voice?: string;
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number;
}

export type Voice = string

export interface TTSService {
  synthesize(text: string, options?: TtsOptions): Promise<Buffer>;
  getAvailableVoices(): Promise<Voice[]>;
  getProvider(): TTSProvider;
}


export type TTSProvider = 'openai' | 'azure';

export interface OpenAITtsFactoryConfig {
  provider: 'openai',
  options: {
    apiKey: string;
    model?: 'tts-1' | 'tts-1-hd';
  };
}

export interface AzureTtsFactoryConfig {
  provider: 'azure',
  options: {
    speechKey: string;
    wsUrl: string;
    region?: string; // default to eastus2
  };
}

export type TtsFactoryConfig = OpenAITtsFactoryConfig | AzureTtsFactoryConfig;