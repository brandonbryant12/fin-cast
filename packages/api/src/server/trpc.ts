import { initTRPC, TRPCError } from '@trpc/server';
import SuperJSON from 'superjson';
import type { AuthInstance } from '@repo/auth/server';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';

export interface CreateContextOptions {
  auth: AuthInstance;
  db: DatabaseInstance;
  headers: Headers;
  logger: AppLogger;
}

export interface TRPCContext {
  db: DatabaseInstance;
  session: AuthInstance['$Infer']['Session'] | null;
  logger: AppLogger;
}

export const createTRPCContext = async ({
  auth,
  db,
  headers,
  logger,
}: CreateContextOptions): Promise<TRPCContext> => {
  const session = await auth.api.getSession({
    headers,
  });
  return {
    db,
    session,
    logger,
  };
};

export const t = initTRPC.context<TRPCContext>().create({
  transformer: SuperJSON,
});

export const router = t.router;

const timingMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const start = Date.now();
  let waitMs = 0;
  if (t._config.isDev) {
    waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  const result = await next();
  const end = Date.now();
  const durationMs = end - start;

  const logPayload: { path: string; durationMs: number; artificialDelayMs?: number } = {
    path,
    durationMs,
  };
  if (waitMs > 0) {
    logPayload.artificialDelayMs = waitMs;
  }

  ctx.logger.info(logPayload, `[TRPC] /${path} executed.`);

  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session },
    },
  });
});