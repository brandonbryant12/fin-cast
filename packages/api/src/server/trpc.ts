import { eq } from '@repo/db';
import * as schema from '@repo/db/schema';
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
  isAdmin: boolean;
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

  let isAdmin = false;
  if (session?.user) {
    try {
      const userResult = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
        columns: { isAdmin: true },
      });
      isAdmin = userResult?.isAdmin ?? false;
    } catch (error) {
      logger.error({ err: error, userId: session.user.id }, "Failed to fetch user admin status during context creation");
      isAdmin = false;
    }
  }

  return {
    db,
    session,
    logger,
    isAdmin,
  };
};

export const t = initTRPC.context<TRPCContext>().create({
  transformer: SuperJSON,
});

export const router = t.router;

const timingMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();
  const durationMs = end - start;

  const logPayload: { path: string; durationMs: number; } = {
    path,
    durationMs,
  };

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

const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires admin privileges' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session!,
    },
  });
});

export const adminProcedure = protectedProcedure.use(enforceUserIsAdmin);