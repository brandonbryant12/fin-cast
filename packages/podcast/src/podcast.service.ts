import { createPromptRegistry } from '@repo/prompt-registry';
import { TRPCError } from '@trpc/server';
import * as v from 'valibot';
import type { AudioService } from '@repo/audio';
import type { DatabaseInstance } from '@repo/db/client';
import type { LLMInterface } from '@repo/llm';
import type { AppLogger } from '@repo/logger';
import type { TTSService, TTSProvider } from '@repo/tts';
import type { Scraper } from '@repo/webscraper';
import { DialogueSynthesisService } from './dialogue-synthesis.service';
import { PersonalityId, enrichPersonalities, type PersonalityInfo } from './personalities/personalities';
import { PodcastGenerationService } from './podcast-generation.service';
import { PodcastRepository, type PodcastSummary, type PodcastWithTranscript, type PodcastSummaryWithTags } from './podcast.repository';

const DialogueSegmentSchema = v.object({
    speaker: v.string(),
    line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});
const ContentSchema = v.pipe(v.array(DialogueSegmentSchema), v.minLength(1, 'Podcast content must contain at least one segment.'));

interface PodcastFactoryDependencies {
    db: DatabaseInstance;
    llm: LLMInterface;
    scraper: Scraper;
    logger: AppLogger;
    tts: TTSService;
    audioService: AudioService, 
    isRunningInDocker: boolean;
    podcastGenerationService: PodcastGenerationService;
}

export class PodcastService {
    private readonly logger: AppLogger;
    private readonly podcastRepository: PodcastRepository;
    private readonly podcastGenerationService: PodcastGenerationService;
    private readonly ttsService: TTSService;
    private enrichedPersonalitiesCache = new Map<TTSProvider, Promise<PersonalityInfo[]>>();
    private readonly isRunningInDocker: boolean;

    constructor(
        logger: AppLogger,
        podcastRepository: PodcastRepository,
        podcastGenerationService: PodcastGenerationService,
        ttsService: TTSService,
        isRunningInDocker: boolean,
    ) {
        this.logger = logger.child({ service: 'PodcastService (Facade)' });
        this.podcastRepository = podcastRepository;
        this.podcastGenerationService = podcastGenerationService;
        this.ttsService = ttsService;
        this.isRunningInDocker = isRunningInDocker;
        this.logger.info('PodcastService (Facade) initialized');
    }

    async createPodcast(
        userId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId = PersonalityId.Arthur,
        cohostPersonalityId: PersonalityId = PersonalityId.Chloe
    ): Promise<PodcastSummary> { 
        if (hostPersonalityId === cohostPersonalityId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: "Host and cohost personalities must be different." });
        }

        const logger = this.logger.child({ userId, sourceUrl, method: 'createPodcast', hostPersonalityId, cohostPersonalityId });

        logger.info('Calling repository to create initial podcast entries.');
        const initialPodcastSummary = await this.podcastRepository.createInitialPodcast(
            userId,
            sourceUrl,
            hostPersonalityId,
            cohostPersonalityId
        );

        if (!initialPodcastSummary?.id) {
            throw new Error('Podcast creation failed unexpectedly after repository call.');
        }

        const podcastId = initialPodcastSummary.id;
        logger.info({ podcastId }, 'Initial DB entries created. Triggering background generation.');
        this.podcastGenerationService.generatePodcast(
            podcastId,
            sourceUrl,
            hostPersonalityId,
            cohostPersonalityId
        ).catch(async (err)=> {
            logger.error({ err, podcastId }, "Background podcast generation task promise rejected or initiation failed.");
            try {
               await this.podcastRepository.updatePodcastStatus(podcastId, 'failed', 'Failed to start generation task.');
            } catch (updateErr) {
              logger.error({ updateErr, podcastId }, "Failed to update podcast status after generation initiation error.");
            }
        });

        return initialPodcastSummary;
    }

    async getMyPodcasts(userId: string): Promise<PodcastSummaryWithTags[]> {
        return this.podcastRepository.findPodcastsByUser(userId);
    }

    async getPodcastById(podcastId: string): Promise<PodcastWithTranscript | null> {
        return this.podcastRepository.findPodcastById(podcastId);
    }

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId?: string; error?: string }> {
        return this.podcastRepository.deletePodcast(userId, podcastId);
    }

    async adminDeletePodcast(podcastId: string): Promise<{ success: boolean; deletedId?: string; error?: string }> {
      const logger = this.logger.child({ podcastId, method: 'adminDeletePodcast' });
      logger.info('Admin request to delete podcast received.');
      // Directly call repo method that doesn't check user ID
      return this.podcastRepository.adminDeletePodcast(podcastId);
    }

    /**
     * Initiates an update for a podcast. If audio regeneration is needed,
     * it updates the status to 'processing' and triggers a background task.
     * Returns immediately after initiating the update.
     */
    async updatePodcast(userId: string, input: {
        podcastId: string,
        title?: string | undefined,
        summary?: string | undefined, // Added summary
        content?: any,
        hostPersonalityId?: PersonalityId | undefined
        cohostPersonalityId?: PersonalityId | undefined
      }): Promise<{ success: boolean }> {
        const { podcastId, title, summary, content, hostPersonalityId, cohostPersonalityId } = input;
        const logger = this.logger.child({ userId, podcastId, method: 'updatePodcast' });

        logger.info('Fetching podcast for update and authorization check.');
        const currentPodcast = await this.podcastRepository.findPodcastById(podcastId);

        if (!currentPodcast) {
            logger.warn('Podcast not found or user not authorized.');
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Podcast not found.' });
        }

        // --- Validation ---
        if (content !== undefined) {
            const contentResult = v.safeParse(ContentSchema, content);
            if (!contentResult.success) {
                logger.warn({ issues: contentResult.issues }, 'Invalid content structure provided.');
                throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid content format: ${contentResult.issues.map(i => i.message).join(', ')}` });
            }
        }

        const finalHostId = hostPersonalityId ?? currentPodcast.hostPersonalityId as PersonalityId;
        const finalCohostId = cohostPersonalityId ?? currentPodcast.cohostPersonalityId as PersonalityId;

        if (finalHostId === finalCohostId) {
            logger.warn('Host and co-host personalities cannot be the same.');
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Host and co-host personalities must be different.' });
        }
        // Ensure selected personalities are valid (though enum check in API helps)
        if (!Object.values(PersonalityId).includes(finalHostId) || !Object.values(PersonalityId).includes(finalCohostId)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: "Invalid PersonalityId provided." });
        }
        // --- End Validation ---


        // --- Determine Regeneration & Prepare Initial Update ---
        let needsRegeneration = false;
        if (content !== undefined) needsRegeneration = true;
        if (hostPersonalityId !== undefined && hostPersonalityId !== currentPodcast.hostPersonalityId) needsRegeneration = true;
        if (cohostPersonalityId !== undefined && cohostPersonalityId !== currentPodcast.cohostPersonalityId) needsRegeneration = true;

        const initialUpdatePayload: any = {
            updatedAt: new Date(),
            errorMessage: null, // Clear previous errors on new update attempt
        };
  
        if (title !== undefined) initialUpdatePayload.title = title;
        if (summary !== undefined) initialUpdatePayload.summary = summary; // Added summary
        if (hostPersonalityId !== undefined) initialUpdatePayload.hostPersonalityId = hostPersonalityId;
        if (cohostPersonalityId !== undefined) initialUpdatePayload.cohostPersonalityId = cohostPersonalityId;
  
        if (needsRegeneration) {
            logger.info('Regeneration required. Setting status to processing and clearing audio fields.');
            initialUpdatePayload.status = 'processing';
            initialUpdatePayload.audioUrl = null;
            initialUpdatePayload.durationSeconds = null;
            initialUpdatePayload.generatedAt = null;
        } else {
            logger.info('No regeneration required. Updating metadata only.');
            initialUpdatePayload.status = 'success';
        }

        // --- Perform Initial DB Updates ---
        try {
            logger.info('Performing initial database update.');
            await this.podcastRepository.updatePodcast(podcastId, initialUpdatePayload);

            if (content !== undefined) {
                logger.info('Updating transcript content.');
                await this.podcastRepository.updateTranscriptContent(podcastId, content);
            }

        } catch (dbError) {
            logger.error({ err: dbError }, 'Failed initial database update.');
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save initial updates.', cause: dbError });
        }


        // --- Trigger Background Regeneration (if needed) ---
        if (needsRegeneration) {
            logger.info('Triggering background audio regeneration task.');
            const dialogueToRegenerate = content ?? currentPodcast.transcript?.content ?? [];
            this.podcastGenerationService.regeneratePodcastAudio(
                podcastId,
                dialogueToRegenerate,
                finalHostId,
                finalCohostId,
                title,
              ).catch((err) => {
                logger.error({ err, podcastId }, "Background podcast regeneration task failed after initiation.");
            });
        }

        logger.info('Podcast update request processed successfully.');
        return { success: true };
    }

    async getAvailablePersonalities(): Promise<PersonalityInfo[]> {
        const providerName = this.ttsService.getProvider();
        if (this.enrichedPersonalitiesCache.has(providerName)) {
            this.logger.debug({ providerName }, 'Returning cached personalities');
            return this.enrichedPersonalitiesCache.get(providerName)!;
        }
        this.logger.info({ providerName }, 'Enriching and caching personalities');
        const enrichmentPromise = enrichPersonalities(providerName, this.isRunningInDocker)
            .catch(error => {
                this.logger.error({ error, providerName }, 'Failed to enrich personalities');
                this.enrichedPersonalitiesCache.delete(providerName);
                return [];
            });
        
        this.enrichedPersonalitiesCache.set(providerName, enrichmentPromise);
        return enrichmentPromise;
    }
}

export function createPodcastService(dependencies: Omit<PodcastFactoryDependencies, 'podcastGenerationService' | 'dialogueSynthesisService'>): PodcastService {
    const mainLogger = dependencies.logger;
    const podcastRepository = new PodcastRepository(dependencies.db);
    const dialogueSynthesisService = new DialogueSynthesisService({ tts: dependencies.tts, logger: mainLogger });

    const promptRegistry = createPromptRegistry({ db: dependencies.db });
    const podcastGenerationService = new PodcastGenerationService({
        podcastRepository,
        scraper: dependencies.scraper,
        llm: dependencies.llm,
        tts: dependencies.tts,
        audioService: dependencies.audioService,
        dialogueSynthesisService,
        logger: mainLogger,
        promptRegistry,
    });

    const podcastService = new PodcastService(
        mainLogger,
        podcastRepository,
        podcastGenerationService,
        dependencies.tts,
        dependencies.isRunningInDocker,
    );

    return podcastService;
}