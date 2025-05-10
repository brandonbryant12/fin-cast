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
import { PodcastRepository, type DialogueSegment } from '../podcast.repository';
import CreateAudioFromPodcastScriptUseCase from './create-audio-from-podcast-script-use-case';

const DialogueSegmentSchema = v.object({
    speaker: v.string(),
    line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});
const ContentSchema = v.pipe(v.array(DialogueSegmentSchema), v.minLength(1, 'Podcast content must contain at least one segment.'));

export type UpdatePodcastInput = {
    userId: string; // For authorization
    podcastId: string;
    title?: string;
    summary?: string;
    content?: DialogueSegment[];
    hostPersonalityId?: PersonalityId;
    cohostPersonalityId?: PersonalityId;
};

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

    async execute(input: UpdatePodcastInput) {
        const { userId, podcastId, title, summary, content, hostPersonalityId, cohostPersonalityId } = input;
        const currentPodcast = await this.podcastRepository.findPodcastById(podcastId); // TODO only user or admin can edit podcast
        const user = await this.db.query.user.findFirst({  where: (eq(schema.user.id, userId)),});
        if (!currentPodcast || (!user?.isAdmin && currentPodcast.userId !== userId)) {
            throw new NotFoundError('Podcast not found.');
        }

        let dialogue;
        if (content) {
            const result = v.safeParse(ContentSchema, content);
            if (result.success) {
                dialogue = result.output;
            } else {
                throw new ValidationError('Invalid podcast content provided.');
            }
        }
        const podcastScript = {
            title: title ?? currentPodcast.title,
            summary: summary ?? currentPodcast.summary,
            dialogue: dialogue ?? currentPodcast.transcript?.content
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
        const podcastUpdate = {
            title,
            summary,
            status: needsRegeneration ? 'processing' : currentPodcast.status,
            audioUrl: needsRegeneration ? null : undefined,
        };
        const updatedPodcast = await this.podcastRepository.updatePodcast(podcastId, podcastUpdate);
        if(needsRegeneration) {
            this.updatePodcastAudio(podcastId, podcastScript, host, cohost);
        }
        return updatedPodcast;
    }

    async updatePodcastAudio(podcastId: string, podcastScript: PodcastScriptOutput, host: PersonalityInfo, cohost: PersonalityInfo) {
        await this.podcastRepository.updateTranscriptContent(podcastId, podcastScript.dialogue);
        const { audioUrl, durationSeconds } = await new CreateAudioFromPodcastScriptUseCase({
            audioService: this.audioService,
            logger: this.logger,
            tts: this.tts,
        }).execute(podcastId, podcastScript, host, cohost);
        await this.podcastRepository.updatePodcast(podcastId, {
            status: 'success',
            audioUrl,
            durationSeconds
        });
    }
}
