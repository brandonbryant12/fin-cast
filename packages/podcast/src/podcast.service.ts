import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import * as v from 'valibot';
import type { LLMInterface, ChatResponse } from '@repo/ai';
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
}

export class PodcastService {
    private readonly db: DatabaseInstance;
    private readonly llm: LLMInterface;
    private readonly scraper: Scraper;
    private readonly logger: AppLogger;

    constructor({ db, llm, scraper, logger }: PodcastServiceDependencies) {
        this.db = db;
        this.llm = llm;
        this.scraper = scraper;
        this.logger = logger.child({ service: 'PodcastService' });
        this.logger.info('PodcastService initialized');
    }

    // --- Private Background Processing Method ---
    private async _processPodcastInBackground(
        podcastId: string,
        sourceUrl: string,
    ): Promise<void> {
         // Create a logger instance specific to this background task invocation
        const logger = this.logger.child({ podcastId, backgroundProcess: true, method: '_processPodcastInBackground' });
        logger.info('Starting background processing for podcast.');

        let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null;

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

            // 3. Process LLM Response
            if (llmResponse.structuredOutput && !llmResponse.error) {
                const scriptData: GeneratePodcastScriptOutput = llmResponse.structuredOutput;
                logger.info('LLM returned valid structured output. Updating database.');

                await this.db.transaction(async (tx: DatabaseInstance) => {
                    // Update transcript content
                    await tx
                        .update(schema.transcript)
                        .set({ content: scriptData.dialogue })
                        .where(eq(schema.transcript.podcastId, podcastId));
                    logger.info('Transcript content updated in transaction.');

                    // Update the podcast title
                    await tx
                        .update(schema.podcast)
                        .set({ title: scriptData.title })
                        .where(eq(schema.podcast.id, podcastId));
                    logger.info('Podcast title updated in transaction.');
                }); // Transaction commits here

                logger.info('Database updates for transcript and title successful.');


            } else {
                const errorMsg = llmResponse.error ?? 'LLM did not return valid structured output.';
                logger.error({ llmError: errorMsg, llmResponse }, 'Failed to get valid structured output from LLM.');
                throw new Error(`Podcast script generation failed: ${errorMsg}`);
            }

            // 4. TODO: Generate Actual Audio (Replace Mock)
            const mockAudioData = 'data:audio/mpeg;base64,SUQzBAAAAAAB...'; // Placeholder
            const generatedTime = new Date();
            logger.info('Updating podcast status to success with mock audio.');

            // 5. Update Podcast Status to Success
            const [updatedPodcast] = await this.db
                .update(schema.podcast)
                .set({
                    status: 'success',
                    audioUrl: mockAudioData,
                    generatedAt: generatedTime,
                    errorMessage: null,
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
