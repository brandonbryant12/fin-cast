import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import type { TRPCContext } from '../trpc'; // Corrected import path and type name

import { protectedProcedure, router } from '../trpc';

// Helper function for background processing
async function processPodcastInBackground(
  ctx: TRPCContext, // Corrected type annotation
  podcastId: string,
  sourceUrl: string,
) {
  // Derive logger from context directly
  const logger = ctx.logger.child({ podcastId, backgroundProcess: true, procedure: 'processPodcastInBackground' });
  logger.info('Starting background processing for podcast.');

  try {
    // Pass the logger instance from the context to the scrape function
    const html = await ctx.scraper.scrape(sourceUrl, { logger });
    logger.info('Scraping successful, running LLM prompt.');

    // Generate transcript using LLM
    const podcastTranscriptResponse = await ctx.llm.runPrompt('generatePodcastScript', {
      htmlContent: html,
    });
    logger.info('LLM prompt successful, updating transcript.');

    // Update transcript content with the entire structured JSON response from the LLM
    await ctx.db
      .update(schema.transcript)
      .set({ content: podcastTranscriptResponse.structuredOutput?.dialogue }) // Save the entire structured output object
      .where(eq(schema.transcript.podcastId, podcastId));
    logger.info('Transcript content updated with full structured LLM response.');

    // Update the podcast title using the title from the LLM response
    await ctx.db
      .update(schema.podcast)
      .set({ title: podcastTranscriptResponse.structuredOutput?.title })
      .where(eq(schema.podcast.id, podcastId)); // Correctly reference podcast.id
    logger.info('Podcast title updated from LLM response.');

    // TODO: Replace mock data with actual audio generation logic
    const mockAudioData = 'data:audio/mpeg;base64,SUQzBAAAAAAB...'; // Placeholder
    const generatedTime = new Date();
    logger.info('Updating podcast status to success with mock audio.');

    // Update podcast status to success
    const [updatedPodcast] = await ctx.db
      .update(schema.podcast)
      .set({
        status: 'success',
        audioUrl: mockAudioData,
        generatedAt: generatedTime,
        errorMessage: null, // Clear any previous errors
      })
      .where(eq(schema.podcast.id, podcastId))
      .returning();

    if (!updatedPodcast) {
      logger.error('Failed to update podcast status to success after background processing.');
      // If the update fails here, the status remains 'processing' or potentially 'failed' from a prior error.
      // No TRPCError is thrown as this is a background task.
    } else {
      logger.info('Podcast status updated to success.');
    }

  } catch (processError) {
    // If any step in the background process fails, update status to 'failed'
    logger.warn({ err: processError }, 'Background processing failed, marking podcast as failed.');

    let errorMessage = 'Background processing failed.';
    if (processError instanceof Error) {
      errorMessage = `Background processing failed: ${processError.message}`;
    }

    try {
        const [failedPodcast] = await ctx.db
          .update(schema.podcast)
          .set({
            status: 'failed',
            errorMessage: errorMessage,
          })
          .where(eq(schema.podcast.id, podcastId))
          .returning();

        if (!failedPodcast) {
           logger.error('CRITICAL: Failed to update podcast status to FAILED after background processing error.');
        } else {
           logger.warn({ errorMessage }, 'Podcast status updated to failed due to background error.');
        }
    } catch (updateError) {
        logger.error({ updateError }, 'CRITICAL: Failed to update podcast status to FAILED even in background error handler.');
    }
  }
}

const CreatePodcastInput = v.object({
  sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
});

const GetPodcastByIdInput = v.object({
  id: v.pipe(v.string(), v.uuid('Invalid podcast ID format')),
});

const DeletePodcastInput = v.object({
  id: v.pipe(v.string(), v.uuid('Invalid podcast ID format')),
});

export const podcastRouter = router({
  create: protectedProcedure
    .input(CreatePodcastInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      let initialPodcast: typeof schema.podcast.$inferSelect | null = null;
      const logger = ctx.logger.child({ userId, sourceUrl: input.sourceUrl, procedure: 'createPodcast' }); // Use ctx.logger

      try {
        // 1. Create Initial Podcast and Transcript Entries
        logger.info('Attempting to create initial podcast entry.');
        [initialPodcast] = await ctx.db.transaction(async (tx) => {
          const [createdPodcast] = await tx
            .insert(schema.podcast)
            .values({
              userId,
              title: `Podcast from ${input.sourceUrl}`, // Consider making title more specific later
              status: 'processing',
              sourceType: 'url',
              sourceDetail: input.sourceUrl,
            })
            .returning();

          if (!createdPodcast) {
            logger.error('Podcast insert returned no result during transaction.');
            throw new Error('Failed to create podcast entry.');
          }
          logger.info({ podcastId: createdPodcast.id }, 'Podcast entry created, creating transcript entry.');

          await tx.insert(schema.transcript).values({
            podcastId: createdPodcast.id,
            content: '[Transcript processing...]', // Placeholder content
            format: 'plain_text',
          });
          logger.info({ podcastId: createdPodcast.id }, 'Transcript entry created.');

          return [createdPodcast];
        });

        if (!initialPodcast?.id) { // Check specifically for ID
          logger.error('Podcast creation transaction succeeded but returned invalid data.');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Podcast creation failed after transaction.' });
        }
        const podcastId = initialPodcast.id; // Use variable for clarity
        logger.info({ podcastId }, 'Initial podcast and transcript created. Returning processing status and starting background job.');

        // 2. Trigger background processing (DO NOT AWAIT)
        processPodcastInBackground(ctx, podcastId, input.sourceUrl).catch(err => {
          // Log unexpected errors from the background task initiation itself (not the async process).
          // This catch is for errors *before* the async function actually starts running properly.
          logger.error({ err, podcastId }, "Error initiating background podcast processing task.");
          // We might still attempt a final 'failed' status update here, but the background task's
          // own error handling should ideally catch processing errors.
          // Optionally update status here as a fallback, but avoid complex logic.
          // Example:
          // ctx.db.update(schema.podcast).set({ status: 'failed', errorMessage: 'Background task init failed' }).where(eq(schema.podcast.id, podcastId)).catch(e => logger.error({e}, "Fallback status update failed"));
        });

        // 3. Return the initial podcast object immediately
        return initialPodcast;

      } catch (error) {
        // This outer catch now primarily handles errors during the *initial* transaction
        // or validation before the background task is triggered.
        logger.error({ err: error }, 'Outer error during initial podcast creation (before background task)');

        // Attempt to mark as failed if we have an ID, even if initial creation failed mid-way
        // This might be redundant if the transaction itself rolled back, but safe to include.
        if (initialPodcast?.id) {
          try {
            await ctx.db
              .update(schema.podcast)
              .set({
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown creation error',
              })
              .where(eq(schema.podcast.id, initialPodcast.id));
            logger.info({ podcastId: initialPodcast.id }, 'Marked podcast as failed due to outer catch block error.');
          } catch (updateError) {
            logger.error({ podcastId: initialPodcast.id, updateError }, 'CRITICAL: Failed to mark podcast as failed even in the outer catch block.');
          }
        }

        if (error instanceof TRPCError) throw error; // Re-throw TRPC errors

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process podcast creation.',
          cause: error instanceof Error ? error : undefined,
        });
      }
    }),

  myPodcasts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const logger = ctx.logger.child({ userId, procedure: 'myPodcasts' }); // Use ctx.logger
    logger.info('Fetching podcasts for user');

    try {
        const results = await ctx.db.query.podcast.findMany({
            where: eq(schema.podcast.userId, userId),
            orderBy: desc(schema.podcast.createdAt),
            // Explicitly list needed columns if not all are required
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
    const logger = ctx.logger.child({ userId, podcastId, procedure: 'byId' }); // Use ctx.logger
    logger.info('Fetching podcast by ID');

    try {
        // Manual join approach
        const results = await ctx.db
          .select()
          .from(schema.podcast)
          .leftJoin(
            schema.transcript,
            eq(schema.podcast.id, schema.transcript.podcastId),
          )
          .where(eq(schema.podcast.id, podcastId))
          .limit(1);

        if (!results || results.length === 0 || !results[0]) {
          logger.warn('Podcast not found');
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Podcast with ID '${podcastId}' not found.`,
          });
        }

        const resultObj = results[0];
        const foundPodcast = resultObj.podcast;
        const foundTranscript = resultObj.transcript;

        if (!foundPodcast) {
          logger.error(`Inconsistent state: Podcast data missing for ID '${podcastId}' despite query returning results.`);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve complete podcast data.' });
        }

        if (foundPodcast.userId !== userId) {
          logger.warn('Unauthorized access attempt');
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to view this podcast.' });
        }

        logger.info('Successfully fetched podcast by ID');
        return {
          ...foundPodcast,
          // Ensure transcript is included, even if null
          transcript: foundTranscript ?? null,
        };
    } catch(error) {
        logger.error({ err: error }, 'Failed to fetch podcast by ID');
         if (error instanceof TRPCError) throw error; // Re-throw specific TRPC errors
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
      const logger = ctx.logger.child({ userId, podcastId, procedure: 'delete' }); // Use ctx.logger
      logger.info('Attempting to delete podcast');

      // 1. Verify ownership first
      let podcast;
      try {
        podcast = await ctx.db.query.podcast.findFirst({
            where: eq(schema.podcast.id, podcastId),
            columns: { id: true, userId: true }, // Only fetch necessary columns
        });
      } catch (error){
         logger.error({ err: error }, 'Error verifying podcast ownership');
         throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not verify podcast ownership.' });
      }


      if (!podcast) {
         logger.warn('Podcast not found for deletion');
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Podcast with ID '${podcastId}' not found.`,
        });
      }

      if (podcast.userId !== userId) {
         logger.warn('Unauthorized deletion attempt');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete this podcast.',
        });
      }

      // 2. Delete the podcast (and related transcripts due to cascade delete in schema)
      try {
        logger.info('Ownership verified, proceeding with deletion.');
        const result = await ctx.db
          .delete(schema.podcast)
          .where(and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId))) // Redundant user check, but safe
          .returning({ deletedId: schema.podcast.id });

        if (!result || result.length === 0 || !result[0]?.deletedId) {
           logger.error('Deletion query executed but did not return the expected deleted ID.');
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to confirm podcast deletion.' });
        }

         logger.info('Podcast deleted successfully');
        return { success: true, deletedId: result[0].deletedId };
      } catch (error) {
        logger.error({ err: error }, `Failed to delete podcast ID '${podcastId}'`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete podcast.',
          cause: error instanceof Error ? error : undefined,
        });
      }
    }),
});

export default podcastRouter;