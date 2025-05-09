import { reviewContentTypeEnum } from '@repo/db/schema';
import * as v from 'valibot';

import type { ReviewService } from '@repo/reviews';
import { adminProcedure, protectedProcedure, router } from '../trpc';

const ValibotContentTypeEnum = reviewContentTypeEnum.enumValues.reduce((acc, value) => {
  acc[value] = value;
  return acc;
}, {} as Record<typeof reviewContentTypeEnum.enumValues[number], typeof reviewContentTypeEnum.enumValues[number]>);

const ContentTypeSchema = v.optional(v.enum(ValibotContentTypeEnum, 'Invalid content type'), 'podcast');

export const AddReviewInputSchema = v.object({
  entityId: v.pipe(v.string(), v.uuid('Invalid entity ID format')),
  contentType: ContentTypeSchema,
  stars: v.pipe(v.number(), v.minValue(1, 'Rating must be at least 1'), v.maxValue(5, 'Rating cannot exceed 5')),
  feedback: v.optional(v.string()),
});

export const GetReviewsInputSchema = v.object({
  entityId: v.pipe(v.string(), v.uuid('Invalid entity ID format')),
  contentType: ContentTypeSchema,
});

export const createReviewRouter = ({ reviewService }: { reviewService: ReviewService }) => {
  return router({
    add: protectedProcedure
      .input(AddReviewInputSchema)
      .mutation(async ({ ctx, input }) => reviewService.addReview(ctx.session.user.id, {
          entityId: input.entityId,
          contentType: input.contentType, 
          stars: input.stars,
          feedback: input.feedback,
    })),
    byEntityId: protectedProcedure
      .input(GetReviewsInputSchema)
      .query(async ({ input }) =>  reviewService.getReviews({
        entityId: input.entityId,
        contentType: input.contentType, 
      }))
  });
}; 