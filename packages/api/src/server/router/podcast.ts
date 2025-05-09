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

const DialogueSegmentSchema = v.object({
    speaker: v.string(),
    line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});

const UpdatePodcastInput = v.pipe(
    v.object({
        podcastId: v.pipe(v.string(), v.uuid('Invalid podcast ID format')),
        title: v.optional(v.pipe(v.string(), v.minLength(1, 'Title cannot be empty.'))),
        summary: v.optional(v.pipe(v.string(), v.minLength(1, 'Summary cannot be empty.'))), // Added summary
        content: v.optional(v.pipe(v.array(DialogueSegmentSchema), v.minLength(1, 'Podcast content must contain at least one segment.'))),
        hostPersonalityId: v.optional(v.enum(PersonalityId, 'Invalid host personality selected')),
        cohostPersonalityId: v.optional(v.enum(PersonalityId, 'Invalid co-host personality selected')),
      }),
      v.check(
        (input) =>
            input.title !== undefined ||
            input.summary !== undefined ||
            input.content !== undefined ||
            input.hostPersonalityId !== undefined ||
            input.cohostPersonalityId !== undefined,
          'At least one field (title, summary, content, hostPersonalityId, cohostPersonalityId) must be provided for update.'
        )
);


export type UpdatePodcastInputType = v.InferInput<typeof UpdatePodcastInput>;

export const createPodcastRouter = ({ podcast }: { podcast: PodcastService}) => {
  return router({
    create: protectedProcedure
        .input(CreatePodcastInput)
        .mutation(async ({ ctx, input }): Promise<SelectPodcast> => {
            const userId = ctx.session.user.id;
            const procedureLogger = ctx.logger.child({ userId, sourceUrl: input.sourceUrl, procedure: 'createPodcast' });
            const initialPodcast = await podcast.createPodcast(userId, input.sourceUrl, input.hostPersonalityId, input.cohostPersonalityId);
            procedureLogger.info({ podcastId: initialPodcast.id }, 'Podcast creation initiated by service.');
            return initialPodcast;
        }),

    myPodcasts: protectedProcedure
        .query(async ({ ctx }) =>  podcast.getMyPodcasts(ctx.session.user.id)),
    byId: protectedProcedure
        .input(GetPodcastByIdInput)
        .query(async ({ input }) => podcast.getPodcastById(input.id)),
    delete: protectedProcedure
        .input(DeletePodcastInput)
        .mutation(async ({ ctx, input }): Promise<{ success: boolean; deletedId?: string, error?: string  }> => {
            return podcast.deletePodcast(ctx.session.user.id, input.id);
        }),
    update: protectedProcedure
        .input(UpdatePodcastInput)
        .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
            const result = await podcast.updatePodcast(ctx.session.user.id, input);
            return result;
        }),
    getAvailablePersonalities: protectedProcedure
        .query(() =>  podcast.getAvailablePersonalities())
  });
};