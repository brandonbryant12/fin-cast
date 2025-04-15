import sdk from 'microsoft-cognitiveservices-speech-sdk';
import type { TTSProvider, TTSService, TtsOptions, Voice } from '../types';

interface AzureTtsOptions extends TtsOptions {
  speechKey: string;
  wsUrl: string;
  region?: string;
}

export class MicrosoftAzureTtsService implements TTSService {
  private speechKey: string;
  private wsUrl: string;
  private region: string;
  private voices: Voice[] = [
    'en-US-JennyNeural',
    'en-US-GuyNeural',
    'en-GB-LibbyNeural',
    'en-GB-RyanNeural',
    'en-AU-NatashaNeural',
    'en-IN-NeerjaNeural'
  ];

  constructor(options: AzureTtsOptions) {
    if (!options.speechKey) throw new Error('Azure speechKey is required');
    if (!options.wsUrl) throw new Error('Azure wsUrl is required');
    this.speechKey = options.speechKey;
    this.wsUrl = options.wsUrl;
    this.region = options.region || 'eastus2';
  }

  getProvider(): TTSProvider {
    return 'azure';
  }

  async synthesize(text: string, options?: TtsOptions): Promise<Buffer> {
    const voice: string = typeof options?.voice === 'string' ? options.voice : (this.voices[0] ?? 'en-US-JennyNeural');
    const format = options?.format || 'mp3';
    const speed = options?.speed || 1.0;

    const speechConfig = sdk.SpeechConfig.fromEndpoint(new URL(this.wsUrl), this.speechKey);
    speechConfig.speechSynthesisVoiceName = voice;
    speechConfig.speechSynthesisOutputFormat =
      format === 'mp3'
        ? sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        : sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
    // Note: Only mp3 and pcm are mapped here for simplicity

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const ssml = `
      <speak version='1.0' xml:lang='en-US'>
        <voice name='${voice}'>
          <prosody rate='${speed}'>${text}</prosody>
        </voice>
      </speak>
    `;

    return new Promise<Buffer>((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        result => {
          synthesizer.close();
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(Buffer.from(result.audioData));
          } else {
            reject(new Error('Speech synthesis failed: ' + result.errorDetails));
          }
        },
        error => {
          synthesizer.close();
          reject(error);
        }
      );
    });
  }

  async getAvailableVoices(): Promise<Voice[]> {
    return this.voices;
  }
}
