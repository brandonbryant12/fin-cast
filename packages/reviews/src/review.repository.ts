import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import type { DatabaseInstance } from '@repo/db/client';
import type { Review } from '@repo/db/schema';

type ReviewWithUser = Review & { user: { name: string | null, image: string | null } | null };

// Define the allowed content types
type ReviewContentType = (typeof schema.reviewContentTypeEnum.enumValues)[number];

export class ReviewRepository {
    private readonly db: DatabaseInstance;

    constructor(db: DatabaseInstance) {
        this.db = db;
    }

    /**
     * Creates a new review in the database.
     */
    async createReview(
        userId: string,
        entityId: string,
        contentType: ReviewContentType,
        stars: number,
        feedback: string | null | undefined
    ): Promise<Review> {
        const [newReview] = await this.db.insert(schema.review)
            .values({
                userId,
                entityId,
                contentType,
                stars,
                feedback: feedback ?? null, // Ensure null if undefined/null
            })
            .returning();

        if (!newReview) {
            throw new Error('Failed to create review entry.');
        }
        return newReview;
    }

    /**
     * Retrieves reviews for a specific entity, ordered by creation date descending.
     * Includes basic user information (name, image).
     */
    async getReviewsByEntity(entityId: string, contentType: ReviewContentType): Promise<ReviewWithUser[]> {
        const results = await this.db.query.review.findMany({
            where: and(
                eq(schema.review.entityId, entityId),
                eq(schema.review.contentType, contentType)
            ),
            orderBy: desc(schema.review.createdAt),
            with: {
                user: { // Include user details
                    columns: {
                        name: true,
                        image: true,
                    }
                }
            },
            columns: { // Explicitly select review columns needed
              id: true,
              userId: true,
              entityId: true,
              contentType: true,
              stars: true,
              feedback: true,
              createdAt: true,
              updatedAt: true,
            }
        });
        return results;
    }
}