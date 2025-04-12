import { PersonalityId } from '@repo/ai';
import * as schema from '@repo/db/schema';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import { protectedProcedure, router } from '../trpc';

type SelectPodcast = typeof schema.podcast.$inferSelect;

const CreatePodcastInput = v.pipe(
    v.object({
        sourceUrl: v.pipe(v.string('Source must be a string'), v.url('Please provide a valid URL')),
        hostPersonalityId: v.enum(PersonalityId, 'Invalid host personality selected'),
        cohostPersonalityId: v.enum(PersonalityId, 'Invalid co-host personality selected'),
    }),
    v.forward(
        v.check(
            (input) => input.hostPersonalityId !== input.cohostPersonalityId,
            'Host and co-host personalities must be different.'
        ),
        ['cohostPersonalityId']
    )
);

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
        // Use the correct inferred type
        .mutation(async ({ ctx, input }): Promise<SelectPodcast> => {
            const userId = ctx.session.user.id;
            const logger = ctx.logger.child({ userId, sourceUrl: input.sourceUrl, procedure: 'createPodcast' });

            try {
                logger.info('Calling PodcastService.createPodcast');
                // Delegate creation and background job trigger to the service
                const initialPodcast = await ctx.podcast.createPodcast(userId, input.sourceUrl, input.hostPersonalityId, input.cohostPersonalityId);
                logger.info({ podcastId: initialPodcast.id }, 'Podcast creation initiated by service.');
                // The service returns the initial podcast object (status: 'processing')
                return initialPodcast;

            } catch (error) {
                logger.error({ err: error }, 'Error calling PodcastService.createPodcast');

                // Convert service errors to TRPC errors
                if (error instanceof Error) {
                    // Could add more specific error checks if the service threw custom errors
                     throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: `Failed to initiate podcast creation: ${error.message}`,
                        cause: error,
                    });
                }
                // Fallback for unknown errors
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to initiate podcast creation due to an unknown error.',
                    cause: error,
                });
            }
        }),

    myPodcasts: protectedProcedure
        // Use the correct inferred type
        .query(async ({ ctx }): Promise<SelectPodcast[]> => {
            const userId = ctx.session.user.id;
            const logger = ctx.logger.child({ userId, procedure: 'myPodcasts' });

            try {
                logger.info('Calling PodcastService.getMyPodcasts');
                const results = await ctx.podcast.getMyPodcasts(userId);
                logger.info({ count: results.length }, 'Successfully fetched podcasts via service');
                return results;
            } catch (error) {
                logger.error({ err: error }, 'Error calling PodcastService.getMyPodcasts');
                 throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: error instanceof Error ? error.message : 'Could not retrieve your podcasts.',
                    cause: error instanceof Error ? error : undefined,
                });
            }
        }),

    byId: protectedProcedure
        .input(GetPodcastByIdInput)
        // The service returns Podcast & { transcript: Transcript | null }
        // We can let TypeScript infer this or define a specific type if needed often
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const podcastId = input.id;
            const logger = ctx.logger.child({ userId, podcastId, procedure: 'byId' });

            try {
                logger.info('Calling PodcastService.getPodcastById');
                // Service handles fetching, joining, and authorization
                const result = await ctx.podcast.getPodcastById(userId, podcastId);
                logger.info('Successfully fetched podcast by ID via service');
                return result; // Return the combined object from the service
            } catch(error) {
                logger.error({ err: error }, 'Error calling PodcastService.getPodcastById');

                 // Handle specific errors thrown by the service
                if (error instanceof Error) {
                    if (error.message.startsWith('Podcast not found')) {
                        throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
                    }
                    if (error.message === 'Unauthorized access') {
                        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to view this podcast.' });
                    }
                     // Fallback for other errors from the service
                     throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: `Could not retrieve the podcast: ${error.message}`,
                        cause: error,
                    });
                }
                // Fallback for non-Error throws
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Could not retrieve the podcast due to an unknown error.',
                    cause: error,
                });
            }
        }),

    delete: protectedProcedure
        .input(DeletePodcastInput)
        // Return type is fine as it is
        .mutation(async ({ ctx, input }): Promise<{ success: boolean; deletedId?: string, error?: string  }> => {
            const userId = ctx.session.user.id;
            const podcastId = input.id;
            const logger = ctx.logger.child({ userId, podcastId, procedure: 'delete' });

            try {
                logger.info('Calling PodcastService.deletePodcast');
                // Service handles verification, authorization, and deletion
                const result = await ctx.podcast.deletePodcast(userId, podcastId);
                logger.info('Podcast deleted successfully via service');
                return result;
            } catch (error) {
                 logger.error({ err: error }, `Error calling PodcastService.deletePodcast`);

                 // Handle specific errors thrown by the service
                if (error instanceof Error) {
                     if (error.message.startsWith('Podcast not found')) {
                        throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
                    }
                    if (error.message === 'Unauthorized delete') { // Match service error message
                        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You do not have permission to delete this podcast.' });
                    }
                     // Fallback for other errors from the service
                    throw new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: `Failed to delete podcast: ${error.message}`,
                        cause: error,
                    });
                }
                // Fallback for non-Error throws
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to delete podcast due to an unknown error.',
                    cause: error,
                });
            }
        }),
});

export default podcastRouter;