import { count, desc, eq, sql, and, avg } from '@repo/db';
import * as schema from '@repo/db/schema';
import { review, user } from '@repo/db/schema';
import { APP_ENTITY_ID } from '@repo/reviews';
import * as v from 'valibot';
import { adminProcedure, router } from '../trpc';

const GetUsersPaginatedInput = v.object({
  page: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  pageSize: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(50)), 10),
 });

export const createAdminRouter = () => {
 return router({
  getUsersPaginated: adminProcedure
   .input(GetUsersPaginatedInput)
   .query(async ({ ctx, input }) => {
    const { page, pageSize } = input;
    const offset = (page - 1) * pageSize;

    const procedureLogger = ctx.logger.child({ procedure: 'admin.getUsersPaginated', page, pageSize });
    procedureLogger.info('Fetching paginated users for admin');

    try {
     const podcastCountSq = ctx.db.$with('podcastCountSq').as(
      ctx.db.select({
       userId: schema.podcast.userId,
       successfulPodcastCount: count(schema.podcast.id).as('successful_podcast_count'),
      })
      .from(schema.podcast)
      .where(eq(schema.podcast.status, 'success'))
      .groupBy(schema.podcast.userId)
     );

     const usersData = await ctx.db.with(podcastCountSq).select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      isAdmin: schema.user.isAdmin,
      createdAt: schema.user.createdAt,
      successfulPodcastCount: sql<number>`COALESCE(${podcastCountSq.successfulPodcastCount}, 0)::int`.as('successful_podcast_count'),
      appReviewStars: schema.review.stars,
     })
     .from(schema.user)
     .leftJoin(podcastCountSq, eq(schema.user.id, podcastCountSq.userId))
     .leftJoin(
       schema.review,
       and(
        eq(schema.user.id, schema.review.userId),
        eq(schema.review.contentType, 'app'),
        eq(schema.review.entityId, APP_ENTITY_ID)
       )
      )
     .orderBy(desc(schema.user.createdAt))
     .limit(pageSize)
     .offset(offset);

     const totalUsersResult = await ctx.db.select({
      count: count(schema.user.id),
     }).from(schema.user);

     const totalCount = totalUsersResult[0]?.count ?? 0;
     const totalPages = Math.ceil(totalCount / pageSize);

     procedureLogger.info({ userCount: usersData.length, totalCount, totalPages }, 'Successfully fetched paginated users');

     const mappedUsers = usersData.map(u => ({
      ...u,
      appReviewStars: u.appReviewStars ?? 0
     }));

     return {
      users: mappedUsers,
      pagination: {
       currentPage: page,
       pageSize: pageSize,
       totalCount: totalCount,
       totalPages: totalPages,
      },
     };
    } catch (error) {
     procedureLogger.error({ err: error }, 'Failed to fetch paginated users');
     throw new Error('Failed to fetch users');
    }
   }),
  setUserAdminStatus: adminProcedure
   .input(v.object({
    userId: v.pipe(v.string(), v.minLength(1)),
    isAdmin: v.boolean(),
   }))
   .mutation(async ({ ctx, input }) => {
    const { userId, isAdmin } = input;
    const procedureLogger = ctx.logger.child({ procedure: 'admin.setUserAdminStatus', targetUserId: userId, setAdminStatusTo: isAdmin });

    if (ctx.session.user.id === userId && !isAdmin) {
      procedureLogger.warn('Admin attempted to remove their own admin status');
      throw new Error('Admins cannot remove their own admin status through this interface.');
    }

    procedureLogger.info('Attempting to update user admin status');
    try {
     const result = await ctx.db.update(schema.user)
      .set({ isAdmin: isAdmin })
      .where(eq(schema.user.id, userId))
      .returning({ updatedId: schema.user.id });

     if (result.length === 0) {
      procedureLogger.warn('User not found for admin status update');
      throw new Error('User not found.');
     }

     procedureLogger.info('User admin status updated successfully');
     return { success: true };
    } catch (error) {
     procedureLogger.error({ err: error }, 'Failed to update user admin status');
      if (error instanceof Error) {
        throw new Error(`Failed to update admin status: ${error.message}`);
      }
      throw new Error('An unknown error occurred while updating admin status.');
    }
   }),
   getReviewsPaginated: adminProcedure
    .input(v.object({ // Reusing GetUsersPaginatedInput structure, consider renaming/making generic
     page: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
     pageSize: v.fallback(v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(50)), 10),
    }))
    .query(async ({ ctx, input }) => {
     const { page, pageSize } = input;
     const offset = (page - 1) * pageSize;

     const procedureLogger = ctx.logger.child({ procedure: 'admin.getReviewsPaginated', page, pageSize });
     procedureLogger.info('Fetching paginated reviews for admin');

     try {
      const reviewsData = await ctx.db.query.review.findMany({
       orderBy: desc(schema.review.createdAt),
       limit: pageSize,
       offset: offset,
       with: {
        user: {
         columns: {
          name: true,
          email: true,
         },
        },
       },
      });

      const totalReviewsResult = await ctx.db.select({
       count: count(schema.review.id),
      }).from(schema.review);

      const totalCount = totalReviewsResult[0]?.count ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      procedureLogger.info({ reviewCount: reviewsData.length, totalCount, totalPages }, 'Successfully fetched paginated reviews');

      return {
       reviews: reviewsData,
       pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalCount: totalCount,
        totalPages: totalPages,
       },
      };
     } catch (error) {
      procedureLogger.error({ err: error }, 'Failed to fetch paginated reviews');
      throw new Error('Failed to fetch reviews');
      }
     }),
  getReviewStats: adminProcedure
    .query(async ({ ctx }) => {
      const procedureLogger = ctx.logger.child({ procedure: 'admin.getReviewStats' });
      procedureLogger.info('Fetching review statistics');

      try {
        const appStatsPromise = ctx.db.select({
            average: avg(schema.review.stars),
            count: count(schema.review.id),
          })
          .from(schema.review)
          .where(eq(schema.review.contentType, 'app'));

        const podcastStatsPromise = ctx.db.select({
            average: avg(schema.review.stars),
            count: count(schema.review.id),
          })
          .from(schema.review)
          .where(eq(schema.review.contentType, 'podcast'));

        const [appResult, podcastResult] = await Promise.all([appStatsPromise, podcastStatsPromise]);

        const appStats = appResult[0] ?? { average: null, count: 0 };
        const podcastStats = podcastResult[0] ?? { average: null, count: 0 };

        // Drizzle avg returns string | null, parse it
        const parseAvg = (avgStr: string | null): number => {
            if (avgStr === null || avgStr === undefined) return 0;
            try {
                return parseFloat(avgStr);
            } catch {
                return 0;
            }
        };

        const stats = {
          appAvgRating: parseAvg(appStats.average),
          appReviewCount: appStats.count,
          podcastAvgRating: parseAvg(podcastStats.average),
          podcastReviewCount: podcastStats.count,
        };

        procedureLogger.info({ stats }, 'Successfully fetched review statistics');
        return stats;

      } catch (error) {
        procedureLogger.error({ err: error }, 'Failed to fetch review statistics');
        throw new Error('Failed to fetch review statistics');
      }
    }),
 });
};