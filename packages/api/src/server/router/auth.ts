import { protectedProcedure, router } from '../trpc';

export const createAuthRouter = () => {
 return router({
  isAdminStatus: protectedProcedure.query(({ ctx }) => {
   return { isAdmin: ctx.isAdmin };
  }),
 });
};