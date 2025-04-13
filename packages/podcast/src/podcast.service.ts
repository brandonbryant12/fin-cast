import type { LLMInterface, TTSService, TTSProvider } from '@repo/ai';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { Scraper } from '@repo/webscraper';
import { createAudioService } from './audio.service'; 
import { DialogueSynthesisService } from './dialogue-synthesis.service';
import { PersonalityId, enrichPersonalities, type PersonalityInfo } from './personalities/personalities';
import { PodcastGenerationService } from './podcast-generation.service';
import { PodcastRepository, type PodcastSummary, type PodcastWithTranscript } from './podcast.repository';


interface PodcastFactoryDependencies {
    db: DatabaseInstance;
    llm: LLMInterface;
    scraper: Scraper;
    logger: AppLogger;
    tts: TTSService;
    isRunningInDocker: boolean;
}

export class PodcastService {
    private readonly logger: AppLogger;
    private readonly podcastRepository: PodcastRepository;
    private readonly podcastGenerationService: PodcastGenerationService;
    private readonly ttsService: TTSService;
    private enrichedPersonalitiesCache = new Map<TTSProvider, Promise<PersonalityInfo[]>>();

    constructor(
        logger: AppLogger,
        podcastRepository: PodcastRepository,
        podcastGenerationService: PodcastGenerationService,
        ttsService: TTSService
    ) {
        this.logger = logger.child({ service: 'PodcastService (Facade)' });
        this.podcastRepository = podcastRepository;
        this.podcastGenerationService = podcastGenerationService;
        this.ttsService = ttsService;
        this.logger.info('PodcastService (Facade) initialized');
    }

    async createPodcast(
        userId: string,
        sourceUrl: string,
        hostPersonalityId: PersonalityId = PersonalityId.Arthur,
        cohostPersonalityId: PersonalityId = PersonalityId.Chloe
    ): Promise<PodcastSummary> { 
        if (hostPersonalityId === cohostPersonalityId) {
            throw new Error("Host and cohost personalities must be different.");
        }
        if (!Object.values(PersonalityId).includes(hostPersonalityId) || !Object.values(PersonalityId).includes(cohostPersonalityId)) {
            throw new Error("Invalid PersonalityId provided.");
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
            await this.podcastRepository.updatePodcastStatus(podcastId, 'failed', err);
        });

        return initialPodcastSummary;
    }

    async getMyPodcasts(userId: string): Promise<PodcastSummary[]> {
        return this.podcastRepository.findPodcastsByUser(userId);
    }

    async getPodcastById(userId: string, podcastId: string): Promise<PodcastWithTranscript | null> {
        return this.podcastRepository.findPodcastById(userId, podcastId);
    }

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId?: string; error?: string }> {
        return this.podcastRepository.deletePodcast(userId, podcastId);
    }

    async getAvailablePersonalities(): Promise<PersonalityInfo[]> {
        const providerName = this.ttsService.getProvider();
        if (this.enrichedPersonalitiesCache.has(providerName)) {
            this.logger.debug({ providerName }, 'Returning cached personalities');
            return this.enrichedPersonalitiesCache.get(providerName)!;
        }
        this.logger.info({ providerName }, 'Enriching and caching personalities');
        const enrichmentPromise = enrichPersonalities(providerName)
            .catch(error => {
                this.logger.error({ error, providerName }, 'Failed to enrich personalities');
                this.enrichedPersonalitiesCache.delete(providerName); 
                return [];
            });
        
        this.enrichedPersonalitiesCache.set(providerName, enrichmentPromise);
        return enrichmentPromise;
    }
}

export function createPodcastService(dependencies: PodcastFactoryDependencies): PodcastService {
    const mainLogger = dependencies.logger;
    const podcastRepository = new PodcastRepository(dependencies.db);
    const audioService = createAudioService({ logger: mainLogger, isRunningInDocker: dependencies.isRunningInDocker });
    const dialogueSynthesisService = new DialogueSynthesisService({ tts: dependencies.tts, logger: mainLogger });

    const podcastGenerationService = new PodcastGenerationService({
        podcastRepository,
        scraper: dependencies.scraper,
        llm: dependencies.llm,
        tts: dependencies.tts,
        audioService,
        dialogueSynthesisService,
        logger: mainLogger,
    });

    const podcastService = new PodcastService(
        mainLogger,
        podcastRepository,
        podcastGenerationService,
        dependencies.tts
    );

    return podcastService;
}