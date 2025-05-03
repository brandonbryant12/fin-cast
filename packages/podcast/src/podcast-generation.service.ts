import * as v from 'valibot';
import type { AudioService } from './audio.service';
import type { DialogueSynthesisService } from './dialogue-synthesis.service';
import type { LLMInterface } from '@repo/llm';
import type { ChatResponse } from '@repo/llm';
import type { AppLogger } from '@repo/logger';
import type { TTSService } from '@repo/tts';
import type { Scraper } from '@repo/webscraper';
import { generatePodcastScriptPrompt, type GeneratePodcastScriptOutput } from './generate-podcast-script-prompt';
import { PersonalityId, getPersonalityInfo} from './personalities/personalities';
import { type PodcastRepository, type DialogueSegment } from './podcast.repository';

interface PodcastGenerationServiceDependencies {
    podcastRepository: PodcastRepository;
    scraper: Scraper;
    llm: LLMInterface;
    tts: TTSService;
    audioService: AudioService;
    logger: AppLogger;
    dialogueSynthesisService: DialogueSynthesisService;
}

export class PodcastGenerationService {
    private readonly podcastRepository: PodcastRepository;
    private readonly scraper: Scraper;
    private readonly llm: LLMInterface;
    private readonly audioService: AudioService;
    private readonly logger: AppLogger;
    private readonly dialogueSynthesisService: DialogueSynthesisService;
    private readonly tts: TTSService;

    constructor(dependencies: PodcastGenerationServiceDependencies) {
        this.podcastRepository = dependencies.podcastRepository;
        this.scraper = dependencies.scraper;
        this.tts = dependencies.tts;
        this.llm = dependencies.llm;
        this.audioService = dependencies.audioService;
        this.logger = dependencies.logger.child({ service: 'PodcastGenerationService' });
        this.dialogueSynthesisService = dependencies.dialogueSynthesisService;
        this.logger.info('PodcastGenerationService initialized');
    }

    /**
     * Orchestrates the initial podcast generation process (Scrape -> LLM -> Audio -> Finalize).
     * This runs in the background after createPodcast returns.
     */
    async generatePodcast(
        podcastId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId,
        cohostPersonalityId: PersonalityId
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, method: 'generatePodcast', hostPersonalityId, cohostPersonalityId });
        logger.info('Starting background podcast generation orchestration.');

        let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null;

        try {
            const hostInfo = getPersonalityInfo(hostPersonalityId, this.tts.getProvider());
            const cohostInfo = getPersonalityInfo(cohostPersonalityId, this.tts.getProvider());

            if (!hostInfo || !cohostInfo) throw new Error('Invalid host or cohost personality ID provided for generation.');
            logger.info({ hostInfo, cohostInfo }, 'Retrieved personality info for generation.');

            // --- Scrape Content ---
            logger.info('Scraping content...');
            const html = await this.scraper.scrape(sourceUrl);
            logger.info('Scraping successful.');

            // --- Generate Script ---
            logger.info('Running LLM prompt to generate podcast script...');
            llmResponse = await this.llm.runPrompt(
                generatePodcastScriptPrompt,
                {
                    htmlContent: html,
                    hostName: hostInfo.name,
                    hostPersonalityDescription: hostInfo.description,
                    cohostName: cohostInfo.name,
                    cohostPersonalityDescription: cohostInfo.description,
                }
            );
            logger.info('LLM prompt execution finished.');

            let scriptData: GeneratePodcastScriptOutput | undefined;

            if (llmResponse.structuredOutput && !llmResponse.error) {
                scriptData = llmResponse.structuredOutput;
                logger.info('LLM returned valid structured output. Updating transcript, tags, and processing audio.');
      
                // Update transcript
                await this.podcastRepository.updateTranscriptContent(podcastId, scriptData.dialogue);
                logger.info('Transcript content updated in database.');
      
                // Add tags
                if (scriptData.tags && scriptData.tags.length > 0) {
                  await this.podcastRepository.addTagsForPodcast(podcastId, scriptData.tags);
                  logger.info(`Added ${scriptData.tags.length} tags to the database.`);
                } else {
                  logger.info('No tags returned by LLM to add.');
                }
      
                // Process audio and finalize
                await this._processAudioAndFinalize(podcastId, scriptData.dialogue, hostPersonalityId, cohostPersonalityId, scriptData.title);
      
              } else {
                const errorMsg = llmResponse?.error ?? 'LLM did not return valid structured output.';
                logger.error({ llmError: errorMsg, llmResponse }, 'LLM script generation failed.');
                throw new Error(`Podcast script generation failed: ${errorMsg}`);
            }

            logger.info('Background podcast generation process finished successfully.');

        } catch (error: unknown) {
            const errorMessage = this._formatErrorMessage(error, 'Background generation failed');
            logger.error({ err: error, errorMessage }, 'Background podcast generation process failed.');

            try {
                await this.podcastRepository.updatePodcastStatus(podcastId, 'failed', errorMessage);
                logger.warn({ errorMessage }, 'Podcast status updated to failed due to generation error.');
            } catch (updateError) {
                logger.fatal({ initialError: error, updateError }, 'CRITICAL FAILURE: Could not update podcast status to FAILED in generation error handler.');
            }
        }
    }

    /**
     * Regenerates the audio for an existing podcast based on provided or existing dialogue.
     * Runs in the background after updatePodcast returns.
     */
    async regeneratePodcastAudio(
        podcastId: string,
        dialogueContent: DialogueSegment[],
        hostPersonalityId: PersonalityId,
        cohostPersonalityId: PersonalityId,
        title?: string // Optional title if it was also part of the update
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, method: 'regeneratePodcastAudio', hostPersonalityId, cohostPersonalityId });
        logger.info('Starting background podcast audio regeneration.');

        try {
            if (dialogueContent.length === 0) {
                throw new Error('Cannot regenerate audio: No dialogue content provided or found.');
            }
            await this._processAudioAndFinalize(podcastId, dialogueContent, hostPersonalityId, cohostPersonalityId, title);
            logger.info('Background audio regeneration finished successfully.');
        } catch (error: unknown) {
            const errorMessage = this._formatErrorMessage(error, 'Background regeneration failed');
            logger.error({ err: error, errorMessage }, 'Background podcast audio regeneration failed.');
            try {
                await this.podcastRepository.updatePodcastStatus(podcastId, 'failed', errorMessage);
                logger.warn({ errorMessage }, 'Podcast status updated to failed due to regeneration error.');
            } catch (updateError) {
                logger.fatal({ initialError: error, updateError }, 'CRITICAL FAILURE: Could not update podcast status to FAILED in regeneration error handler.');
            }
        }
    }

    /**
     * Private helper to handle audio synthesis, stitching, storage, and final DB update.
     */
    private async _processAudioAndFinalize(
        podcastId: string,
        dialogue: DialogueSegment[],
        hostPersonalityId: PersonalityId,
        cohostPersonalityId: PersonalityId,
        finalTitle?: string,
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, method: '_processAudioAndFinalize' });
        logger.info('Starting audio processing and finalization.');

        let finalAudioBase64: string | undefined | null = null;
        let durationSeconds = 0;

        try {
            const hostInfo = getPersonalityInfo(hostPersonalityId, this.tts.getProvider());
            const cohostInfo = getPersonalityInfo(cohostPersonalityId, this.tts.getProvider());

            if (!hostInfo?.voiceName || !cohostInfo?.voiceName) {
                throw new Error('Could not find personality info for voice synthesis.');
            }

            const speakerVoiceMap: Record<string, string> = {
                [hostInfo.name]: hostInfo.voiceName,
                [cohostInfo.name]: cohostInfo.voiceName,
            };
            logger.info({ speakerVoiceMap }, 'Assigned personalities for TTS.');

            // --- Synthesize Audio ---
            logger.info(`Starting TTS synthesis for ${dialogue.length} segments...`);
            const audioBuffers = await this.dialogueSynthesisService.synthesizeDialogueSegments(
                dialogue,
                speakerVoiceMap
            );
            const validBufferCount = audioBuffers.filter(b => b !== null).length;
            logger.info(`TTS completed for ${validBufferCount}/${dialogue.length} segments.`);

            if (validBufferCount === 0) {
                throw new Error('Audio generation failed: No valid audio segments were synthesized.');
            }

            // --- Stitch Audio ---
            logger.info('Stitching audio segments...');
            const finalAudioBuffer = await this.audioService.stitchAudio(audioBuffers.filter(b => b !== null) as Buffer[], podcastId);
            logger.info('Audio stitching completed.');

            // --- Get Duration ---
            logger.info('Getting audio duration...');
            durationSeconds = await this.audioService.getAudioDuration(finalAudioBuffer);
            logger.info(`Audio duration: ${durationSeconds} seconds.`);

            // --- Encode to Base64 ---
            logger.info('Encoding final audio to base64...');
            finalAudioBase64 = this.audioService.encodeToBase64(finalAudioBuffer);
            logger.info('Audio encoding completed.');

            // --- Final Success Update ---
            logger.info('Updating database with generated audio data and success status.');
            await this.podcastRepository.updatePodcast(podcastId, {
                ...(finalTitle && { title: finalTitle }),
                audioUrl: finalAudioBase64,
                durationSeconds: durationSeconds,
                status: 'success',
                errorMessage: null,
                generatedAt: new Date(), // Mark generation time
            });
            logger.info('Database update successful.');

        } catch (error) {
            // --- Handle Audio Processing Errors ---
            const errorMessage = this._formatErrorMessage(error, 'Audio processing failed');
            logger.error({ err: error, errorMessage }, 'Error during audio processing or finalization.');
            await this.podcastRepository.updatePodcastStatus(podcastId, 'failed', errorMessage);
            throw error;
        }
    }

    private _formatErrorMessage(error: unknown, defaultMessage: string): string {
        if (error instanceof v.ValiError) {
            return `Invalid data: ${error.message}. Issues: ${JSON.stringify(error.issues)}`;
        } else if (error instanceof Error) {
            return `${defaultMessage}: ${error.message}`;
        } else {
            return `${defaultMessage}: Unknown error - ${String(error)}`;
        }
    }
} 