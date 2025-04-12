export { createPodcastService } from './podcast.service';
export type { PodcastService } from './podcast.service';
// Removed internal PodcastServiceDependencies export - consumer should use createPodcast

export { PodcastRepository } from './podcast.repository';
export type { PodcastSummary, PodcastWithTranscript, PodcastStatus } from './podcast.repository';
export { PodcastGenerationService } from './podcast-generation.service';
export { DialogueSynthesisService } from './dialogue-synthesis.service';

export { createAudioService } from './audio.service';
export type { AudioService } from './audio.service';
export { AUDIO_FORMAT } from './audio.service';

export type { GeneratePodcastScriptOutput } from './generate-podcast-script-prompt';
export { generatePodcastScriptPrompt } from './generate-podcast-script-prompt';

// Note: We might want to consider organizing exports further,
// e.g., creating separate entry points or using namespace exports if the package grows.