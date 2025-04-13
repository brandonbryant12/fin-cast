import * as schema from '@repo/db/schema';
import { PersonalityId } from '@repo/podcast';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';

import type { PodcastService } from '@repo/podcast';
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


export const createPodcastRouter = ({ podcast }: { podcast: PodcastService}) => {
  return router({
    create: protectedProcedure
        .input(CreatePodcastInput)
        .mutation(async ({ ctx, input }): Promise<SelectPodcast> => {
            const userId = ctx.session.user.id;
            const procedureLogger = ctx.logger.child({ userId, sourceUrl: input.sourceUrl, procedure: 'createPodcast' });

            try {
                procedureLogger.info('Calling PodcastService.createPodcast');
                const initialPodcast = await podcast.createPodcast(userId, input.sourceUrl, input.hostPersonalityId, input.cohostPersonalityId);
                procedureLogger.info({ podcastId: initialPodcast.id }, 'Podcast creation initiated by service.');
                return initialPodcast;
            } catch (error) {
                procedureLogger.error({ err: error }, 'Error calling PodcastService.createPodcast');
                 if (error instanceof Error) {
                     throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to initiate podcast creation: ${error.message}`, cause: error });
                 }
                 throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initiate podcast creation due to an unknown error.', cause: error });
            }
        }),

    myPodcasts: protectedProcedure
        .query(async ({ ctx }): Promise<SelectPodcast[]> => {
            const userId = ctx.session.user.id;
            const procedureLogger = ctx.logger.child({ userId, procedure: 'myPodcasts' });
            try {
                procedureLogger.info('Calling PodcastService.getMyPodcasts');
                const results = await podcast.getMyPodcasts(userId);
                procedureLogger.info({ count: results.length }, 'Successfully fetched podcasts via service');
                return results;
            } catch (error) {
                 procedureLogger.error({ err: error }, 'Error calling PodcastService.getMyPodcasts');
                  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Could not retrieve your podcasts.', cause: error instanceof Error ? error : undefined });
            }
        }),

    byId: protectedProcedure
        .input(GetPodcastByIdInput)
        .query(async ({ ctx, input }) => {
            const userId = ctx.session.user.id;
            const podcastId = input.id;
            const procedureLogger = ctx.logger.child({ userId, podcastId, procedure: 'byId' });
            try {
                procedureLogger.info('Calling PodcastService.getPodcastById');
                const result = await podcast.getPodcastById(userId, podcastId);
                procedureLogger.info('Successfully fetched podcast by ID via service');
                return result;
            } catch(error) {
                 procedureLogger.error({ err: error }, 'Error calling PodcastService.getPodcastById');
                  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not retrieve the podcast due to an unknown error.', cause: error });
            }
        }),

    delete: protectedProcedure
        .input(DeletePodcastInput)
        .mutation(async ({ ctx, input }): Promise<{ success: boolean; deletedId?: string, error?: string  }> => {
            const userId = ctx.session.user.id;
            const podcastId = input.id;
            const procedureLogger = ctx.logger.child({ userId, podcastId, procedure: 'delete' });
            try {
                procedureLogger.info('Calling PodcastService.deletePodcast');
                const result = await podcast.deletePodcast(userId, podcastId);
                procedureLogger.info('Podcast deleted successfully via service');
                return result;
            } catch (error) {
                 procedureLogger.error({ err: error }, `Error calling PodcastService.deletePodcast`);
                  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete podcast due to an unknown error.', cause: error });
            }
        }),

    getAvailablePersonalities: protectedProcedure
        .query(async ({ ctx }) => {
             const procedureLogger = ctx.logger.child({ userId: ctx.session.user.id, procedure: 'getAvailablePersonalities' });
             procedureLogger.info('Fetching available personalities');
            const voices = await podcast.getAvailablePersonalities();
            return voices; 
        }),
  });
};
