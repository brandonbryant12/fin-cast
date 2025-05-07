import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import type { createPromptRegistry as createPromptRegistryFn } from '@repo/prompt-registry';
import { adminProcedure, router } from '../trpc';

const PromptIdentifier = v.object({
  promptKey: v.pipe(v.string(), v.minLength(1, 'Prompt key cannot be empty.')),
  version: v.pipe(v.number())
});

const PromptKeyInput = v.object({
  promptKey: v.pipe(v.string(), v.minLength(1, 'Prompt key cannot be empty.')),
});

export const createPromptRegistryRouter = ({ promptRegistry }: { promptRegistry: ReturnType<typeof createPromptRegistryFn> }) =>
  router({
  listAll: adminProcedure
    .query(async ({ ctx }) => {
      try {
        ctx.logger.info('Listing all prompt definitions');
        return await promptRegistry.listAll();
      } catch (error) {
        ctx.logger.error({ err: error }, 'Failed to list all prompt definitions');
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve prompt list.' });
      }
    }),
  getDetails: adminProcedure
    .input(PromptIdentifier)
    .query(async ({ ctx, input }) => {
      try {
        ctx.logger.info({ promptKey: input.promptKey, version: input.version }, 'Getting prompt details');
        const details = await promptRegistry.getDetails(input.promptKey, input.version);
        if (!details) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Prompt version not found.' });
        }
        return details;
      } catch (error) {
        ctx.logger.error({ err: error, ...input }, 'Failed to get prompt details');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve prompt details.' });
      }
    }),
  getByPromptByKey: adminProcedure
    .input(PromptKeyInput)
    .query(async ({ ctx, input }) => {
      try {
        ctx.logger.info({ promptKey: input.promptKey }, 'Getting available versions for prompt');
        return promptRegistry.listAllByPromptKey(input.promptKey);
      } catch (error) {
        ctx.logger.error({ err: error, ...input }, 'Failed to get available versions');
        if (error instanceof TRPCError) throw error; // e.g. if registry method throws known error
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve available versions.'});
      }
    }),
  setActive: adminProcedure
    .input(PromptIdentifier)
    .mutation(async ({ ctx, input }) => {
      ctx.logger.info({ ...input }, 'Setting active prompt version');
      try {
        await promptRegistry.setActive(input.promptKey, input.version);
        ctx.logger.info({ ...input }, 'Active prompt version set successfully');
        return { success: true };
      } catch (error) {
        ctx.logger.error({ err: error, ...input }, 'Failed to set active prompt version');
        if (error instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An unknown error occurred while setting the active prompt.' });
      }
    }),
});

export type PromptRegistryRouter = ReturnType<typeof createPromptRegistryRouter>;