import { PersonalityId, getPersonalityInfo } from '@repo/ai';
import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import pLimit from 'p-limit';
import * as v from 'valibot';
import type { LLMInterface, ChatResponse, TTSService } from '@repo/ai';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { Scraper } from '@repo/webscraper';
import { AudioService, createAudioService, AUDIO_FORMAT } from './audio.service';
import { generatePodcastScriptPrompt, type GeneratePodcastScriptOutput } from './generate-podcast-script-prompt';

type SelectPodcast = typeof schema.podcast.$inferSelect;
type SelectTranscript = typeof schema.transcript.$inferSelect;

interface DialogueSegment {
    speaker: string;
    line: string;
}

interface PodcastServiceDependencies {
    db: DatabaseInstance;
    llm: LLMInterface;
    scraper: Scraper;
    logger: AppLogger;
    tts: TTSService;
}

export class PodcastService {
    private readonly db: DatabaseInstance;
    private readonly llm: LLMInterface;
    private readonly scraper: Scraper;
    private readonly logger: AppLogger;
    private readonly tts: TTSService;
    private readonly audioService: AudioService;

    constructor(dependencies: PodcastServiceDependencies, audioService: AudioService) {
        this.db = dependencies.db;
        this.llm = dependencies.llm;
        this.scraper = dependencies.scraper;
        this.logger = dependencies.logger.child({ service: 'PodcastService' });
        this.tts = dependencies.tts; // Initialize tts from dependencies
        this.audioService = audioService; // Initialize audioService from argument
        this.logger.info('PodcastService initialized');
    }

     /**
      * Synthesizes audio for multiple dialogue segments in parallel using the TTS service.
      * Moved from AudioService back to PodcastService.
      * @param dialogue The array of dialogue segments.
      * @param speakerPersonalities A map of speaker names to their PersonalityId.
      * @param defaultPersonalityId The PersonalityId to use if a speaker is not found in the map.
      * @returns A promise that resolves to an array of audio Buffers or null for failed segments.
      */
     private async _synthesizeDialogue(
        dialogue: DialogueSegment[],
        speakerPersonalities: Record<string, PersonalityId>,
        defaultPersonalityId: PersonalityId
    ): Promise<(Buffer | null)[]> {
        const logger = this.logger.child({ method: '_synthesizeDialogue' });
        logger.info(`Starting TTS synthesis for ${dialogue.length} segments.`);

        const limit = pLimit(5);
        const audioBufferPromises = dialogue.map((segment, i) => {
            if (!segment || !segment.line) {
                logger.warn(`Skipping undefined or empty segment at index ${i}`);
                return Promise.resolve(null);
            }

            return limit(async () => {
                let assignedPersonality = speakerPersonalities[segment.speaker];
                if (!assignedPersonality) {
                    logger.warn(`Speaker ${segment.speaker} not found in personality map, using default ${defaultPersonalityId}.`);
                    assignedPersonality = defaultPersonalityId;
                }
                logger.info(`Synthesizing segment ${i + 1}/${dialogue.length} for speaker ${segment.speaker} with personality ${assignedPersonality}`);

                try {
                    const audioBuffer = await this.tts.synthesize(segment.line, {
                        personality: assignedPersonality,
                        format: AUDIO_FORMAT
                    });
                    logger.debug(`Segment ${i + 1} synthesized successfully.`);
                    return audioBuffer;
                } catch (ttsError) {
                    logger.error({ err: ttsError, segmentIndex: i, speaker: segment.speaker, personality: assignedPersonality }, 'TTS synthesis failed for a segment.');
                    return null;
                }
            });
        });

        const results = await Promise.all(audioBufferPromises);
        const successfulCount = results.filter(r => r !== null).length;
        logger.info(`TTS synthesis finished. ${successfulCount}/${dialogue.length} segments synthesized successfully.`);
        return results;
    }


    private async _processPodcastInBackground(
        podcastId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId,
        cohostPersonalityId: PersonalityId
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, backgroundProcess: true, method: '_processPodcastInBackground', hostPersonalityId, cohostPersonalityId });
        logger.info('Starting background processing for podcast.');

        let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null;

        try {
            const hostInfo = getPersonalityInfo(hostPersonalityId);
            const cohostInfo = getPersonalityInfo(cohostPersonalityId);

            if (!hostInfo || !cohostInfo) throw new Error('Invalid host or cohost personality ID provided.');
            logger.info({ hostInfo, cohostInfo }, 'Retrieved personality info.');

            // --- Scrape Content ---
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

                const speakerPersonalities: Record<string, PersonalityId> = {
                    [hostInfo.name]: hostPersonalityId,
                    [cohostInfo.name]: cohostPersonalityId
                };
                logger.info({ speakerPersonalities }, 'Assigned personalities.');

                // --- Synthesize Audio using internal method ---
                logger.info('Starting TTS synthesis via internal _synthesizeDialogue...');
                const audioBuffers = await this._synthesizeDialogue( // Call internal method
                    scriptData.dialogue,
                    speakerPersonalities,
                    hostPersonalityId
                );
                const validBufferCount = audioBuffers.filter(b => b !== null).length;
                logger.info(`Internal synthesis completed for ${validBufferCount}/${scriptData.dialogue.length} segments.`);

                if (validBufferCount === 0) {
                    logger.warn('No audio buffers generated. Podcast will have no audio.');
                    finalAudioBase64 = this.audioService.encodeToBase64(Buffer.from([]));
                    durationSeconds = 0;
                } else {
                    // --- Stitch Audio using AudioService ---
                    logger.info('Stitching audio segments via AudioService...');
                    const finalAudioBuffer = await this.audioService.stitchAudio(audioBuffers, podcastId);
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

                // --- Update Database ---
                logger.info('Updating database transcript and title...');
                await this.db.transaction(async (tx) => {
                    await tx.update(schema.transcript)
                        .set({ content: scriptData?.dialogue ?? [] })
                        .where(eq(schema.transcript.podcastId, podcastId));
                    await tx.update(schema.podcast)
                        .set({ title: scriptData?.title ?? `Podcast ${podcastId}` })
                        .where(eq(schema.podcast.id, podcastId));
                });
                logger.info('Database updates successful.');

            } else {
                const errorMsg = llmResponse?.error ?? 'LLM did not return valid structured output.';
                logger.error({ llmError: errorMsg, llmResponse }, 'LLM script generation failed.');
                throw new Error(`Podcast script generation failed: ${errorMsg}`);
            }

            // --- Finalize Podcast Status ---
            const generatedTime = new Date();
            logger.info('Updating podcast status to success.');
            const [updatedPodcast] = await this.db.update(schema.podcast).set({
                status: 'success',
                audioUrl: finalAudioBase64,
                generatedAt: generatedTime,
                errorMessage: null,
                durationSeconds: durationSeconds
            }).where(eq(schema.podcast.id, podcastId)).returning();

            if (!updatedPodcast) throw new Error('Failed to finalize podcast status update.');
            logger.info('Podcast status successfully updated to success.');

        } catch (processError: unknown) {
            logger.error({ err: processError }, 'Background processing failed.');
            let errorMessage = 'Background processing failed.';
            if (processError instanceof v.ValiError) {
                errorMessage = `Background processing failed due to invalid data: ${processError.message}. Issues: ${JSON.stringify(processError.issues)}`;
            } else if (processError instanceof Error) {
                errorMessage = `Background processing failed: ${processError.message}`;
            } else {
                errorMessage = `Background processing failed with an unknown error: ${String(processError)}`;
            }

            try {
                await this.db.update(schema.podcast).set({
                    status: 'failed',
                    errorMessage: errorMessage,
                }).where(eq(schema.podcast.id, podcastId));
                logger.warn({ errorMessage }, 'Podcast status updated to failed due to background error.');
            } catch (updateError) {
                logger.fatal({ initialError: processError, updateError }, 'CRITICAL FAILURE: Could not update podcast status to FAILED in background error handler.');
            }
        }
    }

    async createPodcast(
        userId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId = PersonalityId.Arthur,
        cohostPersonalityId: PersonalityId = PersonalityId.Chloe
    ): Promise<SelectPodcast> {
        if (hostPersonalityId === cohostPersonalityId) throw new Error("Host and cohost personalities must be different.");
        if (!Object.values(PersonalityId).includes(hostPersonalityId) || !Object.values(PersonalityId).includes(cohostPersonalityId)) {
            throw new Error("Invalid PersonalityId provided.");
        }

        const logger = this.logger.child({ userId, sourceUrl, method: 'createPodcast', hostPersonalityId, cohostPersonalityId });
        let initialPodcast: SelectPodcast | null = null;

        try {
            logger.info('Attempting to create initial podcast and transcript entries.');
            initialPodcast = await this.db.transaction(async (tx) => {
                const [createdPodcast] = await tx.insert(schema.podcast).values({
                    userId,
                    title: `Podcast from ${sourceUrl}`, // Initial title
                    status: 'processing',
                    sourceType: 'url',
                    sourceDetail: sourceUrl,
                    hostPersonalityId: hostPersonalityId,
                    cohostPersonalityId: cohostPersonalityId,
                }).returning();

                if (!createdPodcast?.id) throw new Error('Failed to create podcast entry.');
                logger.info({ podcastId: createdPodcast.id }, 'Podcast entry created.');

                await tx.insert(schema.transcript).values({
                    podcastId: createdPodcast.id,
                    content: [],
                });
                logger.info({ podcastId: createdPodcast.id }, 'Transcript entry created.');
                return createdPodcast;
            });

            if (!initialPodcast?.id) throw new Error('Podcast creation failed unexpectedly after transaction.');

            const podcastId = initialPodcast.id;
            logger.info({ podcastId }, 'Initial DB entries created. Starting background job.');

            // Launch background processing asynchronously
            this._processPodcastInBackground(
                podcastId,
                sourceUrl,
                hostPersonalityId,
                cohostPersonalityId,
            ).catch(err => {
                // Error is handled and logged within the background task,
                // but we log that the promise rejection was caught here.
                logger.error({ err, podcastId }, "Background podcast processing task promise rejected.");
            });

            return initialPodcast; // Return the initial podcast data immediately

        } catch (error) {
            logger.error({ err: error }, 'Error during initial podcast creation phase.');
            // Attempt to mark as failed if partially created
            if (initialPodcast?.id) {
                try {
                    await this.db.update(schema.podcast).set({
                        status: 'failed',
                        errorMessage: error instanceof Error ? `Creation failed: ${error.message}` : 'Unknown creation error',
                    }).where(eq(schema.podcast.id, initialPodcast.id));
                    logger.warn({ podcastId: initialPodcast.id }, 'Marked podcast as failed during creation.');
                } catch (updateError) {
                    logger.error({ podcastId: initialPodcast.id, updateError }, 'CRITICAL: Failed to mark podcast as failed in creation error handler.');
                }
            }
            throw error; // Re-throw the original error
        }
    }

    async getMyPodcasts(userId: string): Promise<SelectPodcast[]> {
        // Unchanged from previous version - omitting for brevity
        const logger = this.logger.child({ userId, method: 'getMyPodcasts' });
        logger.info('Fetching podcasts for user');
        try {
            const results = await this.db.query.podcast.findMany({
                where: eq(schema.podcast.userId, userId),
                orderBy: desc(schema.podcast.createdAt),
                columns: { id: true, userId: true, title: true, description: true, status: true, sourceType: true, sourceDetail: true, audioUrl: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true, }
            });
            logger.info({ count: results.length }, 'Successfully fetched podcasts');
            return results;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user podcasts');
            throw new Error('Could not retrieve your podcasts.');
        }
    }

    async getPodcastById(userId: string, podcastId: string): Promise<(SelectPodcast & { transcript: SelectTranscript | null })> {
        // Unchanged from previous version - omitting for brevity
        const logger = this.logger.child({ userId, podcastId, method: 'getPodcastById' });
        logger.info('Fetching podcast by ID with transcript');
        try {
            const result = await this.db.query.podcast.findFirst({
                where: and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)), // Ensure user owns podcast
                with: {
                    transcript: { // Use 'with' for relation
                        columns: {
                           content: true,
                           podcastId: true, // Include necessary fields
                           id: true,
                           createdAt: true,
                           updatedAt: true
                        }
                    }
                }
            });

            if (!result) {
                 // Check if the podcast exists at all, regardless of us
                 console.log({ schema: schema.podcast.id, podcastId});
                 const exists = await this.db.query.podcast.findFirst({ where: eq(schema.podcast.id, podcastId), columns: { id: true }});
                 if (!exists) {
                    logger.warn('Podcast not found');
                    throw new Error(`Podcast not found: ${podcastId}`);
                 } else {
                    // Podcast exists, but belongs to another user
                    logger.warn('Unauthorized access attempt to podcast');
                    throw new Error('Unauthorized access');
                 }
            }

             // Drizzle returns relation in a nested object (e.g., result.transcript)
             // Adapt the return structure accordingly.
             const { transcript, ...podcastData } = result;

            logger.info('Successfully fetched podcast by ID');
            return {
                ...podcastData,
                transcript: transcript ?? null, // transcript might be null if join condition fails or no transcript row exists
            };
        } catch(error) {
            logger.error({ err: error }, 'Failed to fetch podcast by ID');
            if (error instanceof Error && (error.message.startsWith('Podcast not found') || error.message === 'Unauthorized access')) {
                throw error;
            }
            throw new Error('Could not retrieve the podcast.');
        }
    }


    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId: string }> {
        // Unchanged from previous version - omitting for brevity
        const logger = this.logger.child({ userId, podcastId, method: 'deletePodcast' });
        logger.info('Attempting to delete podcast');

        // Verify ownership first
        const podcast = await this.db.query.podcast.findFirst({
             where: eq(schema.podcast.id, podcastId),
             columns: { id: true, userId: true },
         });

        if (!podcast) throw new Error(`Podcast not found: ${podcastId}`);
        if (podcast.userId !== userId) throw new Error('Unauthorized delete');

        try {
            logger.info('Ownership verified, proceeding with deletion.');
            // Assumes transcript deletion is handled by DB cascade or is not required
            const result = await this.db
                .delete(schema.podcast)
                .where(and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId))) // Re-confirm conditions
                .returning({ deletedId: schema.podcast.id });

            if (!result || result.length === 0 || !result[0]?.deletedId) {
                 throw new Error(`Failed to confirm deletion or podcast not found: ${podcastId}`);
            }

            logger.info('Podcast deleted successfully');
            return { success: true, deletedId: result[0].deletedId };
        } catch (error) {
             logger.error({ err: error }, `Failed to delete podcast ID '${podcastId}'`);
             if (error instanceof Error && error.message.startsWith('Failed to confirm deletion')) {
                 throw error;
             }
             throw new Error('Failed to delete podcast.');
        }
    }
}

export function createPodcast(dependencies: PodcastServiceDependencies): PodcastService {
    const audioService = createAudioService({ logger: dependencies.logger });
    return new PodcastService(dependencies, audioService);
}