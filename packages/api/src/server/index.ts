import type { AuthInstance } from '@repo/auth/server';
import type { DatabaseInstance } from '@repo/db/client';
import podcastRouter from './router/podcast';
import postRouter from './router/post';
import { createTRPCContext as createTRPCContextInternal, router } from './trpc';

export const appRouter = router({
  post: postRouter,
  podcasts: podcastRouter,
});

export type AppRouter = typeof appRouter;

export const createApi = ({
  auth,
  db,
}: {
  auth: AuthInstance;
  db: DatabaseInstance;
}) => {
  return {
    trpcRouter: appRouter,
    createTRPCContext: ({ headers }: { headers: Headers }) =>
      createTRPCContextInternal({ auth, db, headers }),
  };
};
