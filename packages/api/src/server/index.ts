import { type ReviewService } from '@repo/reviews'; // Added
import type { AuthInstance } from '@repo/auth/server';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { PodcastService } from '@repo/podcast';
import type { TTSService } from '@repo/tts';
import { createAdminRouter } from './router/admin';
import { createAuthRouter } from './router/auth';
import { createPodcastRouter } from './router/podcast';
import { createPostRouter } from './router/post';
import { createReviewRouter } from './router/review';
import { createTRPCContext as createTRPCContextInternal, router } from './trpc';


export const createAppRouter = ({ podcast, reviewService }: { podcast: PodcastService, reviewService: ReviewService }) => {
 return router({
  admin: createAdminRouter(),
  auth: createAuthRouter(),
  post: createPostRouter(),
  podcasts: createPodcastRouter({ podcast }),
  reviews: createReviewRouter({ reviewService }),
 });
};

export type AppRouter = ReturnType<typeof createAppRouter>;

interface CreateApiOptions {
  auth: AuthInstance;
  db: DatabaseInstance;
  logger: AppLogger;
  tts: TTSService;
  podcast: PodcastService;
  reviewService: ReviewService;
}

export const createApi = ({
  auth,
  db,
  logger,
  podcast,
  reviewService,
}: CreateApiOptions) => {
  const mainRouter = createAppRouter({ podcast, reviewService });
  return {
    trpcRouter: mainRouter,
    createTRPCContext: ({ headers }: { headers: Headers }) =>
      createTRPCContextInternal({ auth, db, headers, logger }),
  };
};