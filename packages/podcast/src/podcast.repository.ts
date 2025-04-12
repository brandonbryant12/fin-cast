import { desc, eq, and } from '@repo/db';
import * as schema from '@repo/db/schema';
import type { PersonalityId } from '@repo/ai';
import type { DatabaseInstance } from '@repo/db/client';
import type { AppLogger } from '@repo/logger';

type SelectTranscript = typeof schema.transcript.$inferSelect;

// Base type inferred from schema
type FullPodcast = typeof schema.podcast.$inferSelect;

// Specific type for lists/summaries, omitting audioUrl
// export type PodcastSummary = Omit<FullPodcast, 'audioUrl'>;
// todo - refactor to grab audio only when we hit play
export type PodcastSummary = FullPodcast;

// Specific type for detailed fetch, omitting audioUrl but including transcript
export type PodcastWithTranscript = Omit<FullPodcast, 'audioUrl'> & {
    transcript: SelectTranscript | null;
};

// Type for podcast status
export type PodcastStatus = FullPodcast['status'];

// Type for DialogueSegment (needed for updateTranscriptContent)
// TODO: Move this to a shared types file
interface DialogueSegment {
    speaker: string;
    line: string;
}

export class PodcastRepository {
    private readonly db: DatabaseInstance;
    private readonly logger: AppLogger;

    constructor(db: DatabaseInstance, logger: AppLogger) {
        this.db = db;
        this.logger = logger.child({ service: 'PodcastRepository' });
        this.logger.info('PodcastRepository initialized');
    }

    async createInitialPodcast(
        userId: string,
        sourceUrl: string,
        hostId: PersonalityId,
        cohostId: PersonalityId
    ): Promise<PodcastSummary> {
        const logger = this.logger.child({ userId, sourceUrl, hostId, cohostId, method: 'createInitialPodcast' });
        logger.info('Creating initial podcast and transcript entries in transaction.');

        try {
            const createdPodcast = await this.db.transaction(async (tx) => {
                const [podcastRecord] = await tx.insert(schema.podcast).values({
                    userId,
                    title: `Podcast from ${sourceUrl}`, // Initial title
                    status: 'processing',
                    sourceType: 'url',
                    sourceDetail: sourceUrl,
                    hostPersonalityId: hostId,
                    cohostPersonalityId: cohostId,
                    // Ensure columns match PodcastSummary type (no audioUrl)
                }).returning({
                    // Explicitly return columns needed for PodcastSummary
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
                    // TODO - we wont return this later when refactoring to grab audio at playtime
                    audioUrl: schema.podcast.audioUrl,
                });

                if (!podcastRecord?.id) {
                    logger.error('Failed to create podcast entry during transaction');
                    throw new Error('Failed to create podcast entry.');
                }
                logger.info({ podcastId: podcastRecord.id }, 'Podcast entry created.');

                await tx.insert(schema.transcript).values({
                    podcastId: podcastRecord.id,
                    content: [],
                });
                logger.info({ podcastId: podcastRecord.id }, 'Transcript entry created.');

                return podcastRecord;
            });

            if (!createdPodcast) {
                 logger.error('Podcast creation transaction finished but returned no data.');
                 throw new Error('Podcast creation failed unexpectedly after transaction.');
            }

            logger.info({ podcastId: createdPodcast.id }, 'Initial DB entries created successfully.');
            // TODO - we wont return audioUrl later when refactoring to grab audio at playtime
            return createdPodcast;

        } catch (error) {
            logger.error({ err: error }, 'Error during initial podcast creation transaction.');
            // Let the service layer decide how to handle DB errors
            throw new Error(`Database error during podcast creation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async updatePodcastStatus(
        podcastId: string,
        status: PodcastStatus,
        errorMessage?: string | null
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, status, method: 'updatePodcastStatus' });
        logger.info(`Updating podcast status to ${status}`);
        try {
            const updateData: Partial<FullPodcast> = { status };
            if (status === 'success') {
                updateData.errorMessage = null; // Clear error on success
            } else if (status === 'failed') {
                updateData.errorMessage = errorMessage ?? 'Unknown error'; // Set error on failure
            } else {
                // Optionally handle 'processing' or other statuses if needed
                updateData.errorMessage = null; // Clear error message for processing status
            }

            const result = await this.db.update(schema.podcast)
                .set(updateData)
                .where(eq(schema.podcast.id, podcastId))
                .returning({ id: schema.podcast.id }); // Check if update happened

            if (result.length === 0) {
                 logger.warn('Podcast not found during status update');
                 // Decide if this should throw an error or just log
                 // throw new Error('Podcast not found during status update');
                 return; 
            }
            logger.info(`Successfully updated podcast status to ${status}`);
        } catch (error) {
             logger.error({ err: error }, 'Failed to update podcast status in DB');
             throw new Error(`Database error updating podcast status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async updatePodcastGeneratedData(
        podcastId: string,
        title: string,
        audioUrl: string,
        durationSeconds: number
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, method: 'updatePodcastGeneratedData' });
        logger.info('Updating podcast with generated data (title, audioUrl, duration)');
        const generatedTime = new Date();
        try {
            const result = await this.db.update(schema.podcast)
                .set({
                    title: title,
                    audioUrl: audioUrl,
                    durationSeconds: durationSeconds,
                    generatedAt: generatedTime,
                    // We assume status/error are handled by updatePodcastStatus
                })
                .where(eq(schema.podcast.id, podcastId))
                .returning({ id: schema.podcast.id });

             if (result.length === 0) {
                 logger.warn('Podcast not found during generated data update');
                 // Decide if this should throw an error or just log
                 // throw new Error('Podcast not found during generated data update');
                 return; 
             }
            logger.info('Successfully updated podcast generated data.');
        } catch (error) {
             logger.error({ err: error }, 'Failed to update podcast generated data in DB');
             throw new Error(`Database error updating podcast generated data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async updateTranscriptContent(
        podcastId: string,
        dialogue: DialogueSegment[]
    ): Promise<void> {
        const logger = this.logger.child({ podcastId, method: 'updateTranscriptContent' });
        logger.info('Updating transcript content');
        try {
             // Drizzle needs the JSON structure to be correct for the jsonb column
            const contentToUpdate = dialogue ?? [];

            const result = await this.db.update(schema.transcript)
                .set({ content: contentToUpdate })
                .where(eq(schema.transcript.podcastId, podcastId))
                .returning({ id: schema.transcript.id }); // Check if update happened

            if (result.length === 0) {
                logger.warn('Transcript not found for podcast during content update');
                // This might happen if the initial transaction failed after podcast creation
                // Decide if this should throw an error or just log
                // throw new Error('Transcript not found during content update');
                return;
            }
            logger.info('Successfully updated transcript content.');
        } catch (error) {
             logger.error({ err: error }, 'Failed to update transcript content in DB');
             // Consider specific error handling if JSON format is invalid
             throw new Error(`Database error updating transcript content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async findPodcastsByUser(userId: string): Promise<PodcastSummary[]> {
        const logger = this.logger.child({ userId, method: 'findPodcastsByUser' });
        logger.info('Fetching podcasts for user');
        try {
            const results = await this.db.query.podcast.findMany({
                where: eq(schema.podcast.userId, userId),
                orderBy: desc(schema.podcast.createdAt),
                // Explicitly list columns for PodcastSummary type
                columns: { id: true, userId: true, title: true, description: true, status: true, sourceType: true, sourceDetail: true, durationSeconds: true, errorMessage: true, generatedAt: true, hostPersonalityId: true, cohostPersonalityId: true, createdAt: true, updatedAt: true, audioUrl: true }
            });
            logger.info({ count: results.length }, 'Successfully fetched podcasts');
            return results;
        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user podcasts');
            throw new Error('Could not retrieve user podcasts.');
        }
    }

    async findPodcastById(userId: string, podcastId: string): Promise<PodcastWithTranscript | null> {
        const logger = this.logger.child({ userId, podcastId, method: 'findPodcastById' });
        logger.info('Fetching podcast by ID with transcript');
        try {
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
                logger.warn('Podcast not found or user unauthorized');
                const exists = await this.db.query.podcast.findFirst({ where: eq(schema.podcast.id, podcastId), columns: { id: true }});
                if (!exists) {
                    logger.warn('Podcast ID does not exist');
                    return null;
                } else {
                    logger.warn('Unauthorized access attempt to podcast');
                     return null;
                }
            }

            const { transcript, ...podcastData } = result;
            logger.info('Successfully fetched podcast by ID');
            return {
                ...podcastData,
                transcript: transcript ?? null,
            };
        } catch(error) {
            logger.error({ err: error }, 'Failed to fetch podcast by ID');
            throw new Error('Could not retrieve the podcast.');
        }
    }

    // Method to fetch ONLY the audio URL when needed
    async getPodcastAudioUrl(userId: string, podcastId: string): Promise<string | null | undefined> {
        const logger = this.logger.child({ userId, podcastId, method: 'getPodcastAudioUrl' });
        logger.info('Fetching audio URL for podcast');
        try {
            const result = await this.db.query.podcast.findFirst({
                 where: and(eq(schema.podcast.id, podcastId), eq(schema.podcast.userId, userId)),
                 columns: { audioUrl: true }
            });
            if (!result) {
                // Handle not found or unauthorized similar to findPodcastById if necessary
                logger.warn('Podcast not found or user unauthorized when fetching audio URL');
                return undefined; // Or throw an error
            }
            logger.info('Successfully fetched audio URL');
            return result.audioUrl;
        } catch (error) {
             logger.error({ err: error }, 'Failed to fetch audio URL');
             throw new Error('Could not retrieve podcast audio URL.');
        }
    }

    async deletePodcast(userId: string, podcastId: string): Promise<{ success: boolean; deletedId: string } | { success: boolean; error: string }> {
        const logger = this.logger.child({ userId, podcastId, method: 'deletePodcast' });
        logger.info('Attempting to delete podcast');

        const podcast = await this.db.query.podcast.findFirst({
             where: eq(schema.podcast.id, podcastId),
             columns: { id: true, userId: true },
         });

        if (!podcast) {
            logger.warn('Podcast not found during delete attempt');
            return { success: false, error: `Podcast not found: ${podcastId}` };
        }
        if (podcast.userId !== userId) {
            logger.warn('Unauthorized delete attempt');
            return { success: false, error: 'Unauthorized delete' };
        }

        try {
            logger.info('Ownership verified, proceeding with deletion.');
            const result = await this.db
                .delete(schema.podcast)
                .where(eq(schema.podcast.id, podcastId))
                .returning({ deletedId: schema.podcast.id });

            if (!result || result.length === 0 || !result[0]?.deletedId) {
                 logger.error('Failed to confirm deletion in DB response');
                 return { success: false, error: 'Failed to confirm deletion in DB' };
            }

            logger.info('Podcast deleted successfully from DB');
            return { success: true, deletedId: result[0].deletedId };
        } catch (error) {
             logger.error({ err: error }, `Failed to delete podcast ID '${podcastId}' from DB`);
             return { success: false, error: 'Database error during deletion.' };
        }
    }

    // TODO: Add methods from PodcastService related to DB interactions
    // - createInitialPodcast
    // - updatePodcastStatus
    // - updatePodcastGeneratedData
    // - updateTranscriptContent
    // - checkPodcastExists (optional, maybe needed for auth checks)
} 