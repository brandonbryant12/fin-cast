import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import { logger } from '../../config/logger';

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
      try {
        const [initialPodcast] = await ctx.db.transaction(async (tx) => {
          const [createdPodcast] = await tx
            .insert(schema.podcast)
            .values({
              userId,
              title: `Podcast from ${input.sourceUrl}`,
              status: 'processing',
              sourceType: 'url',
              sourceDetail: input.sourceUrl,
            })
            .returning();

          if (!createdPodcast) {
            throw new Error('Failed to create podcast entry.');
          }

          // 2. Create the associated transcript entry (initially empty)
          await tx.insert(schema.transcript).values({
            podcastId: createdPodcast.id,
            content: '[Transcript processing...]',
            format: 'plain_text',
          });

          return [createdPodcast];
        });

        if (!initialPodcast) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Podcast creation failed during transaction.' });
        }

        // 3. Add mock base64 audio encoded url to the podcast and set as successful.
        const mockAudioData = 'data:audio/mpeg;base64,SUQzBAAAAAAB...';
        const generatedTime = new Date();

        const [updatedPodcast] = await ctx.db
          .update(schema.podcast)
          .set({
            status: 'success',
            audioUrl: mockAudioData,
            generatedAt: generatedTime,
          })
          .where(eq(schema.podcast.id, initialPodcast.id))
          .returning();
        
        if (!updatedPodcast) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to finalize podcast status.' });
        }

        return updatedPodcast;
      } catch (error) {
        logger.error({ err: error }, 'Failed to create podcast');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to initiate podcast creation.',
          cause: error instanceof Error ? error : undefined,
        });
      }
    }),

  myPodcasts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const results = await ctx.db
      .select({
        id: schema.podcast.id,
        userId: schema.podcast.userId,
        title: schema.podcast.title,
        description: schema.podcast.description,
        status: schema.podcast.status,
        sourceType: schema.podcast.sourceType,
        sourceDetail: schema.podcast.sourceDetail,
        audioUrl: schema.podcast.audioUrl,
        durationSeconds: schema.podcast.durationSeconds,
        errorMessage: schema.podcast.errorMessage,
        generatedAt: schema.podcast.generatedAt,
        createdAt: schema.podcast.createdAt,
      })
      .from(schema.podcast)
      .where(eq(schema.podcast.userId, userId))
      .orderBy(desc(schema.podcast.createdAt));

    return results;
  }),

  byId: protectedProcedure.input(GetPodcastByIdInput).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const podcastId = input.id;

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

    // Check if any result was returned
    if (!results || results.length === 0 || !results[0]) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Podcast with ID '${podcastId}' not found.`,
      });
    }

    const resultObj = results[0]; 
    const foundPodcast = resultObj.podcast;
    const foundTranscript = resultObj.transcript;

    if (!foundPodcast) {
        logger.error({ podcastId }, `Inconsistent state: Podcast data missing for ID '${podcastId}' despite query returning results.`);
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve complete podcast data.'
        });
    }

    if (foundPodcast.userId !== userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You do not have permission to view this podcast.',
      });
    }

    return {
      ...foundPodcast,
      transcript: foundTranscript,
    };
  }),

  delete: protectedProcedure
    .input(DeletePodcastInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const podcastId = input.id;

      // 1. Verify ownership first
      const podcast = await ctx.db.query.podcast.findFirst({
        where: eq(schema.podcast.id, podcastId),
        columns: { id: true, userId: true }, // Only fetch necessary columns for verification
      });

      if (!podcast) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Podcast with ID '${podcastId}' not found.`,
        });
      }

      if (podcast.userId !== userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to delete this podcast.',
        });
      }

      // 2. Delete the podcast
      try {
        const result = await ctx.db
          .delete(schema.podcast)
          .where(and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)))
          .returning({ deletedId: schema.podcast.id });

        // Explicit check for result and result[0] before accessing
        if (!result || result.length === 0 || !result[0]) {
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete podcast after ownership verification.' });
        }

        return { success: true, deletedId: result[0].deletedId };
      } catch (error) {
        logger.error({ podcastId, err: error }, `Failed to delete podcast ID '${podcastId}'`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete podcast.',
          cause: error instanceof Error ? error : undefined,
        });
      }
    }),
});

export default podcastRouter;