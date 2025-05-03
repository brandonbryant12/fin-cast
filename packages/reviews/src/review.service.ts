import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import type { DatabaseInstance } from '@repo/db/client';
import type { Review } from '@repo/db/schema';
import type { AppLogger } from '@repo/logger';
import { ReviewRepository } from './review.repository';

export const AddReviewInputSchema = v.object({
    entityId: v.pipe(v.string(), v.uuid('Invalid entity ID format.')),
    contentType: v.literal('podcast', 'Only podcast reviews are currently supported'),
    stars: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)),
    feedback: v.optional(v.pipe(v.string(), v.maxLength(400, 'Feedback cannot exceed 400 characters.'))),
});
export type AddReviewInput = v.InferInput<typeof AddReviewInputSchema>;

export const GetReviewsInputSchema = v.object({
    entityId: v.pipe(v.string(), v.uuid('Invalid entity ID format.')),
    contentType: v.literal('podcast', 'Only podcast reviews are currently supported'),
});
export type GetReviewsInput = v.InferInput<typeof GetReviewsInputSchema>;


interface ReviewServiceDependencies {
    db: DatabaseInstance;
    logger: AppLogger;
}

export class ReviewService {
    private readonly reviewRepository: ReviewRepository;
    private readonly logger: AppLogger;

    constructor({ db, logger }: ReviewServiceDependencies) {
        this.reviewRepository = new ReviewRepository(db);
        this.logger = logger.child({ service: 'ReviewService' });
        this.logger.info('ReviewService initialized');
    }

    /**
     * Adds a new review after validation.
     */
    async addReview(userId: string, input: AddReviewInput): Promise<Review> {
        const logger = this.logger.child({ userId, entityId: input.entityId, method: 'addReview' });
        logger.info('Attempting to add review.');

        try {
            const newReview = await this.reviewRepository.createReview(
                userId,
                input.entityId,
                input.contentType,
                input.stars,
                input.feedback
            );
            logger.info({ reviewId: newReview.id }, 'Review added successfully.');
            return newReview;
        } catch (error) {
            logger.error({ err: error }, 'Failed to add review to repository.');
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save your review.' });
        }
    }

    /**
     * Gets reviews for a specific entity.
     */
    async getReviews(input: GetReviewsInput) {
        const logger = this.logger.child({ entityId: input.entityId, contentType: input.contentType, method: 'getReviews' });
        logger.info('Fetching reviews for entity.');

        try {
            const reviews = await this.reviewRepository.getReviewsByEntity(input.entityId, input.contentType);
            logger.info(`Workspaceed ${reviews.length} reviews.`);
            return reviews;
        } catch (error) {
             logger.error({ err: error }, 'Failed to fetch reviews from repository.');
             throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not fetch reviews.' });
        }
    }
}

export function createReviewService(dependencies: ReviewServiceDependencies): ReviewService {
 return new ReviewService(dependencies);
}