import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import type { TTSService, TtsOptions } from '../types';
import { personalities as allPersonalities, PersonalityId, type PersonalityInfo } from '../personalities';

// Get the directory path in an ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    [PersonalityId.Sam]: 'alloy',
    [PersonalityId.Evelyn]: 'fable',
    [PersonalityId.David]: 'echo',
  };
  private defaultVoice = 'alloy';

  private loadedPersonalityInfo: PersonalityInfo[] | null = null;
  private initializationPromise: Promise<void>;

  constructor(options?: OpenAITtsOptions) {
    const apiKey = options?.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Provide it in the options object.');
    }
    this.openai = new OpenAI({ apiKey });
    this.defaultModel = options?.model ?? 'tts-1';

    // Start initialization, store the promise
    this.initializationPromise = this._initializePersonalities();
    // Handle potential initialization errors globally or let individual methods handle them
    this.initializationPromise.catch(error => {
        console.error("Failed to initialize OpenAITtsService:", error);
        // Depending on desired behavior, you might want to re-throw or handle differently
    });
  }

  // New method for async initialization
  private async _initializePersonalities(): Promise<void> {
    const supportedIds = Object.keys(this.personalityToVoiceMap) as PersonalityId[];
    const supportedBasePersonalities = allPersonalities.filter(p => supportedIds.includes(p.id));

    const previewsDir = path.resolve(__dirname, 'previews');
    console.log(`Initializing personalities - Reading previews from: ${previewsDir}`);

    const finalPersonalityInfoPromises = supportedBasePersonalities.map(async (p): Promise<PersonalityInfo> => {
      const previewFilePath = path.join(previewsDir, `${p.id}.mp3`);
      let previewUrl: string | undefined = undefined;

      try {
        // Read the file content as a binary buffer
        const audioBuffer = await fs.readFile(previewFilePath);
        // Convert buffer to base64 string
        const base64String = audioBuffer.toString('base64');
        // Construct the data URI
        previewUrl = `data:audio/mp3;base64,${base64String}`;
        console.log(`Successfully loaded and encoded preview for ${p.name}`);
      } catch (error: any) {
        // Log and re-throw specific errors for missing files or other read errors
        if (error.code === 'ENOENT') {
          console.error(`Preview file not found for ${p.name}: ${previewFilePath}`);
          throw new Error(`Preview file not found for ${p.name}: ${previewFilePath}`);
        } else {
          console.error(`Error reading preview file for ${p.name} (${previewFilePath}):`, error);
          // Re-throw the original error or a wrapped one
          throw new Error(`Failed to read preview file for ${p.name} (${previewFilePath}): ${error.message}`);
        }
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        previewPhrase: p.previewPhrase,
        previewAudioUrl: previewUrl, // This will always be defined if no error was thrown
      };
    });

    // Wait for all file reads and conversions to complete. If any promise rejects, Promise.all rejects.
    const finalPersonalityInfo = await Promise.all(finalPersonalityInfoPromises);

    // Cache the result only if all promises resolved successfully
    this.loadedPersonalityInfo = finalPersonalityInfo;
    console.log('Personalities initialized successfully.');
  }

  async synthesize(text: string, options?: OpenAITtsOptions): Promise<Buffer> {
    // Ensure initialization is complete before proceeding
    await this.initializationPromise;

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
    // Ensure initialization is complete
    await this.initializationPromise;

    // Return cached data if available and initialization succeeded
    if (this.loadedPersonalityInfo) {
      return this.loadedPersonalityInfo;
    }

    // This should theoretically not be reached if initializationPromise resolved,
    // but serves as a safeguard.
    throw new Error('TTS Personalities failed to initialize properly.');
  }
}