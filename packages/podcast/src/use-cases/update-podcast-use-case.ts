import { eq } from '@repo/db';
import * as schema from '@repo/db/schema';
import { NotFoundError, ValidationError } from '@repo/errors';
import * as v from 'valibot';
import type { PodcastScriptOutput } from '../types/podcast-script';
import type { AudioService } from '@repo/audio';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';
import type { TTSService } from '@repo/tts';

import { PersonalityId, getPersonalityInfo, type PersonalityInfo } from '../personalities/personalities';
import { PodcastRepository } from '../podcast.repository';
import { PodcastContentSchema, type UpdatePodcastInput, type PodcastContent } from '../validations/validations';
import CreateAudioFromPodcastScriptUseCase from './create-audio-from-podcast-script-use-case';

export default class UpdatePodcastUseCase {
    private readonly logger: AppLogger;
    private readonly podcastRepository: PodcastRepository;
    private readonly tts: TTSService;
    private readonly audioService: AudioService;
    private readonly db: DatabaseInstance;

    constructor({
        logger,
        podcastRepository,
        tts,
        audioService,
        db,
    }: {
        logger: AppLogger;
        podcastRepository: PodcastRepository;
        tts: TTSService;
        audioService: AudioService;
        db: DatabaseInstance;
    }) {
        this.logger = logger.child({ context: 'UpdatePodcastUseCase' });
        this.podcastRepository = podcastRepository;
        this.tts = tts;
        this.audioService = audioService;
        this.db = db;
    }

    async execute(input: UpdatePodcastInput) { // Type is now imported
        const { userId, podcastId, title, summary, content, hostPersonalityId, cohostPersonalityId } = input;
        const currentPodcast = await this.podcastRepository.findPodcastById(podcastId);
        const user = await this.db.query.user.findFirst({  where: (eq(schema.user.id, userId)),});
        if (!currentPodcast || (!user?.isAdmin && currentPodcast.userId !== userId)) {
            throw new NotFoundError('Podcast not found.');
        }

        let dialogue: PodcastContent | undefined;
        if (content) {
            const result = v.safeParse(PodcastContentSchema, content); // Use imported PodcastContentSchema
            if (result.success) {
                dialogue = result.output;
            } else {
                throw new ValidationError('Invalid podcast content provided.');
            }
        }
        const podcastScript = {
            title: title ?? currentPodcast.title,
            summary: summary ?? currentPodcast.summary,
            dialogue: dialogue ?? currentPodcast.transcript?.content as PodcastContent, // Ensure type compatibility
            tags: currentPodcast.tags?.map(t => t.tag) ?? [], // Add tags from currentPodcast or default to empty array
        } as PodcastScriptOutput;

        const hostId = hostPersonalityId ?? currentPodcast.hostPersonalityId as PersonalityId;
        const cohostId = cohostPersonalityId ?? currentPodcast.cohostPersonalityId as PersonalityId;

        if (hostId === cohostId) {
            throw new ValidationError('Host and co-host personalities must be different.');
        }
        const host = getPersonalityInfo(hostId, this.tts.getProvider());
        const cohost = getPersonalityInfo(cohostId, this.tts.getProvider());

        let needsRegeneration = false;
        if (content) needsRegeneration = true;
        if (hostId !== currentPodcast.hostPersonalityId) needsRegeneration = true;
        if (cohostId !== currentPodcast.cohostPersonalityId) needsRegeneration = true;
        const podcastUpdateData: Partial<typeof schema.podcast.$inferSelect> = { // Corrected type
            title,
            summary,
            hostPersonalityId: hostId,
            cohostPersonalityId: cohostId,
            status: needsRegeneration ? 'processing' : currentPodcast.status,
            audioUrl: needsRegeneration ? null : currentPodcast.audioUrl,
            durationSeconds: needsRegeneration ? null : currentPodcast.durationSeconds,
        };
        // Filter out undefined values to prevent overriding with null in the DB unless explicitly null
        const filteredUpdateData = Object.fromEntries(Object.entries(podcastUpdateData).filter(([, value]) => value !== undefined));


        const updatedPodcast = await this.podcastRepository.updatePodcast(podcastId, filteredUpdateData as Partial<typeof schema.podcast.$inferSelect>); // Cast if necessary after filtering
        if(needsRegeneration) {
            this.updatePodcastAudioInBackground(podcastId, podcastScript, host, cohost);
        }
        return updatedPodcast;
    }

    private async updatePodcastAudioInBackground(podcastId: string, podcastScript: PodcastScriptOutput, host: PersonalityInfo, cohost: PersonalityInfo) {
        try {
            await this.podcastRepository.updateTranscriptContent(podcastId, podcastScript.dialogue as PodcastContent);
            const { audioUrl, durationSeconds } = await new CreateAudioFromPodcastScriptUseCase({
                audioService: this.audioService,
                logger: this.logger,
                tts: this.tts,
            }).execute(podcastId, podcastScript, host, cohost);
            await this.podcastRepository.updatePodcast(podcastId, {
                status: 'success',
                audioUrl,
                durationSeconds,
                errorMessage: null, // Clear any previous error message
            });
        } catch (error) {
            this.logger.error({ err: error, podcastId }, "Failed to update podcast audio in background");
            await this.podcastRepository.updatePodcast(podcastId, {
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : "Unknown error during audio regeneration",
            });
        }
    }
}