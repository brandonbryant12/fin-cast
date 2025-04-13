import type { AppRouter } from '@repo/api/server';
import type { inferRouterOutputs } from '@trpc/server';

// --- Podcast Types ---

// Infer the output type of the myPodcasts procedure
type PodcastListOutput = inferRouterOutputs<AppRouter>['podcasts']['myPodcasts'];

// Extract the type of a single podcast from the array output
export type Podcast = PodcastListOutput[number];

// Define the possible statuses
export type PodcastStatus = 'processing' | 'failed' | 'success';

// --- Personality / Voice Types ---

// Infer the output type of the getAvailablePersonalities procedure
type PersonalitiesOutput = inferRouterOutputs<AppRouter>['podcasts']['getAvailablePersonalities'];

// Extract the type of a single personality from the array output
export type PersonalityInfo = PersonalitiesOutput[number];
