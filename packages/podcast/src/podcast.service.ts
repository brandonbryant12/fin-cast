import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import ffmpeg from 'fluent-ffmpeg';
import * as v from 'valibot';
import type { LLMInterface, ChatResponse, TTSService, TtsOptions } from '@repo/ai';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { Scraper } from '@repo/webscraper';
import { generatePodcastScriptPrompt, type GeneratePodcastScriptOutput } from './generate-podcast-script-prompt';

type SelectPodcast = typeof schema.podcast.$inferSelect;
type SelectTranscript = typeof schema.transcript.$inferSelect;

interface PodcastServiceDependencies {
    db: DatabaseInstance;
    llm: LLMInterface;
    scraper: Scraper;
    logger: AppLogger;
    tts: TTSService;
}

const DEFAULT_VOICE_A = 'onyx'; // Define default voices
const DEFAULT_VOICE_B = 'echo';
const AUDIO_FORMAT: NonNullable<TtsOptions['format']> = 'mp3'; // Define audio format

export class PodcastService {
    private readonly db: DatabaseInstance;
    private readonly llm: LLMInterface;
    private readonly scraper: Scraper;
    private readonly logger: AppLogger;
    private readonly tts: TTSService;

    constructor({ db, llm, scraper, logger, tts }: PodcastServiceDependencies) {
        this.db = db;
        this.llm = llm;
        this.scraper = scraper;
        this.tts = tts;
        this.logger = logger.child({ service: 'PodcastService' });
        this.logger.info('PodcastService initialized');
    }

    private async _processPodcastInBackground(
        podcastId: string,
        sourceUrl: string,
    ): Promise<void> {
         // Create a logger instance specific to this background task invocation
        const logger = this.logger.child({ podcastId, backgroundProcess: true, method: '_processPodcastInBackground' });
        logger.info('Starting background processing for podcast.');

        let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null;
        const tempAudioFiles: string[] = []; // Keep track of temporary audio files

        try {
            // 1. Scrape Content
             // Pass the specific logger instance for detailed tracing
            const html = await this.scraper.scrape(sourceUrl, { logger });
            logger.info('Scraping successful.');

            // 2. Generate Transcript using LLM
            logger.info('Running LLM prompt to generate podcast script...');
            llmResponse = await this.llm.runPrompt(
                generatePodcastScriptPrompt,
                { htmlContent: html }
            );
            logger.info('LLM prompt execution finished.');

            // 3. Process LLM Response & Generate Audio
            let scriptData: GeneratePodcastScriptOutput | undefined;
            let finalAudioBase64: string | undefined;
            let durationSeconds = 0; // Default duration

            if (llmResponse.structuredOutput && !llmResponse.error) {
                scriptData = llmResponse.structuredOutput;
                logger.info('LLM returned valid structured output. Processing script for audio.');

                // Assign voices to speakers
                const speakerVoices: Record<string, string> = {};
                let voiceToggle = true;
                for (const segment of scriptData.dialogue) {
                    if (!speakerVoices[segment.speaker]) {
                        speakerVoices[segment.speaker] = voiceToggle ? DEFAULT_VOICE_A : DEFAULT_VOICE_B;
                        voiceToggle = !voiceToggle;
                    }
                }
                logger.info({ speakerVoices }, 'Assigned voices to speakers.');

                // Generate audio for each segment
                logger.info('Starting TTS synthesis for dialogue segments...');
                const audioBuffers: Buffer[] = [];
                for (let i = 0; i < scriptData.dialogue.length; i++) {
                    const segment = scriptData.dialogue[i];
                    if (!segment) {
                        logger.warn(`Skipping undefined segment at index ${i}`);
                        continue;
                    }
                    const voiceId = speakerVoices[segment.speaker];
                    logger.info(`Synthesizing segment ${i + 1}/${scriptData.dialogue.length} for speaker ${segment.speaker} with voice ${voiceId}`);
                    try {
                        const audioBuffer = await this.tts.synthesize(segment.line, { voice: voiceId, format: AUDIO_FORMAT });
                        audioBuffers.push(audioBuffer);
                    } catch (ttsError) {
                        logger.error({ err: ttsError, segmentIndex: i, speaker: segment.speaker, voiceId }, 'TTS synthesis failed for a segment.');
                        throw new Error(`TTS synthesis failed for segment ${i + 1}: ${ttsError instanceof Error ? ttsError.message : String(ttsError)}`);
                    }
                }
                logger.info('TTS synthesis for all segments completed.');

                // Stitch audio segments using fluent-ffmpeg
                logger.info('Stitching audio segments...');
                if (audioBuffers.length === 0) {
                    logger.warn('No audio buffers generated, skipping audio stitching.');
                    finalAudioBase64 = `data:audio/${AUDIO_FORMAT};base64,`; // Empty audio
                } else {
                    // Write buffers to temporary files
                    for (let i = 0; i < audioBuffers.length; i++) {
                        const bufferToWrite = audioBuffers[i];
                        if (!bufferToWrite) {
                             logger.warn(`Skipping undefined audio buffer at index ${i}`);
                             continue;
                        }
                        const tempFileName = `podcast-${podcastId}-segment-${i}-${crypto.randomBytes(4).toString('hex')}.${AUDIO_FORMAT}`;
                        const tempFilePath = path.join(os.tmpdir(), tempFileName);
                        await fs.writeFile(tempFilePath, bufferToWrite);
                        tempAudioFiles.push(tempFilePath);
                        logger.debug(`Written temporary audio file: ${tempFilePath}`);
                    }
                    logger.info(`Created ${tempAudioFiles.length} temporary audio files.`);

                    // Use fluent-ffmpeg to concatenate
                    const finalOutputFileName = `podcast-${podcastId}-final-${crypto.randomBytes(4).toString('hex')}.${AUDIO_FORMAT}`;
                    const finalOutputPath = path.join(os.tmpdir(), finalOutputFileName);
                    tempAudioFiles.push(finalOutputPath); // Add final output to cleanup list

                    await new Promise<void>((resolve, reject) => {
                        const command = ffmpeg();
                        tempAudioFiles.forEach(file => {
                            // Only add segment files as input, not the final output path
                            if (file !== finalOutputPath) {
                                command.input(file);
                            }
                        });

                        command
                            .on('start', (commandLine: string) => {
                                logger.info(`ffmpeg process started with command: ${commandLine}`);
                            })
                            .on('error', (err: Error, stdout: string, stderr: string) => {
                                logger.error({ err: err.message, ffmpeg_stdout: stdout, ffmpeg_stderr: stderr }, 'ffmpeg concatenation failed.');
                                reject(new Error(`ffmpeg concatenation failed: ${err.message}`));
                            })
                            .on('end', (stdout: string, stderr: string) => {
                                logger.info({ ffmpeg_stdout: stdout, ffmpeg_stderr: stderr }, 'ffmpeg concatenation finished successfully.');
                                resolve();
                            })
                            .mergeToFile(finalOutputPath);
                    });

                    logger.info(`Successfully concatenated audio to ${finalOutputPath}`);

                    // Get audio duration using ffprobe
                    try {
                        durationSeconds = await new Promise<number>((resolveProbe, rejectProbe) => {
                            // Call ffprobe on an ffmpeg instance targeting the file
                            ffmpeg(finalOutputPath).ffprobe((err: Error, metadata: ffmpeg.FfprobeData) => {
                                if (err) {
                                    logger.warn({ err: err.message, file: finalOutputPath }, 'ffprobe failed to get audio duration.');
                                    rejectProbe(err); // Reject the promise
                                } else {
                                    const duration = metadata?.format?.duration;
                                    if (typeof duration === 'number') {
                                        logger.info({ duration }, `Got duration from ffprobe: ${duration} seconds.`);
                                        resolveProbe(Math.round(duration)); // Resolve with rounded duration
                                    } else {
                                        logger.warn({ metadata }, 'Could not find duration in ffprobe metadata.');
                                        resolveProbe(0); // Resolve with 0 if duration not found
                                    }
                                }
                            });
                        });
                    } catch (probeError) {
                        logger.warn({ err: probeError }, 'Error during ffprobe execution, duration will be set to 0.');
                        durationSeconds = 0; // Ensure duration is 0 on error
                    }

                    // Read the final file and encode to base64
                    const finalAudioBuffer = await fs.readFile(finalOutputPath);
                    finalAudioBase64 = `data:audio/${AUDIO_FORMAT};base64,${finalAudioBuffer.toString('base64')}`;
                    logger.info('Encoded final audio to base64.');
                }

                // Update database transcript and title within a transaction
                logger.info('Updating database with transcript content and title...');
                await this.db.transaction(async (tx: DatabaseInstance) => {
                    await tx
                        .update(schema.transcript)
                        .set({ content: scriptData?.dialogue ?? [] }) // Use optional chaining just in case
                        .where(eq(schema.transcript.podcastId, podcastId));
                    logger.info('Transcript content updated in transaction.');

                    await tx
                        .update(schema.podcast)
                        .set({ title: scriptData?.title ?? `Podcast ${podcastId}` }) // Fallback title
                        .where(eq(schema.podcast.id, podcastId));
                    logger.info('Podcast title updated in transaction.');
                });
                logger.info('Database updates for transcript and title successful.');

            } else {
                const errorMsg = llmResponse?.error ?? 'LLM did not return valid structured output.';
                logger.error({ llmError: errorMsg, llmResponse }, 'Failed to get valid structured output from LLM.');
                throw new Error(`Podcast script generation failed: ${errorMsg}`);
            }

            // 4. Update Podcast Status to Success with generated audio
            const generatedTime = new Date();
            logger.info('Updating podcast status to success with generated audio.');

            const [updatedPodcast] = await this.db
                .update(schema.podcast)
                .set({
                    status: 'success',
                    audioUrl: finalAudioBase64, // Use the generated base64 audio
                    generatedAt: generatedTime,
                    errorMessage: null,
                    durationSeconds: durationSeconds // Use the calculated or default duration
                })
                .where(eq(schema.podcast.id, podcastId))
                .returning();

            if (!updatedPodcast) {
                logger.error('Failed to update podcast status to success after processing.');
                throw new Error('Failed to finalize podcast status update.');
            } else {
                logger.info('Podcast status successfully updated to success.');
            }

        } catch (processError: unknown) {
             // Use the logger instance specific to this background task
            logger.error({ err: processError }, 'Background processing failed.');

            let errorMessage = 'Background processing failed.';
             if (processError instanceof v.ValiError) { // Catch specific validation errors from runPrompt
                errorMessage = `Background processing failed due to invalid data: ${processError.message}. Issues: ${JSON.stringify(processError.issues)}`;
             } else if (processError instanceof Error) {
                errorMessage = `Background processing failed: ${processError.message}`;
            } else {
                errorMessage = `Background processing failed with an unknown error: ${String(processError)}`;
            }

            try {
                const [failedPodcast] = await this.db
                    .update(schema.podcast)
                    .set({
                        status: 'failed',
                        errorMessage: errorMessage,
                        // Optionally clear audioUrl if it was partially generated?
                        // audioUrl: null,
                    })
                    .where(eq(schema.podcast.id, podcastId))
                    .returning({ id: schema.podcast.id });

                if (!failedPodcast) {
                    logger.fatal({ updateError: 'Failed to update podcast status to FAILED after background processing error.' }, 'CRITICAL FAILURE: Could not update podcast status.');
                } else {
                    logger.warn({ errorMessage }, 'Podcast status updated to failed due to background error.');
                }
            } catch (updateError) {
                logger.fatal({ initialError: processError, updateError }, 'CRITICAL FAILURE: Could not update podcast status to FAILED in background error handler.');
            }
        } finally {
            // Clean up temporary audio files
            if (tempAudioFiles.length > 0) {
                logger.info(`Cleaning up ${tempAudioFiles.length} temporary audio files...`);
                for (const tempFile of tempAudioFiles) {
                    try {
                        await fs.unlink(tempFile);
                        logger.debug(`Deleted temporary file: ${tempFile}`);
                    } catch (cleanupError) {
                        // Log an error but don't let cleanup failure stop the process or throw again
                        logger.error({ err: cleanupError, file: tempFile }, 'Failed to delete temporary audio file.');
                    }
                }
                logger.info('Temporary file cleanup finished.');
            }
        }
    }

    // --- Public Service Methods ---

    /**
     * Creates a new podcast record, initiates background processing, and returns the initial record.
     */
    async createPodcast(
        userId: string,
        sourceUrl: string,
    ): Promise<SelectPodcast> {
        const logger = this.logger.child({ userId, sourceUrl, method: 'createPodcast' });
        let initialPodcast: SelectPodcast | null = null;

        try {
            logger.info('Attempting to create initial podcast and transcript entries.');
            initialPodcast = await this.db.transaction(async (tx) => {
                const [createdPodcast] = await tx
                    .insert(schema.podcast)
                    .values({
                        userId,
                        title: `Podcast from ${sourceUrl}`,
                        status: 'processing',
                        sourceType: 'url',
                        sourceDetail: sourceUrl,
                    })
                    .returning();

                if (!createdPodcast?.id) {
                    logger.error('Podcast insert returned no result or ID during transaction.');
                    throw new Error('Failed to create podcast entry.');
                }
                logger.info({ podcastId: createdPodcast.id }, 'Podcast entry created, creating transcript entry.');

                await tx.insert(schema.transcript).values({
                    podcastId: createdPodcast.id,
                    content: [],
                });
                logger.info({ podcastId: createdPodcast.id }, 'Transcript entry created.');

                return createdPodcast;
            });

            if (!initialPodcast?.id) {
                logger.error('Podcast creation transaction completed but returned invalid data.');
                 // Throw an error that the router can catch and convert to TRPCError
                throw new Error('Podcast creation failed unexpectedly after transaction.');
            }
            const podcastId = initialPodcast.id;
            logger.info({ podcastId }, 'Initial podcast and transcript created successfully. Starting background job.');

            // Trigger Background Processing (Fire-and-forget)
            this._processPodcastInBackground(podcastId, sourceUrl).catch(err => {
                 // Log errors during the *initiation* or execution of the background task.
                 // The task itself handles marking the podcast as failed in the DB.
                logger.error({ err, podcastId }, "Error occurred during background podcast processing task execution.");
            });

            return initialPodcast;

        } catch (error) {
            logger.error({ err: error }, 'Error during initial podcast creation phase.');

            // Attempt to mark as failed if the podcast entry was partially created
            if (initialPodcast?.id) {
                try {
                    await this.db
                        .update(schema.podcast)
                        .set({
                            status: 'failed',
                            errorMessage: error instanceof Error ? `Creation failed: ${error.message}` : 'Unknown creation error',
                        })
                        .where(eq(schema.podcast.id, initialPodcast.id));
                    logger.warn({ podcastId: initialPodcast.id }, 'Marked podcast as failed due to error during creation phase.');
                } catch (updateError) {
                    logger.error({ podcastId: initialPodcast.id, updateError }, 'CRITICAL: Failed to mark podcast as failed even in the creation error handler.');
                }
            }
             // Re-throw the original error so the calling router layer can handle it appropriately (e.g., convert to TRPCError)
            throw error;
        }
    }

    /**
     * Fetches all podcasts for a given user.
     */
    async getMyPodcasts(userId: string): Promise<SelectPodcast[]> {
        const logger = this.logger.child({ userId, method: 'getMyPodcasts' });
        logger.info('Fetching podcasts for user');

        try {
            const results = await this.db.query.podcast.findMany({
                where: eq(schema.podcast.userId, userId),
                orderBy: desc(schema.podcast.createdAt),
                columns: { // Explicitly list columns needed by the frontend/caller
                    id: true,
                    userId: true,
                    title: true,
                    description: true,
                    status: true,
                    sourceType: true,
                    sourceDetail: true,
                    audioUrl: true,
                    durationSeconds: true,
                    errorMessage: true,
                    generatedAt: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
            logger.info({ count: results.length }, 'Successfully fetched podcasts');
            return results;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user podcasts');
             // Throw error for the router layer to handle
            throw new Error('Could not retrieve your podcasts.');
        }
    }

    /**
     * Fetches a specific podcast by ID, including its transcript, ensuring ownership.
     */
     // Use the corrected inferred types in the return Promise
    async getPodcastById(userId: string, podcastId: string): Promise<(SelectPodcast & { transcript: SelectTranscript | null })> {
        const logger = this.logger.child({ userId, podcastId, method: 'getPodcastById' });
        logger.info('Fetching podcast by ID with transcript');

        try {
            const results = await this.db
                .select()
                .from(schema.podcast)
                .leftJoin(
                    schema.transcript,
                    eq(schema.podcast.id, schema.transcript.podcastId),
                )
                .where(eq(schema.podcast.id, podcastId))
                .limit(1);

            if (!results || results.length === 0 || !results[0]?.podcast) {
                logger.warn('Podcast not found');
                // Throw a specific error type or message that the router can map to NOT_FOUND
                throw new Error(`Podcast not found: ${podcastId}`);
            }

            const result = results[0];
            const foundPodcast = result.podcast;
            const foundTranscript = result.transcript;

            // Authorization check
            if (foundPodcast.userId !== userId) {
                logger.warn('Unauthorized access attempt to podcast');
                // Throw a specific error type or message that the router can map to UNAUTHORIZED
                 throw new Error('Unauthorized access');
            }

            logger.info('Successfully fetched podcast by ID');
            return {
                ...foundPodcast,
                transcript: foundTranscript ?? null,
            };
        } catch(error) {
            logger.error({ err: error }, 'Failed to fetch podcast by ID');
            // Re-throw the caught error or a new generic one for the router
             if (error instanceof Error && (error.message.startsWith('Podcast not found') || error.message === 'Unauthorized access')) {
                 throw error; // Re-throw specific errors for router handling
             }
            throw new Error('Could not retrieve the podcast.');
        }
    }

    /**
     * Deletes a podcast after verifying ownership.
     */
    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId: string }> {
        const logger = this.logger.child({ userId, podcastId, method: 'deletePodcast' });
        logger.info('Attempting to delete podcast');

        // 1. Verify Ownership first
        let podcast;
        try {
            podcast = await this.db.query.podcast.findFirst({
                where: eq(schema.podcast.id, podcastId),
                columns: { id: true, userId: true },
            });
        } catch (error){
            logger.error({ err: error }, 'Error verifying podcast ownership before deletion');
            throw new Error('Could not verify podcast ownership.'); // For router to handle
        }

        // 2. Check existence
        if (!podcast) {
            logger.warn('Podcast not found for deletion');
             throw new Error(`Podcast not found: ${podcastId}`); // For router (NOT_FOUND)
        }

        // 3. Check Authorization
        if (podcast.userId !== userId) {
            logger.warn('Unauthorized deletion attempt');
            throw new Error('Unauthorized delete'); // For router (UNAUTHORIZED)
        }

        // 4. Proceed with Deletion
        try {
            logger.info('Ownership verified, proceeding with deletion.');
            const result = await this.db
                .delete(schema.podcast)
                .where(and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)))
                .returning({ deletedId: schema.podcast.id });

            if (!result || result.length === 0 || !result[0]?.deletedId) {
                logger.error('Deletion query executed but did not return the expected deleted ID.');
                // Could be already deleted between check and delete. Treat as not found.
                 throw new Error(`Podcast not found: ${podcastId}`);
            }

            logger.info('Podcast deleted successfully');
            return { success: true, deletedId: result[0].deletedId };
        } catch (error) {
            logger.error({ err: error }, `Failed to delete podcast ID '${podcastId}' during DB operation`);
             // Throw generic error for router (INTERNAL_SERVER_ERROR)
            throw new Error('Failed to delete podcast.');
        }
    }
}

// Factory function to create a PodcastService instance
export function createPodcast(dependencies: PodcastServiceDependencies): PodcastService {
    return new PodcastService(dependencies);
}
