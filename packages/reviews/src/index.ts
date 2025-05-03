export { createReviewService } from './review.service';
export type { ReviewService } from './review.service';
export type { Review, NewReview } from '@repo/db/schema';

/**
 * A well-known UUID to represent the application itself for app-level reviews.
 */
export const APP_ENTITY_ID = '00000000-0000-0000-0000-000000000000';