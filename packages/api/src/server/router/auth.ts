import { protectedProcedure, router } from '../trpc';

export const createAuthRouter = () => {
 return router({
  isAdminStatus: protectedProcedure.query(({ ctx }) => {
   ctx.logger.info({ userId: ctx.session.user.id, isAdmin: ctx.isAdmin }, 'Checking admin status');
   return { isAdmin: ctx.isAdmin };
  }),
 });
};