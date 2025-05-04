import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import type { PersonalityId } from './personalities/personalities';
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

export interface DialogueSegment {
    speaker: string;
    line: string;
}

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
                status: 'processing', // Start as processing
                sourceType: 'url',
                sourceDetail: sourceUrl,
                hostPersonalityId: hostId,
                cohostPersonalityId: cohostId,
            }).returning(); // Return all columns

            if (!podcastRecord?.id) {
                throw new Error('Failed to create podcast entry.');
            }

            await tx.insert(schema.transcript).values({
                podcastId: podcastRecord.id,
                content: [], // Start with empty transcript content
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
            // For 'processing' or other statuses, clear the error message
            updateData.errorMessage = null;
        }

        const result = await this.db.update(schema.podcast)
            .set(updateData)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ id: schema.podcast.id });

        if (result.length === 0) {
            // Log or handle the case where the podcast wasn't found for status update
            console.warn(`Podcast with ID ${podcastId} not found for status update.`);
        }
    }

    /**
     * Finds a podcast by ID, ensuring it belongs to the specified user, and includes transcript data.
     */
    async findPodcastByIdAndUser(userId: string, podcastId: string): Promise<PodcastWithTranscript | null> {
        const result = await this.db.query.podcast.findFirst({
            where: and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)),
            // Explicitly list columns to omit audioUrl by default if it's large/not always needed
            columns: {
              id: true, userId: true, title: true, summary: true, description: true, status: true, sourceType: true, sourceDetail: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true, audioUrl: true,
            },
            with: {
                transcript: { // Eager load transcript content
                    columns: {
                        content: true, podcastId: true, id: true, createdAt: true, updatedAt: true, format: true
                    }
                },
                tags: { // Eager load tags
                  columns: {
                    tag: true,
                  }
                }
              }
            });

        if (!result) {
            return null;
        }

        // Drizzle includes the relation under the 'with' key name
        return {
            ...result,
            transcript: result.transcript ?? null,
            tags: result.tags ?? [], // Include tags, defaulting to empty array
          };
        }


    async updatePodcast(
        podcastId: string,
        data: PodcastUpdatePayload // Use the defined type for safety
    ): Promise<void> {
        const updateData: any = { ...data };

        // Ensure updatedAt is always set on update
        updateData.updatedAt = new Date();
        if ('audioUrl' in updateData && updateData.audioUrl === undefined) {
          updateData.audioUrl = null; // Ensure undefined becomes null in DB
        }
        if ('durationSeconds' in updateData && updateData.durationSeconds === undefined) {
          updateData.durationSeconds = null; // Ensure undefined becomes null
        }
        if ('errorMessage' in updateData && updateData.errorMessage === undefined) {
           updateData.errorMessage = null;
        }
        if ('generatedAt' in updateData && updateData.generatedAt === undefined) {
          updateData.generatedAt = null;
        }    
        const result = await this.db.update(schema.podcast)
            .set(updateData)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ id: schema.podcast.id });

        if (result.length === 0) {
            console.warn(`Podcast with ID ${podcastId} not found for update.`);
        }
    }

    async updateTranscriptContent(
        podcastId: string,
        dialogue: DialogueSegment[]
    ): Promise<void> {
        const contentToUpdate = dialogue ?? [];
        const result = await this.db.update(schema.transcript)
            .set({ content: contentToUpdate, updatedAt: new Date() })
            .where(eq(schema.transcript.podcastId, podcastId))
            .returning({ id: schema.transcript.id });

        if (result.length === 0) {
            console.warn(`Transcript for podcast ID ${podcastId} not found for update.`);
        }
    }
  
    /**
     * Adds multiple tags for a specific podcast.
     * @param podcastId The ID of the podcast.
     * @param tags An array of tag strings to add.
     */
    async addTagsForPodcast(podcastId: string, tags: string[]): Promise<void> {
      if (tags.length === 0) {
        return; // Nothing to insert
      }
      const tagRecords = tags.map(tag => ({ podcastId, tag }));
      try {
        // Use onConflictDoNothing to avoid errors if a tag already exists for the podcast
        await this.db.insert(schema.tag).values(tagRecords).onConflictDoNothing();
      } catch (error) {
        console.error(`Failed to add tags for podcast ${podcastId}:`, error);
        // Optionally re-throw or handle more gracefully
        throw new Error(`Could not add tags for podcast ${podcastId}`);
      }
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

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId: string } | { success: boolean; error: string }> {
        try {
            const deletedResult = await this.db.transaction(async (tx) => {
                const podcast = await tx.query.podcast.findFirst({
                    where: eq(schema.podcast.id, podcastId),
                    columns: { id: true, userId: true },
                });

                if (!podcast) {
                    throw new Error(`Podcast not found: ${podcastId}`);
                }
                if (podcast.userId !== userId) {
                    throw new Error('Unauthorized delete');
                }

                // Delete related records first (or handle cascade delete in DB schema)
                await tx.delete(schema.transcript).where(eq(schema.transcript.podcastId, podcastId));
                await tx.delete(schema.tag).where(eq(schema.tag.podcastId, podcastId)); // Delete tags
        
                // Then delete podcast
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
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown deletion error';
            console.error(`Failed to delete podcast ${podcastId}: ${message}`);
            return { success: false, error: message };
        }
    }

    async adminDeletePodcast(podcastId: string): Promise<{ success: boolean; deletedId: string } | { success: boolean; error: string }> {
      // This method assumes the caller (admin service) has already verified permissions.
      // It deletes the podcast regardless of userId.
      try {
        const deletedResult = await this.db.transaction(async (tx) => {
          // Delete related records first (or handle cascade delete in DB schema)
          await tx.delete(schema.transcript).where(eq(schema.transcript.podcastId, podcastId));
          await tx.delete(schema.tag).where(eq(schema.tag.podcastId, podcastId));
          await tx.delete(schema.review).where(and(
              eq(schema.review.entityId, podcastId),
              eq(schema.review.contentType, 'podcast')
          ));

          // Then delete podcast
          const result = await tx
            .delete(schema.podcast)
            .where(eq(schema.podcast.id, podcastId))
            .returning({ deletedId: schema.podcast.id });

          if (!result || result.length === 0 || !result[0]?.deletedId) {
            // Podcast might have already been deleted, consider this success or failure based on needs
            throw new Error('Podcast not found or failed to confirm deletion.');
          }
          return result[0].deletedId;
        });
        return { success: true, deletedId: deletedResult };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown deletion error';
        console.error(`Admin failed to delete podcast ${podcastId}: ${message}`);
        return { success: false, error: message };
      }
    }
} 