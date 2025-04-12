import { PersonalityId } from '@repo/ai';
// import { desc, eq, and } from '@repo/db'; // No longer needed directly
// import * as schema from '@repo/db/schema'; // No longer needed directly
// import pLimit from 'p-limit'; // No longer needed
import * as schema from '@repo/db/schema';
import * as v from 'valibot';
// import type { LLMInterface, ChatResponse, TTSService } from '@repo/ai'; // No longer needed directly
import type { LLMInterface, TTSService } from '@repo/ai'; // Needed for factory
import type { DatabaseInstance } from '@repo/db/client'; // Still needed for factory dependencies
import type { AppLogger } from '@repo/logger';
// import type { Scraper } from '@repo/webscraper'; // No longer needed directly
import type { Scraper } from '@repo/webscraper'; // Needed for factory
import { AudioService, createAudioService } from './audio.service'; // Keep for factory
// import { generatePodcastScriptPrompt, type GeneratePodcastScriptOutput } from './generate-podcast-script-prompt'; // No longer needed

// Import new services and repository
import { DialogueSynthesisService } from './dialogue-synthesis.service';
import { PodcastGenerationService } from './podcast-generation.service';
import { PodcastRepository, type PodcastSummary, type PodcastWithTranscript } from './podcast.repository';

// Define the FullPodcast type for the getPodcastById return including audioUrl
// Reuse the schema import temporarily for this, or define explicitly
type FullPodcastWithTranscript = typeof schema.podcast.$inferSelect & {
    transcript: typeof schema.transcript.$inferSelect | null;
};

// Update dependencies for the factory function
interface PodcastFactoryDependencies {
    db: DatabaseInstance;
    llm: LLMInterface;
    scraper: Scraper;
    logger: AppLogger;
    tts: TTSService;
}

export class PodcastService {
    // Remove direct dependencies no longer needed
    // private readonly db: DatabaseInstance;
    // private readonly llm: LLMInterface;
    // private readonly scraper: Scraper;
    // private readonly tts: TTSService;
    // private readonly audioService: AudioService; // Not directly used by facade methods
    private readonly logger: AppLogger;
    private readonly podcastRepository: PodcastRepository;
    private readonly podcastGenerationService: PodcastGenerationService;

    // Inject new dependencies
    constructor(
        logger: AppLogger,
        podcastRepository: PodcastRepository,
        podcastGenerationService: PodcastGenerationService
        // audioService is no longer needed here
    ) {
        this.logger = logger.child({ service: 'PodcastService (Facade)' });
        this.podcastRepository = podcastRepository;
        this.podcastGenerationService = podcastGenerationService;
        this.logger.info('PodcastService (Facade) initialized');
    }

    // Remove _synthesizeDialogue method (moved to DialogueSynthesisService)

    // Remove _processPodcastInBackground method (moved to PodcastGenerationService)

    async createPodcast(
        userId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId = PersonalityId.Arthur,
        cohostPersonalityId: PersonalityId = PersonalityId.Chloe
    ): Promise<PodcastSummary> { // Return Summary type (no audioUrl initially)
        // Input validation remains here
        if (hostPersonalityId === cohostPersonalityId) {
            throw new Error("Host and cohost personalities must be different.");
        }
        if (!Object.values(PersonalityId).includes(hostPersonalityId) || !Object.values(PersonalityId).includes(cohostPersonalityId)) {
            throw new Error("Invalid PersonalityId provided.");
        }

        const logger = this.logger.child({ userId, sourceUrl, method: 'createPodcast', hostPersonalityId, cohostPersonalityId });

        try {
            logger.info('Calling repository to create initial podcast entries.');
            // 1. Create initial record using the repository
            const initialPodcastSummary = await this.podcastRepository.createInitialPodcast(
                userId,
                sourceUrl,
                hostPersonalityId,
                cohostPersonalityId
            );

            // Should not happen if repo throws on failure, but good practice
            if (!initialPodcastSummary?.id) {
                throw new Error('Podcast creation failed unexpectedly after repository call.');
            }

            const podcastId = initialPodcastSummary.id;
            logger.info({ podcastId }, 'Initial DB entries created. Triggering background generation.');

            // 2. Asynchronously trigger the generation service (fire-and-forget)
            this.podcastGenerationService.generatePodcast(
                podcastId,
                sourceUrl,
                hostPersonalityId,
                cohostPersonalityId
            ).catch(err => {
                // Generation service handles its own errors and status updates.
                // Log here that the async task initiation failed or the promise was rejected.
                logger.error({ err, podcastId }, "Background podcast generation task promise rejected or initiation failed.");
                // No need to update status here; generation service does that.
            });

            // 3. Return the initial summary data immediately
            return initialPodcastSummary;

        } catch (error) {
            logger.error({ err: error }, 'Error during podcast creation orchestration.');
            // If repo call failed, it throws. Re-throw the error.
            // No need to manually update status to failed here, as nothing was generated yet.
            // If the repo succeeded but something else failed here, the initial record
            // will stay in 'processing' state until the background job fails or succeeds.
            throw error;
        }
    }

    async getMyPodcasts(userId: string): Promise<PodcastSummary[]> { // Return Summary type
        const logger = this.logger.child({ userId, method: 'getMyPodcasts' });
        logger.info('Calling repository to fetch podcasts for user');
        try {
            const results = await this.podcastRepository.findPodcastsByUser(userId);
            logger.info({ count: results.length }, 'Successfully fetched podcasts via repository');
            return results;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user podcasts via repository');
            // Throw a generic error or the specific repo error if desired
            throw new Error('Could not retrieve your podcasts.');
        }
    }

    // Return type needs to include audioUrl, fetch it separately
    async getPodcastById(userId: string, podcastId: string): Promise<FullPodcastWithTranscript | null> {
        const logger = this.logger.child({ userId, podcastId, method: 'getPodcastById' });
        logger.info('Calling repository to fetch podcast by ID with transcript');
        try {
            // Fetch main data + transcript (without audioUrl)
            const podcastData = await this.podcastRepository.findPodcastById(userId, podcastId);

            if (!podcastData) {
                 logger.warn('Podcast not found or unauthorized via repository');
                 return null; // Repository handles the check
            }

            logger.info('Successfully fetched podcast base data by ID. Fetching audio URL...');

            // Fetch audioUrl separately
            const audioUrl = await this.podcastRepository.getPodcastAudioUrl(userId, podcastId);

            if (audioUrl === undefined) {
                 // This case implies the podcast existed for findPodcastById but not for getPodcastAudioUrl,
                 // which suggests an inconsistency or error. Log a warning.
                 logger.warn('Could not fetch audio URL for a podcast that was just found. Returning data without audio URL.');
            }

            logger.info('Successfully fetched audio URL. Combining data.');

            // Combine the data
            const fullPodcastData: FullPodcastWithTranscript = {
                ...podcastData,
                audioUrl: audioUrl ?? null, // Use fetched audioUrl, default to null if missing
            };

            return fullPodcastData;

        } catch(error) {
            logger.error({ err: error }, 'Failed to fetch podcast by ID via repository');
            // Let repository errors propagate or throw a generic one
            throw new Error('Could not retrieve the podcast.');
        }
    }

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId?: string; error?: string }> {
        const logger = this.logger.child({ userId, podcastId, method: 'deletePodcast' });
        logger.info('Calling repository to delete podcast');
        try {
            // result: { success: true; deletedId: string } | { success: false; error: string }
            const result = await this.podcastRepository.deletePodcast(userId, podcastId);

            // Use type assertion as workaround for narrowing issue
            if (result.success === true) {
                // Assert type to { success: true; deletedId: string }
                const successResult = result as { success: true; deletedId: string };
                logger.info('Podcast deleted successfully via repository');
                return { success: true, deletedId: successResult.deletedId };
            } else {
                // Assert type to { success: false; error: string }
                 const failureResult = result as { success: false; error: string };
                logger.warn({ error: failureResult.error }, 'Podcast deletion failed via repository');
                return { success: false, error: failureResult.error };
            }
        } catch (error) {
             logger.error({ err: error }, `Repository error during podcast deletion '${podcastId}'`);
             // Handle unexpected repository errors (e.g., DB connection issue)
             return { success: false, error: 'An unexpected error occurred during deletion.' };
        }
    }
}

// --- Updated Factory Function ---
export function createPodcastService(dependencies: PodcastFactoryDependencies): PodcastService {
    const mainLogger = dependencies.logger;

    // Create dependent services/repositories first
    const podcastRepository = new PodcastRepository(dependencies.db, mainLogger);
    const audioService = createAudioService({ logger: mainLogger }); // AudioService is needed by GenerationService
    const dialogueSynthesisService = new DialogueSynthesisService({ tts: dependencies.tts, logger: mainLogger });

    const podcastGenerationService = new PodcastGenerationService({
        podcastRepository,
        scraper: dependencies.scraper,
        llm: dependencies.llm,
        tts: dependencies.tts, // Pass TTS even if not used directly, maybe needed by DialogueSynthesis?
        audioService,
        dialogueSynthesisService,
        logger: mainLogger,
    });

    // Create the main facade service
    const podcastService = new PodcastService(
        mainLogger,
        podcastRepository,
        podcastGenerationService
    );

    return podcastService;
}