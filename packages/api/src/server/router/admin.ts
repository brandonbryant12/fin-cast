import { count, desc, eq, sql } from '@repo/db';
import * as schema from '@repo/db/schema';
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
     // Subquery to count successful podcasts per user
     const sq = ctx.db.$with('sq').as(
      ctx.db.select({
       userId: schema.podcast.userId,
       successfulPodcastCount: count(schema.podcast.id).as('successful_podcast_count'),
      })
      .from(schema.podcast)
      .where(eq(schema.podcast.status, 'success'))
      .groupBy(schema.podcast.userId)
     );

     // Fetch paginated users and join with the podcast count subquery
     const usersData = await ctx.db.with(sq).select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      isAdmin: schema.user.isAdmin,
      createdAt: schema.user.createdAt,
      successfulPodcastCount: sql<number>`COALESCE(${sq.successfulPodcastCount}, 0)::int`.as('successful_podcast_count'),
     })
     .from(schema.user)
     .leftJoin(sq, eq(schema.user.id, sq.userId))
     .orderBy(desc(schema.user.createdAt))
     .limit(pageSize)
     .offset(offset);

     // Fetch total user count
     const totalUsersResult = await ctx.db.select({
      count: count(schema.user.id),
     }).from(schema.user);

     const totalCount = totalUsersResult[0]?.count ?? 0;
     const totalPages = Math.ceil(totalCount / pageSize);

     procedureLogger.info({ userCount: usersData.length, totalCount, totalPages }, 'Successfully fetched paginated users');

     return {
      users: usersData,
      pagination: {
       currentPage: page,
       pageSize: pageSize,
       totalCount: totalCount,
       totalPages: totalPages,
      },
     };
    } catch (error) {
     procedureLogger.error({ err: error }, 'Failed to fetch paginated users');
     throw new Error('Failed to fetch users'); // Consider more specific error handling if needed
    }
   }),
 });
};