import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import { scrape, ScraperError } from '@repo/webscraper'; // Ensure this resolves correctly
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import { logger as apiLogger } from '../../config/logger'; // Import the API's logger

import { protectedProcedure, router } from '../trpc';

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
      const logger = apiLogger.child({ userId, sourceUrl: input.sourceUrl, procedure: 'createPodcast' }); // Create child logger for context

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
        logger.info({ podcastId }, 'Initial podcast and transcript created, proceeding to scrape.');


        // 2. Attempt to Scrape the URL *after* creation
        try {
          // Pass the API's logger instance to the scrape function
          const html = await scrape(input.sourceUrl, { logger }); // Pass the contextual logger
          logger.info({ podcastId, length: html.length }, 'Successfully scraped URL.');

          // 3a. If scrape succeeds, update with mock audio data and 'success' status
          // TODO: Replace mock data with actual audio generation logic
          const mockAudioData = 'data:audio/mpeg;base64,SUQzBAAAAAAB...'; // Placeholder
          const generatedTime = new Date();
          logger.info({ podcastId }, 'Updating podcast status to success with mock audio.');

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
            logger.error({ podcastId }, 'Failed to update podcast status to success after scrape.');
            // Consider if this should be an internal error or if the client should see 'processing'
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to finalize podcast status after successful scrape.' });
          }
          logger.info({ podcastId }, 'Podcast status updated to success.');
          return updatedPodcast;

        } catch (scrapeError) {
          // 3b. If scrape fails, update status to 'failed' and store error message
          logger.warn({ podcastId, err: scrapeError }, 'Scraping failed, marking podcast as failed.');

          let errorMessage = 'Scraping failed.';
          if (scrapeError instanceof ScraperError) {
            errorMessage = `Scraping failed: ${scrapeError.message}`;
          } else if (scrapeError instanceof Error) {
            errorMessage = `Scraping failed: ${scrapeError.message}`;
          }

          const [failedPodcast] = await ctx.db
            .update(schema.podcast)
            .set({
              status: 'failed',
              errorMessage: errorMessage,
            })
            .where(eq(schema.podcast.id, podcastId))
            .returning();

          if (!failedPodcast) {
            logger.error({ podcastId }, 'Failed to update podcast status to FAILED after scraping error.');
            // This is a critical state inconsistency
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update podcast status after scraping error.' });
          }
          logger.warn({ podcastId, errorMessage }, 'Podcast status updated to failed.');
          // Return the failed podcast object so the UI knows the final state
          return failedPodcast;
        }

      } catch (error) {
        logger.error({ err: error }, 'Outer error during podcast creation process');

        // Attempt to mark as failed if we have an ID, even if initial creation failed mid-way
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
    const logger = apiLogger.child({ userId, procedure: 'myPodcasts' });
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
    const logger = apiLogger.child({ userId, podcastId, procedure: 'byId' });
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
      const logger = apiLogger.child({ userId, podcastId, procedure: 'delete' });
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