import * as v from 'valibot';
import { PersonalityId } from '../personalities/personalities';

export const PersonalityIdSchema = v.enum(PersonalityId);
export type PersonalityIdType = v.InferInput<typeof PersonalityIdSchema>;

export const DialogueSegmentSchema = v.object({
  speaker: v.string(),
  line: v.pipe(v.string(), v.minLength(1, 'Dialogue line cannot be empty.'))
});
export type DialogueSegment = v.InferOutput<typeof DialogueSegmentSchema>;

export const PodcastContentSchema = v.pipe(v.array(DialogueSegmentSchema), v.minLength(1, 'Podcast content must contain at least one segment.'));
export type PodcastContent = v.InferOutput<typeof PodcastContentSchema>;

export const UpdatePodcastInputSchema = v.object({
  userId: v.string(),
  podcastId: v.string(),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  content: v.optional(PodcastContentSchema),
  hostPersonalityId: v.optional(PersonalityIdSchema),
  cohostPersonalityId: v.optional(PersonalityIdSchema)
});
export type UpdatePodcastInput = v.InferInput<typeof UpdatePodcastInputSchema>;

export const PodcastServiceUpdateInputSchema = v.object({
  podcastId: v.string(),
  title: v.optional(v.string()),
  summary: v.optional(v.string()),
  content: v.optional(PodcastContentSchema),
  hostPersonalityId: v.optional(PersonalityIdSchema),
  cohostPersonalityId: v.optional(PersonalityIdSchema)
});
export type PodcastServiceUpdateInput = v.InferInput<typeof PodcastServiceUpdateInputSchema>;