import { protectedProcedure, router } from '../trpc';

// Define the router for TTS related operations
export const ttsRouter = router({
  /**
   * Retrieves the list of available TTS voices from the configured provider.
   * Requires authentication.
   */
  getAvailablePersonalities: protectedProcedure
    .query(async ({ ctx }) => {
      const logger = ctx.logger.child({ procedure: 'getVoices', userId: ctx.session.user.id });
      logger.info('Fetching TTS voices via service');
      try {
        const voices = await ctx.tts.getAvailablePersonalities();
        logger.info({ voiceCount: voices.length }, 'Successfully fetched TTS personalities');
        return voices;
      } catch (error) {
        logger.error({ err: error }, 'Error fetching TTS voices from service');
        throw new Error('Failed to retrieve TTS voices.');
      }
    }),
});

export default ttsRouter;
