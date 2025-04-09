import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import type { TRPCContext } from '../trpc';
import { protectedProcedure, router } from '../trpc';
// Import the specific prompt definition object and its output type
import { generatePodcastScriptPrompt, type GeneratePodcastScriptOutput } from '../../ai-prompts/generate-podcast-script.prompt';
import type { ChatResponse } from '@repo/ai'; // Import ChatResponse type if needed for explicit typing

// Helper function for background processing
async function processPodcastInBackground(
    ctx: TRPCContext,
    podcastId: string,
    sourceUrl: string,
) {
    const logger = ctx.logger.child({ podcastId, backgroundProcess: true, procedure: 'processPodcastInBackground' });
    logger.info('Starting background processing for podcast.');

    let llmResponse: ChatResponse<GeneratePodcastScriptOutput> | null = null; // Initialize for broader scope if needed

    try {
        // 1. Scrape Content
        const html = await ctx.scraper.scrape(sourceUrl, { logger });
        logger.info('Scraping successful.');

        // 2. Generate Transcript using LLM
        logger.info('Running LLM prompt to generate podcast script...');
        llmResponse = await ctx.llm.runPrompt(
            generatePodcastScriptPrompt, // Pass the imported definition object
            { htmlContent: html }
            // Options can be passed here to override defaults in the prompt definition
            // e.g., { temperature: 0.8 }
        );
        logger.info('LLM prompt execution finished.');

        // 3. Process LLM Response
        // Check for successful execution AND the presence of structured output
        if (llmResponse.structuredOutput && !llmResponse.error) {
            // IMPORTANT: structuredOutput is ALREADY the parsed and validated JS object
            // based on the outputSchema in generatePodcastScriptPrompt. No JSON.parse needed.
            const scriptData: GeneratePodcastScriptOutput = llmResponse.structuredOutput;

            logger.info('LLM returned valid structured output. Updating database.');

            // Update transcript content with the dialogue array from the structured output
            await ctx.db
                .update(schema.transcript)
                .set({ content: scriptData.dialogue }) // Use validated structured data directly
                .where(eq(schema.transcript.podcastId, podcastId));
            logger.info('Transcript content updated.');

            // Update the podcast title using the title from the structured output
            await ctx.db
                .update(schema.podcast)
                .set({ title: scriptData.title }) // Use validated structured data directly
                .where(eq(schema.podcast.id, podcastId));
            logger.info('Podcast title updated.');

        } else {
            // Handle cases where LLM failed, returned an error, or didn't produce valid structured output
            const errorMsg = llmResponse.error ?? 'LLM did not return valid structured output (output was null or undefined).';
            logger.error({ llmError: errorMsg, llmResponse }, 'Failed to get valid structured output from LLM.');
            // Throw an error to be caught by the outer catch block, ensuring the podcast status is set to 'failed'
            throw new Error(`Podcast script generation failed: ${errorMsg}`);
        }

        // 4. TODO: Generate Actual Audio (Replace Mock)
        const mockAudioData = 'data:audio/mpeg;base64,SUQzBAAAAAAB...'; // Placeholder
        const generatedTime = new Date();
        logger.info('Updating podcast status to success with mock audio.'); // Update log message if using real audio

        // 5. Update Podcast Status to Success
        const [updatedPodcast] = await ctx.db
            .update(schema.podcast)
            .set({
                status: 'success',
                audioUrl: mockAudioData, // Replace with actual audio URL/data
                generatedAt: generatedTime,
                errorMessage: null, // Clear any previous errors
                // Optionally update duration if known
                // durationSeconds: calculatedDuration,
            })
            .where(eq(schema.podcast.id, podcastId))
            .returning();

        if (!updatedPodcast) {
            // This case is less likely if the previous steps succeeded, but good to handle
            logger.error('Failed to update podcast status to success after processing.');
            throw new Error('Failed to finalize podcast status update.'); // Will be caught below
        } else {
            logger.info('Podcast status successfully updated to success.');
        }

    } catch (processError: unknown) {
        // Catch errors from scraping, LLM execution (including parsing/validation errors from runPrompt), DB updates, etc.
        logger.error({ err: processError }, 'Background processing failed.'); // Use 'error' level for failures

        let errorMessage = 'Background processing failed.';
        if (processError instanceof v.ValiError) { // Catch specific validation errors from runPrompt
             // Customize message for validation errors if desired
            errorMessage = `Background processing failed due to invalid data: ${processError.message}. Issues: ${JSON.stringify(processError.issues)}`;
        } else if (processError instanceof Error) {
            errorMessage = `Background processing failed: ${processError.message}`;
        } else {
            errorMessage = `Background processing failed with an unknown error: ${String(processError)}`;
        }

        // Attempt to mark the podcast as failed in the database
        try {
            const [failedPodcast] = await ctx.db
                .update(schema.podcast)
                .set({
                    status: 'failed',
                    errorMessage: errorMessage, // Store the specific error message
                })
                .where(eq(schema.podcast.id, podcastId))
                .returning({ id: schema.podcast.id }); // Only return necessary field

            if (!failedPodcast) {
                // This is critical - log extensively if we can't even mark it as failed
                logger.fatal({ updateError: 'Failed to update podcast status to FAILED after background processing error.' }, 'CRITICAL FAILURE: Could not update podcast status.');
            } else {
                logger.warn({ errorMessage }, 'Podcast status updated to failed due to background error.');
            }
        } catch (updateError) {
            // Catastrophic failure if DB update fails here
            logger.fatal({ initialError: processError, updateError }, 'CRITICAL FAILURE: Could not update podcast status to FAILED in background error handler.');
        }
    }
}

// --- Input Schemas ---
const CreatePodcastInput = v.object({
    sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
});

const GetPodcastByIdInput = v.object({
    id: v.pipe(v.string(), v.uuid('Invalid podcast ID format')),
});

const DeletePodcastInput = v.object({
    id: v.pipe(v.string(), v.uuid('Invalid podcast ID format')),
});

// --- Router Definition ---
export const podcastRouter = router({
    create: protectedProcedure
        .input(CreatePodcastInput)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            let initialPodcast: typeof schema.podcast.$inferSelect | null = null;
            const logger = ctx.logger.child({ userId, sourceUrl: input.sourceUrl, procedure: 'createPodcast' });

            try {
                // 1. Create Initial Podcast and Transcript Entries in a Transaction
                logger.info('Attempting to create initial podcast and transcript entries.');
                initialPodcast = await ctx.db.transaction(async (tx) => {
                    const [createdPodcast] = await tx
                        .insert(schema.podcast)
                        .values({
                            userId,
                            title: `Podcast from ${input.sourceUrl}`, // Initial title
                            status: 'processing', // Start as processing
                            sourceType: 'url',
                            sourceDetail: input.sourceUrl,
                        })
                        .returning(); // Return the created podcast row

                    if (!createdPodcast?.id) { // Check ID specifically
                        logger.error('Podcast insert returned no result or ID during transaction.');
                        throw new Error('Failed to create podcast entry.'); // Error will rollback transaction
                    }
                    logger.info({ podcastId: createdPodcast.id }, 'Podcast entry created, creating transcript entry.');

                    await tx.insert(schema.transcript).values({
                        podcastId: createdPodcast.id,
                        content: [], // Start with empty transcript content
                    });
                    logger.info({ podcastId: createdPodcast.id }, 'Transcript entry created.');

                    return createdPodcast; // Return the podcast from the transaction
                });

                // Check if transaction succeeded but somehow returned null (shouldn't happen with checks above)
                if (!initialPodcast?.id) {
                    logger.error('Podcast creation transaction completed but returned invalid data.');
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Podcast creation failed unexpectedly after transaction.' });
                }
                const podcastId = initialPodcast.id; // Use variable for clarity
                logger.info({ podcastId }, 'Initial podcast and transcript created successfully. Starting background job.');

                // 2. Trigger Background Processing (DO NOT AWAIT)
                // Fire-and-forget, error handling is inside processPodcastInBackground
                processPodcastInBackground(ctx, podcastId, input.sourceUrl).catch(err => {
                    // Log errors during the *initiation* of the background task,
                    // but the task itself handles its own failures and updates the DB.
                    logger.error({ err, podcastId }, "Error initiating background podcast processing task. The task itself will attempt to mark the podcast as failed.");
                });

                // 3. Return the initial podcast object immediately (status: 'processing')
                return initialPodcast;

            } catch (error) {
                // Catch errors from the transaction or initial checks
                logger.error({ err: error }, 'Error during initial podcast creation phase (before background task was fully dispatched)');

                // Attempt to mark as failed if the podcast entry was partially created before the error
                // This is a fallback, primary failure handling is in background task
                if (initialPodcast?.id) {
                    try {
                        await ctx.db
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

                if (error instanceof TRPCError) throw error; // Re-throw known TRPC errors

                // Throw a generic error for other cases
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to initiate podcast creation.',
                    cause: error instanceof Error ? error : undefined,
                });
            }
        }),

    myPodcasts: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.session.user.id;
        const logger = ctx.logger.child({ userId, procedure: 'myPodcasts' });
        logger.info('Fetching podcasts for user');

        try {
            const results = await ctx.db.query.podcast.findMany({
                where: eq(schema.podcast.userId, userId),
                orderBy: desc(schema.podcast.createdAt),
                // Select all relevant columns
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
                    createdAt: true,
                }
            });
            logger.info({ count: results.length }, 'Successfully fetched podcasts');
            return results;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user podcasts');
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Could not retrieve your podcasts.',
                cause: error instanceof Error ? error : undefined,
            });
        }
    }),

    byId: protectedProcedure.input(GetPodcastByIdInput).query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const podcastId = input.id;
        const logger = ctx.logger.child({ userId, podcastId, procedure: 'byId' });
        logger.info('Fetching podcast by ID with transcript');

        try {
            // Use a JOIN to fetch podcast and its transcript together
            const results = await ctx.db
                .select() // Select all columns from both tables
                .from(schema.podcast)
                .leftJoin(
                    schema.transcript,
                    eq(schema.podcast.id, schema.transcript.podcastId), // Join condition
                )
                .where(eq(schema.podcast.id, podcastId)) // Filter by podcast ID
                .limit(1); // Expect only one result

            if (!results || results.length === 0) {
                logger.warn('Podcast not found');
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: `Podcast with ID '${podcastId}' not found.`,
                });
            }

            const result = results[0]; // Get the first (and only) result row
            
            // Double-check if podcast data is present (should be guaranteed by query if results exist)
            if (!result) {
                logger.error(`Inconsistent state: Podcast data missing for ID '${podcastId}' despite query returning results.`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve complete podcast data.' });
            }

            const foundPodcast = result.podcast;
            const foundTranscript = result.transcript; // This can be null if no transcript exists

            // Authorization check: Ensure the podcast belongs to the requesting user
            if (foundPodcast.userId !== userId) {
                logger.warn('Unauthorized access attempt to podcast');
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to view this podcast.' });
            }

            logger.info('Successfully fetched podcast by ID');
            // Return a combined object
            return {
                ...foundPodcast,
                transcript: foundTranscript ?? null, // Return transcript or null if not found
            };
        } catch(error) {
            logger.error({ err: error }, 'Failed to fetch podcast by ID');
            if (error instanceof TRPCError) throw error; // Re-throw known TRPC errors
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Could not retrieve the podcast.',
                cause: error instanceof Error ? error : undefined,
            });
        }
    }),

    delete: protectedProcedure
        .input(DeletePodcastInput)
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const podcastId = input.id;
            const logger = ctx.logger.child({ userId, podcastId, procedure: 'delete' });
            logger.info('Attempting to delete podcast');

            // 1. Verify Ownership first (read operation)
            let podcast;
            try {
                podcast = await ctx.db.query.podcast.findFirst({
                    where: eq(schema.podcast.id, podcastId),
                    columns: { id: true, userId: true }, // Only fetch necessary columns for verification
                });
            } catch (error){
                logger.error({ err: error }, 'Error verifying podcast ownership before deletion');
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not verify podcast ownership.' });
            }

            // 2. Check if podcast exists
            if (!podcast) {
                logger.warn('Podcast not found for deletion');
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: `Podcast with ID '${podcastId}' not found.`,
                });
            }

            // 3. Check Authorization
            if (podcast.userId !== userId) {
                logger.warn('Unauthorized deletion attempt');
                throw new TRPCError({
                    code: 'UNAUTHORIZED',
                    message: 'You do not have permission to delete this podcast.',
                });
            }

            // 4. Proceed with Deletion (write operation)
            try {
                logger.info('Ownership verified, proceeding with deletion.');
                // Use 'and' for extra safety, ensuring ID and UserID match
                const result = await ctx.db
                    .delete(schema.podcast)
                    .where(and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)))
                    .returning({ deletedId: schema.podcast.id }); // Return the ID of the deleted row

                // Check if the deletion was successful
                if (!result || result.length === 0 || !result[0]?.deletedId) {
                    logger.error('Deletion query executed but did not return the expected deleted ID. This might indicate the record was already deleted or another issue occurred.');
                     // Even though ownership was verified, maybe it was deleted between check and delete.
                     // Treat as not found or internal error. Not Found might be more accurate.
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Podcast may have been deleted already or deletion failed.' });
                }

                logger.info('Podcast deleted successfully');
                return { success: true, deletedId: result[0].deletedId };
            } catch (error) {
                 logger.error({ err: error }, `Failed to delete podcast ID '${podcastId}' during DB operation`);
                 if (error instanceof TRPCError) throw error; // Re-throw if it's already a TRPC error
                 throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to delete podcast.',
                    cause: error instanceof Error ? error : undefined,
                });
            }
        }),
});

export default podcastRouter;