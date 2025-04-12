import pLimit from 'p-limit';
import type { TTSService, PersonalityId } from '@repo/ai';
import type { AppLogger } from '@repo/logger';
import { AUDIO_FORMAT } from './audio.service'; // Need AUDIO_FORMAT for tts.synthesize

// Reuse DialogueSegment interface (or move to a shared types file later)
interface DialogueSegment {
    speaker: string;
    line: string;
}

interface DialogueSynthesisServiceDependencies {
    tts: TTSService;
    logger: AppLogger;
}

export class DialogueSynthesisService {
    private readonly tts: TTSService;
    private readonly logger: AppLogger;
    private readonly concurrencyLimit = 5; // Or make configurable

    constructor(dependencies: DialogueSynthesisServiceDependencies) {
        this.tts = dependencies.tts;
        this.logger = dependencies.logger.child({ service: 'DialogueSynthesisService' });
        this.logger.info('DialogueSynthesisService initialized');
    }

    /**
     * Synthesizes audio for multiple dialogue segments in parallel.
     * Corresponds to the logic previously in PodcastService._synthesizeDialogue.
     * @param dialogue The array of dialogue segments.
     * @param speakerPersonalities A map of speaker names to their PersonalityId.
     * @param defaultPersonalityId The PersonalityId to use if a speaker is not found in the map.
     * @returns A promise that resolves to an array of audio Buffers or null for failed segments.
     */
    async synthesizeDialogueSegments(
        dialogue: DialogueSegment[],
        speakerPersonalities: Record<string, PersonalityId>,
        defaultPersonalityId: PersonalityId
    ): Promise<(Buffer | null)[]> {
        const logger = this.logger.child({ method: 'synthesizeDialogueSegments' });
        logger.info(`Starting TTS synthesis for ${dialogue.length} segments.`);

        const limit = pLimit(this.concurrencyLimit);

        const audioBufferPromises = dialogue.map((segment, i) => {
            if (!segment || !segment.line) {
                logger.warn(`Skipping undefined or empty segment at index ${i}`);
                return Promise.resolve(null);
            }

            return limit(async () => {
                let assignedPersonality = speakerPersonalities[segment.speaker];
                if (!assignedPersonality) {
                    logger.warn(`Speaker "${segment.speaker}" not found in personality map, using default ${defaultPersonalityId}.`);
                    assignedPersonality = defaultPersonalityId;
                }
                logger.info(`Synthesizing segment ${i + 1}/${dialogue.length} for speaker "${segment.speaker}" with personality ${assignedPersonality}`);

                try {
                    const audioBuffer = await this.tts.synthesize(segment.line, {
                        personality: assignedPersonality,
                        format: AUDIO_FORMAT // Use the imported constant
                    });
                    logger.debug(`Segment ${i + 1} synthesized successfully.`);
                    return audioBuffer;
                } catch (ttsError) {
                    logger.error({ err: ttsError, segmentIndex: i, speaker: segment.speaker, personality: assignedPersonality }, 'TTS synthesis failed for a segment.');
                    return null; // Return null for failed segments
                }
            });
        });

        const results = await Promise.all(audioBufferPromises);
        const successfulCount = results.filter(r => r !== null).length;
        logger.info(`TTS synthesis finished. ${successfulCount}/${dialogue.length} segments synthesized successfully.`);
        return results;
    }
} 