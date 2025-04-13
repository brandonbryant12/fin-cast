import { desc, eq } from '@repo/db';
import { CreatePostSchema, post, user } from '@repo/db/schema';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import { protectedProcedure, publicProcedure, router } from '../trpc';

export const createPostRouter = () => {
  return router({
    all: protectedProcedure.query(({ ctx }) => {
      ctx.logger.info({ userId: ctx.session.user.id, procedure: 'post.all' }, 'Fetching all posts');
      return ctx.db.query.post.findMany({
        columns: { id: true, title: true, createdAt: true },
        orderBy: desc(post.createdAt),
      });
    }),

    one: publicProcedure
      .input(v.object({ id: v.pipe(v.string(), v.uuid()) }))
      .query(async ({ ctx, input }) => {
        ctx.logger.info({ postId: input.id, procedure: 'post.one' }, 'Fetching single post');
        const [dbPost] = await ctx.db
          .select()
          .from(post)
          .innerJoin(user, eq(post.createdBy, user.id))
          .where(eq(post.id, input.id));

        if (!dbPost) {
          ctx.logger.warn({ postId: input.id, procedure: 'post.one' }, 'Post not found');
          throw new TRPCError({ code: 'BAD_REQUEST', message: `No such post with ID ${input.id}` });
        }
        return dbPost;
      }),

    create: protectedProcedure
      .input(CreatePostSchema)
      .mutation(async ({ ctx, input }) => {
       ctx.logger.info({ userId: ctx.session.user.id, procedure: 'post.create', title: input.title }, 'Creating post');
        await ctx.db.insert(post).values({
          createdBy: ctx.session.user.id,
          ...input,
        });
        return {};
      }),

    delete: protectedProcedure
      .input(v.object({ id: v.pipe(v.string(), v.uuid()) }))
      .mutation(async ({ ctx, input }) => {
         ctx.logger.info({ userId: ctx.session.user.id, postId: input.id, procedure: 'post.delete' }, 'Deleting post');
        const res = await ctx.db.delete(post).where(eq(post.id, input.id));
        if (res.rowCount === 0) {
           ctx.logger.warn({ userId: ctx.session.user.id, postId: input.id, procedure: 'post.delete' }, 'Post not found for deletion');
          throw new TRPCError({ code: 'BAD_REQUEST', message: `No such post with id ${input.id}` });
        }
        return {};
      }),
  });
};
