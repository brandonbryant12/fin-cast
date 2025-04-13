import type { TTSService } from '@repo/ai';
import type { AuthInstance } from '@repo/auth/server';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { PodcastService } from '@repo/podcast';
import { createPodcastRouter } from './router/podcast';
import { createPostRouter } from './router/post';
import { createTRPCContext as createTRPCContextInternal, router } from './trpc';


export const createAppRouter = ({ podcast }: { podcast: PodcastService}) => {
  return router({
    post: createPostRouter(),
    podcasts: createPodcastRouter({ podcast }),
  });
};

export type AppRouter = ReturnType<typeof createAppRouter>;

interface CreateApiOptions {
  auth: AuthInstance;
  db: DatabaseInstance;
  logger: AppLogger;
  tts: TTSService;
  podcast: PodcastService;
}

// Updated createApi function
export const createApi = ({
  auth,
  db,
  logger,
  podcast,
}: CreateApiOptions) => {
  const mainRouter = createAppRouter({ podcast });
  return {
    trpcRouter: mainRouter,
    createTRPCContext: ({ headers }: { headers: Headers }) =>
      createTRPCContextInternal({ auth, db, headers, logger }),
  };
};