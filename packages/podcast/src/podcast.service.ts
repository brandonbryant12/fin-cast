import { InternalServerError, NotFoundError, ValidationError } from '@repo/errors';
import { createPromptRegistry, type PromptRegistry } from '@repo/prompt-registry';
import * as v from 'valibot';
import type { AudioService } from '@repo/audio';
import type { DatabaseInstance } from '@repo/db/client';
import type { LLMInterface } from '@repo/llm';
import type { AppLogger } from '@repo/logger';
import type { TTSService, TTSProvider } from '@repo/tts';
import type { Scraper } from '@repo/webscraper';
import { PersonalityId, enrichPersonalities, type PersonalityInfo } from './personalities/personalities';
import { PodcastRepository, type PodcastSummary, type PodcastWithTranscript, type PodcastSummaryWithTags } from './podcast.repository';
import CreatePodcastUseCase from './use-cases/create-podcast-use-case';
import UpdatePodcastUseCase from './use-cases/update-podcast-use-case';
const DialogueSegmentSchema = v.object({
    speaker: v.string(),
    line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});
const ContentSchema = v.pipe(v.array(DialogueSegmentSchema), v.minLength(1, 'Podcast content must contain at least one segment.'));

interface PodcastServiceDependencies {
    logger: AppLogger;
    podcastRepository: PodcastRepository;
    tts: TTSService;
    isRunningInDocker: boolean;
    db: DatabaseInstance;
    audioService: AudioService;
    llm: LLMInterface;
    scraper: Scraper;
    promptRegistry: PromptRegistry;
}

interface PodcastFactoryDependencies {
    db: DatabaseInstance;
    llm: LLMInterface;
    scraper: Scraper;
    logger: AppLogger;
    tts: TTSService;
    audioService: AudioService, 
    isRunningInDocker: boolean;
}

export class PodcastService {
    private readonly logger: AppLogger;
    private readonly podcastRepository: PodcastRepository;
    private readonly tts: TTSService;
    private readonly llm: LLMInterface;
    private readonly audioService: AudioService;
    private enrichedPersonalitiesCache = new Map<TTSProvider, Promise<PersonalityInfo[]>>();
    private readonly isRunningInDocker: boolean;
    private readonly db: DatabaseInstance;
    private readonly scraper: Scraper;
    private readonly promptRegistry: PromptRegistry;

    constructor(dependencies: PodcastServiceDependencies) {
        this.logger = dependencies.logger;
        this.podcastRepository = dependencies.podcastRepository;
        this.tts = dependencies.tts;
        this.isRunningInDocker = dependencies.isRunningInDocker;
        this.db = dependencies.db;
        this.audioService = dependencies.audioService;
        this.llm = dependencies.llm;
        this.scraper = dependencies.scraper;
        this.promptRegistry = dependencies.promptRegistry;
    }

    async createPodcast(
        userId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId = PersonalityId.Arthur,
        cohostPersonalityId: PersonalityId = PersonalityId.Chloe
    ): Promise<PodcastSummary> { 
        return new CreatePodcastUseCase({
            logger: this.logger,
            podcastRepository: this.podcastRepository,
            llm: this.llm,
            tts: this.tts,
            scraper: this.scraper,
            promptRegistry: this.promptRegistry,
            audioService: this.audioService,
            db: this.db,
        }).execute({
            userId,
            sourceUrl,
            hostPersonalityId,
            cohostPersonalityId
        });
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
      return this.podcastRepository.adminDeletePodcast(podcastId);
    }

    /**
     * Initiates an update for a podcast. If audio regeneration is needed,
     * it updates the status to 'processing' and triggers a background task.
     * Returns immediately after initiating the update.
     */
    // Create an UpdatePodcastUseCase
    async updatePodcast(userId: string, input: {
        podcastId: string,
        title?: string | undefined,
        summary?: string | undefined, // Added summary
        content?: any,
        hostPersonalityId?: PersonalityId | undefined
        cohostPersonalityId?: PersonalityId | undefined
      }): Promise<{ success: boolean }> {
        await new UpdatePodcastUseCase({
            logger: this.logger,
            tts: this.tts,
            podcastRepository: this.podcastRepository,
            audioService: this.audioService,
            db: this.db
        }).execute({
            userId,
            ...input
        });
        this.logger.info('Podcast update request processed successfully.');
        return { success: true };
    }

    async getAvailablePersonalities(): Promise<PersonalityInfo[]> {
        const providerName = this.tts.getProvider();
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
    const promptRegistry = createPromptRegistry({ db: dependencies.db });


    const podcastService = new PodcastService({
        logger: mainLogger,
        podcastRepository,
        tts: dependencies.tts,
        isRunningInDocker: dependencies.isRunningInDocker,
        db: dependencies.db,
        audioService: dependencies.audioService,
        llm: dependencies.llm,
        scraper: dependencies.scraper,
        promptRegistry,
    });

    return podcastService;
}