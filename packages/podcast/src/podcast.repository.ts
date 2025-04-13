import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import type { PersonalityId } from './personalities/personalities';
import type { DatabaseInstance } from '@repo/db/client';

type SelectTranscript = typeof schema.transcript.$inferSelect;

type FullPodcast = typeof schema.podcast.$inferSelect;

export type PodcastSummary = FullPodcast;

export type PodcastWithTranscript = Omit<FullPodcast, 'audioUrl'> & {
    transcript: SelectTranscript | null;
};

export type PodcastStatus = FullPodcast['status'];

interface DialogueSegment {
    speaker: string;
    line: string;
}

export class PodcastRepository {
    private readonly db: DatabaseInstance;

    constructor(db: DatabaseInstance) {
        this.db = db;
    }

    async createInitialPodcast(
        userId: string,
        sourceUrl: string,
        hostId: PersonalityId,
        cohostId: PersonalityId
    ): Promise<PodcastSummary> {
        const createdPodcast = await this.db.transaction(async (tx) => {
            const [podcastRecord] = await tx.insert(schema.podcast).values({
                userId,
                title: `Podcast from ${sourceUrl}`,
                status: 'processing',
                sourceType: 'url',
                sourceDetail: sourceUrl,
                hostPersonalityId: hostId,
                cohostPersonalityId: cohostId,
            }).returning({
                id: schema.podcast.id,
                userId: schema.podcast.userId,
                title: schema.podcast.title,
                description: schema.podcast.description,
                status: schema.podcast.status,
                sourceType: schema.podcast.sourceType,
                sourceDetail: schema.podcast.sourceDetail,
                durationSeconds: schema.podcast.durationSeconds,
                errorMessage: schema.podcast.errorMessage,
                generatedAt: schema.podcast.generatedAt,
                hostPersonalityId: schema.podcast.hostPersonalityId,
                cohostPersonalityId: schema.podcast.cohostPersonalityId,
                createdAt: schema.podcast.createdAt,
                updatedAt: schema.podcast.updatedAt,
                audioUrl: schema.podcast.audioUrl,
            });

            if (!podcastRecord?.id) {
                throw new Error('Failed to create podcast entry.');
            }

            await tx.insert(schema.transcript).values({
                podcastId: podcastRecord.id,
                content: [],
            });

            return podcastRecord;
        });

        if (!createdPodcast) {
            throw new Error('Podcast creation failed unexpectedly after transaction.');
        }

        return createdPodcast;
    }

    async updatePodcastStatus(
        podcastId: string,
        status: PodcastStatus,
        errorMessage?: string | null
    ): Promise<void> {
        const updateData: Partial<FullPodcast> = { status };
        if (status === 'success') {
            updateData.errorMessage = null;
        } else if (status === 'failed') {
            updateData.errorMessage = errorMessage ?? 'Unknown error';
        } else {
            updateData.errorMessage = null;
        }

        const result = await this.db.update(schema.podcast)
            .set(updateData)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ id: schema.podcast.id });

        if (result.length === 0) {
            return;
        }
    }

    async updatePodcastGeneratedData(
        podcastId: string,
        title: string,
        audioUrl: string,
        durationSeconds: number
    ): Promise<void> {
        const generatedTime = new Date();
        const result = await this.db.update(schema.podcast)
            .set({
                title: title,
                audioUrl: audioUrl,
                durationSeconds: durationSeconds,
                generatedAt: generatedTime,
            })
            .where(eq(schema.podcast.id, podcastId))
            .returning({ id: schema.podcast.id });

        if (result.length === 0) {
            return;
        }
    }

    async updateTranscriptContent(
        podcastId: string,
        dialogue: DialogueSegment[]
    ): Promise<void> {
        const contentToUpdate = dialogue ?? [];
        const result = await this.db.update(schema.transcript)
            .set({ content: contentToUpdate })
            .where(eq(schema.transcript.podcastId, podcastId))
            .returning({ id: schema.transcript.id });

        if (result.length === 0) {
            return;
        }
    }

    async findPodcastsByUser(userId: string): Promise<PodcastSummary[]> {
        const results = await this.db.query.podcast.findMany({
            where: eq(schema.podcast.userId, userId),
            orderBy: desc(schema.podcast.createdAt),
            columns: { id: true, userId: true, title: true, description: true, status: true, sourceType: true, sourceDetail: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true, audioUrl: true }
        });
        return results;
    }

    async findPodcastById(userId: string, podcastId: string): Promise<PodcastWithTranscript | null> {
        const result = await this.db.query.podcast.findFirst({
            where: and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)),
            columns: { id: true, userId: true, title: true, description: true, status: true, sourceType: true, sourceDetail: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true },
            with: {
                transcript: {
                    columns: {
                       content: true,
                       podcastId: true,
                       id: true,
                       createdAt: true,
                       updatedAt: true,
                       format: true
                    }
                }
            }
        });

        if (!result) {
            return null;
        }

        const { transcript, ...podcastData } = result;
        return {
            ...podcastData,
            transcript: transcript ?? null,
        };
    }

    async getPodcastAudioUrl(userId: string, podcastId: string): Promise<string | null | undefined> {
        const result = await this.db.query.podcast.findFirst({
            where: and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)),
            columns: { audioUrl: true }
        });
        if (!result) {
            return undefined;
        }
        return result.audioUrl;
    }

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId: string } | { success: boolean; error: string }> {
        const podcast = await this.db.query.podcast.findFirst({
            where: eq(schema.podcast.id, podcastId),
            columns: { id: true, userId: true },
        });

        if (!podcast) {
            return { success: false, error: `Podcast not found: ${podcastId}` };
        }
        if (podcast.userId !== userId) {
            return { success: false, error: 'Unauthorized delete' };
        }

        const result = await this.db
            .delete(schema.podcast)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ deletedId: schema.podcast.id });

        if (!result || result.length === 0 || !result[0]?.deletedId) {
            return { success: false, error: 'Failed to confirm deletion in DB' };
        }

        return { success: true, deletedId: result[0].deletedId };
    }
} 