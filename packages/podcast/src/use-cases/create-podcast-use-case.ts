import * as schema from '@repo/db/schema';
import { ValidationError } from '@repo/errors';
import pLimit from 'p-limit';
import type { PodcastRepository } from '../podcast.repository';
import type { PodcastScriptOutput } from '../types/podcast-script';
import type { DialogueSegment } from '../validations/validations';
import type { AudioService } from '@repo/audio';
import type { DatabaseInstance } from '@repo/db/client';
import type { LLMInterface } from '@repo/llm';
import type { AppLogger } from '@repo/logger';
import type { PromptRegistry } from '@repo/prompt-registry';
import type { TTSService } from '@repo/tts';
import type { Scraper } from '@repo/webscraper';
import { PersonalityId, getPersonalityInfo, type PersonalityInfo} from '../personalities/personalities';
import CreateAudioFromPodcastScriptUseCase from './create-audio-from-podcast-script-use-case';
import CreatePodcastScriptUseCase from './create-podcast-script-use-case';

const AUDIO_FORMAT = 'mp3';
const P_LIMIT = 5;

type CreatePodcastInput = {
    userId: string,
    sourceUrl: string,
    hostPersonalityId: PersonalityId
    cohostPersonalityId: PersonalityId
}

export default class CreatePodcastUseCase {
    private readonly logger: AppLogger;
    private readonly podcastRepository: PodcastRepository;
    private readonly llm: LLMInterface;
    private readonly tts: TTSService;
    private readonly scraper: Scraper;
    private readonly promptRegistry: PromptRegistry;
    private readonly audioService: AudioService;
    private readonly db: DatabaseInstance;

    constructor({ logger, podcastRepository, llm, tts, scraper, promptRegistry, audioService, db } : {
        logger: AppLogger
        podcastRepository: PodcastRepository
        llm: LLMInterface,
        tts: TTSService
        scraper: Scraper
        promptRegistry: PromptRegistry
        audioService: AudioService
        db: DatabaseInstance
    }) {
        this.logger = logger;
        this.podcastRepository = podcastRepository;
        this.llm = llm;
        this.tts = tts;
        this.scraper = scraper;
        this.promptRegistry = promptRegistry;
        this.audioService = audioService;
        this.db = db;
    }

    async execute({ userId, sourceUrl, hostPersonalityId, cohostPersonalityId}: CreatePodcastInput) {
        if (hostPersonalityId === cohostPersonalityId) {
            throw new ValidationError("Host and cohost personalities must be different.");
        }
        const hostInfo = getPersonalityInfo(hostPersonalityId, this.tts.getProvider());
        const cohostInfo = getPersonalityInfo(cohostPersonalityId, this.tts.getProvider());
        const html = await this.scraper.scrape(sourceUrl);
        const podcast = await this.podcastRepository.createInitialPodcast(
            userId,
            sourceUrl,
            hostPersonalityId,
            cohostPersonalityId
        );

        if (!podcast?.id) {
            throw new Error('Podcast creation failed unexpectedly after repository call.');
        }

        this.processPodcastInBackground(podcast.id, html, hostInfo, cohostInfo).catch(async (err) => {
            this.logger.error({ err, errorMessage: err.message }, 'Background podcast generation process failed.');
            await this.podcastRepository.updatePodcastStatus(podcast.id, 'failed', err.message);
            await this.db.insert(schema.errorLog).values({
                message: err.message,
                stack: err.stack,
                statusCode: 500,
                path: 'createPodcast',
                userId,
              });
        });

       
        return podcast;
    }

    async processPodcastInBackground(podcastId: string, content: string, hostInfo: PersonalityInfo, cohostInfo: PersonalityInfo) {
        const podcastScript = await new CreatePodcastScriptUseCase({
            llm: this.llm,
            logger: this.logger,
            promptRegistry: this.promptRegistry,
        }).execute({ content, hostInfo, cohostInfo });
        await this.podcastRepository.updateTranscriptContent(podcastId, podcastScript.dialogue);

        const { audioUrl , durationSeconds } = await new CreateAudioFromPodcastScriptUseCase({
            audioService: this.audioService,
            logger: this.logger,
            tts: this.tts,
        }).execute(podcastId, podcastScript, hostInfo, cohostInfo);
        await this.podcastRepository.updatePodcast(podcastId, {
            summary: podcastScript.summary,
            title: podcastScript.title,
            audioUrl,
            durationSeconds,
            status: 'success',
            errorMessage: null,
            generatedAt: new Date(),
        });
    }

    async generateAudioBuffers(podcastScript: PodcastScriptOutput, hostInfo: PersonalityInfo, cohostInfo: PersonalityInfo): Promise<(Buffer | null)[]> {
        const speakerVoiceMap: Record<string, string | undefined> = { // Ensure voiceName can be undefined
            [hostInfo.name]: hostInfo.voiceName,
            [cohostInfo.name]: cohostInfo.voiceName,
        };

        const limit = pLimit(P_LIMIT);
        const audioBufferPromises = podcastScript.dialogue.map((segment: DialogueSegment, i: number) => {
            return limit(async () => {
                const assignedPersonality = speakerVoiceMap[segment.speaker];
                if (!assignedPersonality) {
                    this.logger.warn(`No voice mapping for speaker: ${segment.speaker}. Skipping segment ${i + 1}.`);
                    return null;
                }
                this.logger.info(`Synthesizing segment ${i + 1}/${podcastScript.dialogue.length} for speaker "${segment.speaker}" with personality ${assignedPersonality}`);
                try {
    const audioBuffer = await this.tts.synthesize(segment.line, {
    voice: assignedPersonality,
    format: AUDIO_FORMAT
    });
    this.logger.debug(`Segment ${i + 1} synthesized successfully.`);
    return audioBuffer;
                } catch (error) {
    this.logger.error({ err: error, segment, speaker: segment.speaker }, `Failed to synthesize segment ${i + 1}.`);
    return null;
                }
            });
        });
        return Promise.all(audioBufferPromises);
    }
}