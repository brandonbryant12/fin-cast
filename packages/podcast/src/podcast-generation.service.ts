import * as v from 'valibot';
import type { AudioService } from './audio.service';
import type { DialogueSynthesisService } from './dialogue-synthesis.service';
import type { PodcastRepository } from './podcast.repository';
import type { LLMInterface, TTSService } from '@repo/ai';
import type { ChatResponse } from '@repo/ai';
import type { AppLogger } from '@repo/logger';
import type { Scraper } from '@repo/webscraper';
import { generatePodcastScriptPrompt, type GeneratePodcastScriptOutput } from './generate-podcast-script-prompt';
import { PersonalityId, getPersonalityInfo} from './personalities/personalities';


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
     * Orchestrates the podcast generation process.
     * Corresponds to the logic previously in PodcastService._processPodcastInBackground.
     */
    async generatePodcast(
        podcastId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId,
        cohostPersonalityId: PersonalityId
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, method: 'generatePodcast', hostPersonalityId, cohostPersonalityId });
        logger.info('Starting podcast generation orchestration.');

        let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null;

        try {
            const hostInfo = getPersonalityInfo(hostPersonalityId, this.tts.getProvider());
            const cohostInfo = getPersonalityInfo(cohostPersonalityId, this.tts.getProvider());

            if (!hostInfo || !cohostInfo) throw new Error('Invalid host or cohost personality ID provided.');
            if (!hostInfo.voiceName || !cohostInfo.voiceName) throw new Error('Personalities are not mapped to voices');

            logger.info({ hostInfo, cohostInfo }, 'Retrieved personality info.');

            // --- Scrape Content ---
            logger.info('Scraping content...');
            const html = await this.scraper.scrape(sourceUrl, { logger });
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
            let finalAudioBase64: string | undefined;
            let durationSeconds = 0;

            if (llmResponse.structuredOutput && !llmResponse.error) {
                scriptData = llmResponse.structuredOutput;
                logger.info('LLM returned valid structured output. Processing audio.');

                const speakerVoiceMap: Record<string, string> = {
                    [hostInfo.name]: hostInfo.voiceName,     // e.g., { 'Arthur': 'echo' }
                    [cohostInfo.name]: cohostInfo.voiceName, // e.g., { 'Chloe': 'nova' }
                };
                logger.info({ speakerVoiceMap }, 'Assigned personalities.');

                // --- Synthesize Audio using DialogueSynthesisService ---
                logger.info('Starting TTS synthesis via DialogueSynthesisService...');
                const audioBuffers = await this.dialogueSynthesisService.synthesizeDialogueSegments(
                    scriptData.dialogue,
                    speakerVoiceMap,
                    hostPersonalityId // Default personality if speaker not found
                );
                const validBufferCount = audioBuffers.filter(b => b !== null).length;
                logger.info(`DialogueSynthesisService completed for ${validBufferCount}/${scriptData.dialogue.length} segments.`);

                if (validBufferCount === 0) {
                    logger.warn('No audio buffers generated by DialogueSynthesisService. Podcast will have no audio.');
                    // Still need to encode an empty buffer if needed downstream or handle appropriately
                    finalAudioBase64 = this.audioService.encodeToBase64(Buffer.from([])); 
                    durationSeconds = 0;
                } else {
                    // --- Stitch Audio using AudioService ---
                    logger.info('Stitching audio segments via AudioService...');
                    const finalAudioBuffer = await this.audioService.stitchAudio(audioBuffers.filter(b => b !== null) as Buffer[], podcastId);
                    logger.info('AudioService stitching completed.');

                    // --- Get Duration using AudioService ---
                    logger.info('Getting audio duration via AudioService...');
                    durationSeconds = await this.audioService.getAudioDuration(finalAudioBuffer);
                    logger.info(`AudioService reported duration: ${durationSeconds} seconds.`);

                    // --- Encode to Base64 using AudioService ---
                    logger.info('Encoding final audio to base64 via AudioService...');
                    finalAudioBase64 = this.audioService.encodeToBase64(finalAudioBuffer);
                    logger.info('AudioService encoding completed.');
                }

                // --- Update Database using PodcastRepository ---
                logger.info('Updating database transcript and generated data via PodcastRepository...');
                await this.podcastRepository.updateTranscriptContent(podcastId, scriptData.dialogue);
                await this.podcastRepository.updatePodcastGeneratedData(
                    podcastId,
                    scriptData.title ?? `Podcast ${podcastId}`,
                    finalAudioBase64,
                    durationSeconds
                 );
                logger.info('Database updates for transcript and generated data successful.');

            } else {
                const errorMsg = llmResponse?.error ?? 'LLM did not return valid structured output.';
                logger.error({ llmError: errorMsg, llmResponse }, 'LLM script generation failed.');
                throw new Error(`Podcast script generation failed: ${errorMsg}`);
            }

            // --- Finalize Podcast Status (Success) using PodcastRepository ---
            logger.info('Updating podcast status to success via PodcastRepository.');
            await this.podcastRepository.updatePodcastStatus(podcastId, 'success');
            logger.info('Podcast generation process finished successfully.');

        } catch (error: unknown) {
            // --- Handle Errors & Finalize Podcast Status (Failure) using PodcastRepository ---
            logger.error({ err: error }, 'Podcast generation process failed.');
            let errorMessage = 'Podcast generation failed.';
             if (error instanceof v.ValiError) {
                errorMessage = `Generation failed due to invalid data: ${error.message}. Issues: ${JSON.stringify(error.issues)}`;
            } else if (error instanceof Error) {
                errorMessage = `Generation failed: ${error.message}`;
            } else {
                errorMessage = `Generation failed with an unknown error: ${String(error)}`;
            }

            try {
                await this.podcastRepository.updatePodcastStatus(podcastId, 'failed', errorMessage);
                logger.warn({ errorMessage }, 'Podcast status updated to failed due to generation error.');
            } catch (updateError) {
                logger.fatal({ initialError: error, updateError }, 'CRITICAL FAILURE: Could not update podcast status to FAILED in generation error handler.');
            }
        }
    }
} 