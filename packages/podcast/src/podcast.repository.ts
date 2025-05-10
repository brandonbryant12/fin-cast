import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import type { PersonalityId } from './personalities/personalities';
import type { PodcastContent } from './validations/validations';
import type { DatabaseInstance } from '@repo/db/client';

type SelectTranscript = typeof schema.transcript.$inferSelect;
type FullPodcast = typeof schema.podcast.$inferSelect;

export type PodcastSummary = FullPodcast;

export type PodcastSummaryWithTags = FullPodcast & {
  tags: { tag: string }[];
};

export type PodcastWithTranscript = FullPodcast & {
    transcript: SelectTranscript | null;
    tags: { tag: string }[];
};

export type PodcastStatus = FullPodcast['status'];

type PodcastUpdatePayload = Partial<Omit<FullPodcast, 'id' | 'userId' | 'createdAt' | 'sourceType' | 'sourceDetail'> & { summary?: string | null }>;


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
                summary:  `Podcast from ${sourceUrl}`,
                status: 'processing',
                sourceType: 'url',
                sourceDetail: sourceUrl,
                hostPersonalityId: hostId,
                cohostPersonalityId: cohostId,
            }).returning();

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
        const updateData: Partial<FullPodcast> = { status, updatedAt: new Date() };
        if (status === 'success') {
            updateData.errorMessage = null;
        } else if (status === 'failed') {
            updateData.errorMessage = errorMessage ?? 'Unknown error';
        } else {
            updateData.errorMessage = null;
        }

        await this.db.update(schema.podcast)
            .set(updateData)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ id: schema.podcast.id });
    }

    /**
     * Finds a podcast by ID, ensuring it belongs to the specified user, and includes transcript data.
     */
    async findPodcastById(podcastId: string): Promise<PodcastWithTranscript | null> {
        const result = await this.db.query.podcast.findFirst({
            where: and(eq(schema.podcast.id, podcastId)),
            columns: {
              id: true, userId: true, title: true, summary: true, description: true, status: true, sourceType: true, sourceDetail: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true, audioUrl: true,
            },
            with: {
                transcript: {
                    columns: {
                        content: true, podcastId: true, id: true, createdAt: true, updatedAt: true, format: true
                    }
                },
                tags: {
                  columns: {
                    tag: true,
                  }
                }
              }
            });

        if (!result) {
            return null;
        }

        return {
            ...result,
            transcript: result.transcript ?? null,
            tags: result.tags ?? [],
          };
        }


    async updatePodcast(
        podcastId: string,
        data: PodcastUpdatePayload
    ): Promise<PodcastWithTranscript | null> {
        const updateData: any = { ...data };
        updateData.updatedAt = new Date();
        if ('audioUrl' in updateData && updateData.audioUrl === undefined) {
          updateData.audioUrl = null;
        }
        if ('durationSeconds' in updateData && updateData.durationSeconds === undefined) {
          updateData.durationSeconds = null;
        }
        if ('errorMessage' in updateData && updateData.errorMessage === undefined) {
           updateData.errorMessage = null;
        }
        if ('generatedAt' in updateData && updateData.generatedAt === undefined) {
          updateData.generatedAt = null;
        }    
        await this.db.update(schema.podcast)
            .set(updateData)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ id: schema.podcast.id });
        return this.findPodcastById(podcastId);
    }

    async updateTranscriptContent(
        podcastId: string,
        dialogue: PodcastContent
    ): Promise<void> {
        const contentToUpdate = dialogue ?? [];
        await this.db.update(schema.transcript)
            .set({ content: contentToUpdate, updatedAt: new Date() })
            .where(eq(schema.transcript.podcastId, podcastId))
            .returning({ id: schema.transcript.id });
    }
  
    /**
     * Adds multiple tags for a specific podcast.
     * @param podcastId The ID of the podcast.
     * @param tags An array of tag strings to add.
     */
    async addTagsForPodcast(podcastId: string, tags: string[]): Promise<void> {
      if (tags.length === 0) {
        return;
      }
      const tagRecords = tags.map(tag => ({ podcastId, tag }));
      await this.db.insert(schema.tag).values(tagRecords).onConflictDoNothing();
    }
  
    async findPodcastsByUser(userId: string): Promise<PodcastSummaryWithTags[]> {
      const results = await this.db.query.podcast.findMany({
        where: eq(schema.podcast.userId, userId),
          orderBy: desc(schema.podcast.createdAt),
          columns: { id: true, userId: true, title: true, summary: true, description: true, status: true, sourceType: true, sourceDetail: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true, audioUrl: true },
          with: {
            tags: {
              columns: {
                tag: true,
              }
            }
          }
        });
        return results.map(p => ({
            ...p,
            tags: p.tags?.map(t => ({ tag: t.tag })) ?? [],
        }));
      }

    async getPodcastAudioUrl(userId: string, podcastId: string): Promise<string | null | undefined> {
        const result = await this.db.query.podcast.findFirst({
            where: and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)),
            columns: { audioUrl: true }
        });
        return result?.audioUrl;
    }

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId: string } > {
        const deletedResult = await this.db.transaction(async (tx) => {
            const podcast = await tx.query.podcast.findFirst({
                where: eq(schema.podcast.id, podcastId),
                columns: { id: true, userId: true },
            });

            const user = await tx.query.user.findFirst({
              where: eq(schema.user.id, userId),
              columns: { isAdmin: true }
            });

            if (!podcast) {
                throw new Error(`Podcast not found: ${podcastId}`);
            }
            if (podcast.userId !== userId && !user?.isAdmin) {
                throw new Error('Unauthorized delete');
            }

            await tx.delete(schema.transcript).where(eq(schema.transcript.podcastId, podcastId));
            await tx.delete(schema.tag).where(eq(schema.tag.podcastId, podcastId));
            const result = await tx
                .delete(schema.podcast)
                .where(eq(schema.podcast.id, podcastId))
                .returning({ deletedId: schema.podcast.id });

            if (!result || result.length === 0 || !result[0]?.deletedId) {
                throw new Error('Failed to confirm podcast deletion in DB transaction');
            }
            return result[0].deletedId;
        });
        return { success: true, deletedId: deletedResult };
    }

    async adminDeletePodcast(podcastId: string): Promise<{ success: boolean; deletedId: string }> {
      const deletedResult = await this.db.transaction(async (tx) => {
        await tx.delete(schema.transcript).where(eq(schema.transcript.podcastId, podcastId));
        await tx.delete(schema.tag).where(eq(schema.tag.podcastId, podcastId));
        await tx.delete(schema.review).where(and(
            eq(schema.review.entityId, podcastId),
            eq(schema.review.contentType, 'podcast')
        ));

        const result = await tx
          .delete(schema.podcast)
          .where(eq(schema.podcast.id, podcastId))
          .returning({ deletedId: schema.podcast.id });

        if (!result || result.length === 0 || !result[0]?.deletedId) {
          throw new Error('Podcast not found or failed to confirm deletion.');
        }
        return result[0].deletedId;
      });
      return { success: true, deletedId: deletedResult };
    }
} 