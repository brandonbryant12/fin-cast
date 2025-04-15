import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { type TTSProvider } from "@repo/tts";

const getDirname = (metaUrl: string): string => {
  const filename = fileURLToPath(metaUrl);
  return path.dirname(filename);
};
const currentDirPath = getDirname(import.meta.url);

export enum PersonalityId {
  Arthur = 'Arthur',
  Chloe = 'Chloe',
  Maya = 'Maya',
  Sam = 'Sam',
  Evelyn = 'Evelyn',
  David = 'David',
}


export interface PersonalityInfo {
  name: PersonalityId;
  description: string;
  previewPhrase?: string;
  voiceName?: string; 
  previewAudioUrl?: string;
}

export const openaiPersonalityMap: Record<PersonalityId, string> = {
  [PersonalityId.Arthur]: 'echo',
  [PersonalityId.Chloe]: 'nova',  
  [PersonalityId.Maya]: 'shimmer',
  [PersonalityId.Sam]: 'alloy',
  [PersonalityId.Evelyn]: 'fable',
  [PersonalityId.David]: 'onyx',
};

export const azurePersonalityMap: Record<PersonalityId, string> = {
  [PersonalityId.Arthur]: 'en-US-GuyNeural',
  [PersonalityId.Chloe]: 'en-US-JennyNeural',
  [PersonalityId.Maya]: 'en-GB-LibbyNeural',
  [PersonalityId.Sam]: 'en-GB-RyanNeural',
  [PersonalityId.Evelyn]: 'en-AU-NatashaNeural',
  [PersonalityId.David]: 'en-IN-NeerjaNeural',
};

export const personalities: PersonalityInfo[] = [
  {
    name: PersonalityId.Arthur,
    description: 'The Erudite Analyst: Delivers insights with precision and depth, often referencing historical context or academic research. Speaks thoughtfully and perhaps a bit formally.',
    previewPhrase: "Indeed, the historical data suggests a compelling trend."
  },
  {
    name: PersonalityId.Chloe,
    description: 'The Witty Commentator: Quick with a clever quip or sarcastic observation, finding humor in the details and keeping the conversation light and engaging.',
    previewPhrase: "Well, isn't that just *fascinatingly* predictable?"
  },
  {
    name: PersonalityId.Maya,
    description: 'The Passionate Advocate: Speaks with infectious energy and optimism. Finds the exciting angle in any topic and isn\'t afraid to show her passion.',
    previewPhrase: "This is incredibly exciting! Think of the possibilities!"
  },
  {
    name: PersonalityId.Sam,
    description: 'The Measured Moderator: Calm, thoughtful, and objective. Ensures all sides are considered, often summarizing complex points clearly and providing a steadying presence.',
    previewPhrase: "Let's consider the key points from a balanced perspective."
  },
  {
    name: PersonalityId.Evelyn,
    description: 'The Sharp Skeptic: Analytical and questioning, Evelyn probes assumptions and challenges conventional wisdom. She brings a critical eye and encourages deeper thought.',
    previewPhrase: "Are we certain that assumption holds true under scrutiny?"
  },
  {
    name: PersonalityId.David,
    description: 'The Relatable Storyteller: Warm, approachable, and focuses on the human angle. Connects the topic to everyday experiences and tells compelling anecdotes.',
    previewPhrase: "It really makes you think about how this affects everyday people, doesn't it?"
  },
];


function getVoiceMap(providerName: TTSProvider): Record<PersonalityId, string> | null {
  if (providerName === 'openai') {
    return openaiPersonalityMap;
  } 
  return null;
}


export function getPersonalityInfo(name: PersonalityId, ttsProvider: TTSProvider): PersonalityInfo | undefined {
  const personality = personalities.find(p => p.name === name);
  if (personality && ttsProvider === 'openai') {
    personality.voiceName = openaiPersonalityMap[name];
  }
  return personality;
} 

/**
 * Takes the base personalities and enriches them with provider-specific voice names
 * and attempts to load pre-generated preview audio as base64 data URIs.
 * 
 * @param providerName The TTS provider to use for enrichment (e.g., 'openai')
 * @returns A Promise resolving to an array of enriched PersonalityInfo objects.
 */
export async function enrichPersonalities(providerName: TTSProvider, isRunningInDocker=false): Promise<PersonalityInfo[]> {
  const voiceMap = getVoiceMap(providerName);
  const previewFileFormat = 'mp3';
  const basePreviewPath = isRunningInDocker
      ? path.resolve(process.cwd(), 'dist', 'personalities')
      : currentDirPath;

  const enrichedList = await Promise.all(personalities.map(async (p) => {
    const enrichedP: PersonalityInfo = { ...p };

    // 1. Add voiceName
    if (voiceMap && voiceMap[p.name]) {
      enrichedP.voiceName = voiceMap[p.name];
    }

    // 2. Add previewAudioUrl
    if (p.previewPhrase) {
      const previewFileName = `${p.name}.${previewFileFormat}`;
      const previewFilePath = path.resolve(basePreviewPath, providerName, previewFileName);
      
      try {
        const audioBuffer = await fs.readFile(previewFilePath);
        enrichedP.previewAudioUrl = `data:audio/${previewFileFormat};base64,${audioBuffer.toString('base64')}`;
        // console.log(`Successfully loaded preview for ${p.name} from ${previewFilePath}`);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Expected error if file doesn't exist (preview not generated yet)
          console.warn(`Preview audio file not found for ${p.name} at ${previewFilePath}. Run generate-previews?`);
        } else {
          // Unexpected error reading the file
          console.error(`Error reading preview audio file for ${p.name} at ${previewFilePath}:`, error);
        }
        // Ensure previewAudioUrl is undefined if loading failed
        enrichedP.previewAudioUrl = undefined; 
      }
    }

    return enrichedP;
  }));

  return enrichedList;
} 
