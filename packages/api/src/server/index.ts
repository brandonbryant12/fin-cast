import type { TTSService } from '@repo/ai';
import type { AuthInstance } from '@repo/auth/server';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { PodcastService } from '@repo/podcast';;
import podcastRouter from './router/podcast';
import postRouter from './router/post';
import ttsRouter from './router/tts';
import { createTRPCContext as createTRPCContextInternal, router } from './trpc';

export const appRouter = router({
  post: postRouter,
  podcasts: podcastRouter,
  tts: ttsRouter,
});

export type AppRouter = typeof appRouter;

export const createApi = ({
  auth,
  db,
  logger,
  podcast,
  tts,
}: {
  auth: AuthInstance;
  db: DatabaseInstance;
  logger: AppLogger;
  tts: TTSService;
  podcast: PodcastService;
}) => {
  return {
    trpcRouter: appRouter,
    createTRPCContext: ({ headers }: { headers: Headers }) =>
      createTRPCContextInternal({ auth, db, headers, tts, logger, podcast }),
  };
};
