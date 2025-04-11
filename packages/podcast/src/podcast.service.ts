import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PersonalityId, getPersonalityInfo } from '@repo/ai';
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

const AUDIO_FORMAT: NonNullable<TtsOptions['format']> = 'mp3';

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
        hostPersonalityId: PersonalityId,
        cohostPersonalityId: PersonalityId
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, backgroundProcess: true, method: '_processPodcastInBackground', hostPersonalityId, cohostPersonalityId });
        logger.info('Starting background processing for podcast with specified personalities.');

        let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null;
        const tempAudioFiles: string[] = [];

        try {
            // --- Get Personality Details ---
            const hostInfo = getPersonalityInfo(hostPersonalityId);
            const cohostInfo = getPersonalityInfo(cohostPersonalityId);

            if (!hostInfo || !cohostInfo) {
                logger.error({ hostInfo, cohostInfo }, 'Could not retrieve info for provided personality IDs.');
                throw new Error('Invalid host or cohost personality ID provided.');
            }
            logger.info({ hostInfo, cohostInfo }, 'Retrieved personality info for host and cohost.');

            // --- Scrape Content ---
            const html = await this.scraper.scrape(sourceUrl, { logger });
            logger.info('Scraping successful.');

            // --- Generate Script using LLM with Personality Info ---
            logger.info('Running LLM prompt to generate podcast script with personalities...');
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
                logger.info('LLM returned valid structured output. Processing script for audio.');

                const speakerPersonalities: Record<string, PersonalityId> = {
                    [hostInfo.name]: hostPersonalityId,
                    [cohostInfo.name]: cohostPersonalityId
                };
                logger.info({ speakerPersonalities }, 'Assigned personalities to speakers Alex (Host) and Ben (Cohost).');


                logger.info('Starting TTS synthesis for dialogue segments...');
                const audioBuffers: Buffer[] = [];
                for (let i = 0; i < scriptData.dialogue.length; i++) {
                    const segment = scriptData.dialogue[i];
                    if (!segment) {
                        logger.warn(`Skipping undefined segment at index ${i}`);
                        continue;
                    }

                    let assignedPersonality = speakerPersonalities[segment.speaker];
                    if (!assignedPersonality) {
                        logger.error(`Consistency error: Speaker ${segment.speaker} found in dialogue but not assigned a personality. Defaulting.`);
                        assignedPersonality = hostPersonalityId;
                    }
                    logger.info(`Synthesizing segment ${i + 1}/${scriptData.dialogue.length} for speaker ${segment.speaker} with personality ${assignedPersonality}`);
                    try {
                        const audioBuffer = await this.tts.synthesize(segment.line, {
                            personality: assignedPersonality,
                            format: AUDIO_FORMAT
                        });
                        audioBuffers.push(audioBuffer);
                    } catch (ttsError) {
                        logger.error({ err: ttsError, segmentIndex: i, speaker: segment.speaker, personality: assignedPersonality }, 'TTS synthesis failed for a segment.');
                        throw new Error(`TTS synthesis failed for segment ${i + 1}: ${ttsError instanceof Error ? ttsError.message : String(ttsError)}`);
                    }
                }
                logger.info('TTS synthesis for all segments completed.');

                // --- Stitch Audio ---
                logger.info('Stitching audio segments...');
                if (audioBuffers.length === 0) {
                     logger.warn('No audio buffers generated, skipping audio stitching.');
                     finalAudioBase64 = `data:audio/${AUDIO_FORMAT};base64,`;
                 } else {
                    // (Audio stitching logic remains the same as before)
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

                     const finalOutputFileName = `podcast-${podcastId}-final-${crypto.randomBytes(4).toString('hex')}.${AUDIO_FORMAT}`;
                     const finalOutputPath = path.join(os.tmpdir(), finalOutputFileName);
                     tempAudioFiles.push(finalOutputPath);

                     await new Promise<void>((resolve, reject) => {
                         const command = ffmpeg();
                         tempAudioFiles.forEach(file => {
                             if (file !== finalOutputPath) {
                                 command.input(file);
                             }
                         });

                         command
                             .on('start', (commandLine: string) => { logger.info(`ffmpeg process started with command: ${commandLine}`); })
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

                      try {
                          durationSeconds = await new Promise<number>((resolveProbe, rejectProbe) => {
                              ffmpeg(finalOutputPath).ffprobe((err: Error, metadata: ffmpeg.FfprobeData) => {
                                  if (err) {
                                      logger.warn({ err: err.message, file: finalOutputPath }, 'ffprobe failed to get audio duration.');
                                      rejectProbe(err);
                                  } else {
                                      const duration = metadata?.format?.duration;
                                      if (typeof duration === 'number') {
                                          logger.info({ duration }, `Got duration from ffprobe: ${duration} seconds.`);
                                          resolveProbe(Math.round(duration));
                                      } else {
                                          logger.warn({ metadata }, 'Could not find duration in ffprobe metadata.');
                                          resolveProbe(0);
                                      }
                                  }
                              });
                          });
                      } catch (probeError) {
                          logger.warn({ err: probeError }, 'Error during ffprobe execution, duration will be set to 0.');
                          durationSeconds = 0;
                      }

                     const finalAudioBuffer = await fs.readFile(finalOutputPath);
                     finalAudioBase64 = `data:audio/${AUDIO_FORMAT};base64,${finalAudioBuffer.toString('base64')}`;
                     logger.info('Encoded final audio to base64.');
                 }

                logger.info('Updating database with transcript content and title...');
                 await this.db.transaction(async (tx: DatabaseInstance) => {
                     await tx
                         .update(schema.transcript)
                         .set({ content: scriptData?.dialogue ?? [] })
                         .where(eq(schema.transcript.podcastId, podcastId));
                     logger.info('Transcript content updated in transaction.');

                     await tx
                         .update(schema.podcast)
                         .set({ title: scriptData?.title ?? `Podcast ${podcastId}` })
                         .where(eq(schema.podcast.id, podcastId));
                     logger.info('Podcast title updated in transaction.');
                 });
                 logger.info('Database updates for transcript and title successful.');

            } else {
                const errorMsg = llmResponse?.error ?? 'LLM did not return valid structured output.';
                logger.error({ llmError: errorMsg, llmResponse }, 'Failed to get valid structured output from LLM.');
                throw new Error(`Podcast script generation failed: ${errorMsg}`);
            }

             const generatedTime = new Date();
             logger.info('Updating podcast status to success with generated audio.');

             const [updatedPodcast] = await this.db
                 .update(schema.podcast)
                 .set({
                     status: 'success',
                     audioUrl: finalAudioBase64,
                     generatedAt: generatedTime,
                     errorMessage: null,
                     durationSeconds: durationSeconds
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
                 const [failedPodcast] = await this.db
                     .update(schema.podcast)
                     .set({
                         status: 'failed',
                         errorMessage: errorMessage,
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
             if (tempAudioFiles.length > 0) {
                 logger.info(`Cleaning up ${tempAudioFiles.length} temporary audio files...`);
                 for (const tempFile of tempAudioFiles) {
                     try {
                         await fs.unlink(tempFile);
                         logger.debug(`Deleted temporary file: ${tempFile}`);
                     } catch (cleanupError) {
                         logger.error({ err: cleanupError, file: tempFile }, 'Failed to delete temporary audio file.');
                     }
                 }
                 logger.info('Temporary file cleanup finished.');
             }
        }
    }

    async createPodcast(
        userId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId = PersonalityId.Arthur,
        cohostPersonalityId: PersonalityId = PersonalityId.Chloe
    ): Promise<SelectPodcast> {
        if (hostPersonalityId === cohostPersonalityId) {
             throw new Error("Host and cohost personalities must be different.");
        }
         if (!Object.values(PersonalityId).includes(hostPersonalityId) || !Object.values(PersonalityId).includes(cohostPersonalityId)) {
              throw new Error("Invalid PersonalityId provided.");
         }


        const logger = this.logger.child({ userId, sourceUrl, method: 'createPodcast', hostPersonalityId, cohostPersonalityId });
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
                        hostPersonalityId: hostPersonalityId,
                        cohostPersonalityId: cohostPersonalityId,
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
                throw new Error('Podcast creation failed unexpectedly after transaction.');
            }
            const podcastId = initialPodcast.id;
            logger.info({ podcastId }, 'Initial podcast and transcript created successfully. Starting background job.');

            this._processPodcastInBackground(
                podcastId,
                sourceUrl,
                hostPersonalityId,
                cohostPersonalityId,
            ).catch(err => {
                logger.error({ err, podcastId }, "Error occurred during background podcast processing task execution.");
            });

            return initialPodcast;

        } catch (error) {
            logger.error({ err: error }, 'Error during initial podcast creation phase.');

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
            throw error;
        }
    }

    async getMyPodcasts(userId: string): Promise<SelectPodcast[]> {
        const logger = this.logger.child({ userId, method: 'getMyPodcasts' });
        logger.info('Fetching podcasts for user');

        try {
            const results = await this.db.query.podcast.findMany({
                where: eq(schema.podcast.userId, userId),
                orderBy: desc(schema.podcast.createdAt),
                columns: {
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
                    hostPersonalityId: true,
                    cohostPersonalityId: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });
            logger.info({ count: results.length }, 'Successfully fetched podcasts');
            return results;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user podcasts');
            throw new Error('Could not retrieve your podcasts.');
        }
    }

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
                throw new Error(`Podcast not found: ${podcastId}`);
            }

            const result = results[0];
            const foundPodcast = result.podcast;
            const foundTranscript = result.transcript;

            if (foundPodcast.userId !== userId) {
                logger.warn('Unauthorized access attempt to podcast');
                 throw new Error('Unauthorized access');
            }

            logger.info('Successfully fetched podcast by ID');
            return {
                ...foundPodcast,
                transcript: foundTranscript ?? null,
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
        const logger = this.logger.child({ userId, podcastId, method: 'deletePodcast' });
        logger.info('Attempting to delete podcast');

        let podcast;
        try {
            podcast = await this.db.query.podcast.findFirst({
                where: eq(schema.podcast.id, podcastId),
                columns: { id: true, userId: true },
            });
        } catch (error){
            logger.error({ err: error }, 'Error verifying podcast ownership before deletion');
            throw new Error('Could not verify podcast ownership.');
        }

        if (!podcast) {
            logger.warn('Podcast not found for deletion');
             throw new Error(`Podcast not found: ${podcastId}`);
        }

        if (podcast.userId !== userId) {
            logger.warn('Unauthorized deletion attempt');
            throw new Error('Unauthorized delete');
        }

        try {
            logger.info('Ownership verified, proceeding with deletion.');
            const result = await this.db
                .delete(schema.podcast)
                .where(and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)))
                .returning({ deletedId: schema.podcast.id });

            if (!result || result.length === 0 || !result[0]?.deletedId) {
                logger.error('Deletion query executed but did not return the expected deleted ID.');
                 throw new Error(`Podcast not found: ${podcastId}`);
            }

            logger.info('Podcast deleted successfully');
            return { success: true, deletedId: result[0].deletedId };
        } catch (error) {
            logger.error({ err: error }, `Failed to delete podcast ID '${podcastId}' during DB operation`);
            throw new Error('Failed to delete podcast.');
        }
    }
}


export function createPodcast(dependencies: PodcastServiceDependencies): PodcastService {
    return new PodcastService(dependencies);
}