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

const NewVersionInput = v.object({
  promptKey: v.pipe(v.string(), v.minLength(1, 'Prompt key cannot be empty.')),
  template: v.pipe(v.string(), v.minLength(1, 'Template cannot be empty.')),
  systemPrompt: v.pipe(v.string(), v.minLength(1, 'System prompt cannot be empty.')),
  temperature: v.pipe(
    v.number('Temperature must be a number.'),
    v.minValue(0.0, 'Temperature must be at least 0.0.'),
    v.maxValue(2.0, 'Temperature must be at most 2.0.')
  ),
  maxTokens: v.pipe(
    v.number('Max tokens must be a number.'),
    v.integer('Max tokens must be an integer.'),
    v.minValue(1, 'Max tokens must be at least 1.'),
    v.maxValue(10000, 'Max tokens must be at most 10,000.')
  )
});

export const createPromptRegistryRouter = ({ promptRegistry }: { promptRegistry: ReturnType<typeof createPromptRegistryFn> }) =>
  router({
  listAll: adminProcedure.query(() =>  promptRegistry.listAll()),
  getDetails: adminProcedure
    .input(PromptIdentifier)
    .query(({ input }) => promptRegistry.getDetails(input.promptKey, input.version)),
  getByPromptByKey: adminProcedure
    .input(PromptKeyInput)
    .query(({ input }) =>  promptRegistry.listAllByPromptKey(input.promptKey)),
  setActive: adminProcedure
    .input(PromptIdentifier)
    .mutation(({ input }) => promptRegistry.setActive(input.promptKey, input.version)),
  createNewVersion: adminProcedure
  .input(NewVersionInput)
  .mutation(async ({ ctx, input }) => {
    const { promptKey, template, systemPrompt, temperature, maxTokens } = input;
      return promptRegistry.createNewVersion(promptKey, {
        template,
        systemPrompt,
        temperature,
        maxTokens,
        activate: true
      }, ctx.session?.user?.id);
  }),
});

export type PromptRegistryRouter = ReturnType<typeof createPromptRegistryRouter>;