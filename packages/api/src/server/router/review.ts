import { TRPCError } from '@trpc/server';
import * as v from 'valibot';

import type { ReviewService } from '@repo/reviews';
import { protectedProcedure, router } from '../trpc';

export const AddReviewInputSchema = v.object({
  entityId: v.pipe(v.string(), v.uuid('Invalid entity ID format')),
  contentType: v.literal('podcast', 'Only podcast reviews are currently supported'),
  stars: v.pipe(v.number(), v.minValue(1, 'Rating must be at least 1'), v.maxValue(5, 'Rating cannot exceed 5')),
  feedback: v.optional(v.string()),
});

export const GetReviewsInputSchema = v.object({
  entityId: v.pipe(v.string(), v.uuid('Invalid entity ID format')),
  contentType: v.literal('podcast', 'Only podcast reviews are currently supported'),
});

export const createReviewRouter = ({ reviewService }: { reviewService: ReviewService }) => {
  return router({
    /**
     * Adds a new review for a specific entity.
     */
    add: protectedProcedure
      .input(AddReviewInputSchema)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const procedureLogger = ctx.logger.child({ userId, entityId: input.entityId, procedure: 'addReview' });
        
        try {
          procedureLogger.info('Calling ReviewService.addReview');
          const result = await reviewService.addReview(userId, {
            ...input,
            contentType: 'podcast', // Ensure correct type
          });
          procedureLogger.info('Review added successfully');
          return result;
        } catch (error) {
          procedureLogger.error({ err: error }, 'Error calling ReviewService.addReview');
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: error instanceof Error ? error.message : 'Failed to add review', 
            cause: error 
          });
        }
      }),

    /**
     * Gets all reviews for a specific entity ID and content type.
     */
    byEntityId: protectedProcedure
      .input(GetReviewsInputSchema)
      .query(async ({ ctx, input }) => {
        const userId = ctx.session.user.id;
        const procedureLogger = ctx.logger.child({ userId, entityId: input.entityId, procedure: 'getReviews' });
        
        try {
          procedureLogger.info('Calling ReviewService.getReviews');
          const results = await reviewService.getReviews({
            entityId: input.entityId,
            contentType: 'podcast',
          });
          procedureLogger.info({ count: results.length }, 'Successfully fetched reviews');
          return results;
        } catch (error) {
          procedureLogger.error({ err: error }, 'Error calling ReviewService.getReviews');
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: error instanceof Error ? error.message : 'Failed to get reviews', 
            cause: error 
          });
        }
      }),
  });
}; 