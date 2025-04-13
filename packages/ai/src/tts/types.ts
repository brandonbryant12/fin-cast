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


export type TTSProvider = 'openai' 

interface OpenAITtsFactoryConfig {
  provider: TTSProvider,
  options: {
    apiKey: string;
    model?: 'tts-1' | 'tts-1-hd';
  };
}

export type TtsFactoryConfig = OpenAITtsFactoryConfig; // | GoogleTtsFactoryConfig | ... etc.