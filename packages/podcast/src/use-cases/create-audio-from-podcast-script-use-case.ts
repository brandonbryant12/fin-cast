import pLimit from 'p-limit';
import type { PersonalityInfo } from "../personalities/personalities";
import type { PodcastScriptOutput } from "../types/podcast-script";
import type { AudioService } from "@repo/audio";
import type { AppLogger } from "@repo/logger";
import type { TTSService } from '@repo/tts';

const P_LIMIT = 5;
const AUDIO_FORMAT = 'mp3';

export default class CreateAudioFromPodcastScriptUseCase {
    private readonly audioService: AudioService;
    private readonly logger: AppLogger;
    private readonly tts: TTSService;
    constructor({ 
        audioService,
        logger,
        tts,
    }: {
        audioService: AudioService,
        logger: AppLogger
        tts: TTSService,
    }){
        this.audioService = audioService;
        this.logger = logger;
        this.tts = tts;
    }

    async execute(processId: string, podcastScript: PodcastScriptOutput, host: PersonalityInfo, cohost: PersonalityInfo) {
        const audioBuffers = await this.generateAudioBuffers(podcastScript, host, cohost);
        const finalAudioBuffer = await this.audioService.stitchAudio(audioBuffers.filter(b => b !== null) as Buffer[], processId);
        const durationSeconds = await this.audioService.getAudioDuration(finalAudioBuffer);
        const audioUrl = await this.audioService.audioUrlFromBuffer(finalAudioBuffer);
        return {
            audioUrl,
            durationSeconds,
        };
    }

    async generateAudioBuffers(podcastScript: PodcastScriptOutput, hostInfo: PersonalityInfo, cohostInfo: PersonalityInfo) {
        const speakerVoiceMap = {
            [hostInfo.name]: hostInfo.voiceName,
            [cohostInfo.name]: cohostInfo.voiceName,
        };

        const limit = pLimit(P_LIMIT);
        const audioBufferPromises = podcastScript.dialogue.map((segment, i) => {
            return limit(async () => {
                const assignedPersonality = speakerVoiceMap[segment.speaker];
                this.logger.info(`Synthesizing segment ${i + 1}/${podcastScript.dialogue.length} for speaker "${segment.speaker}" with personality ${assignedPersonality}`);
                const audioBuffer = await this.tts.synthesize(segment.line, {
                    voice: assignedPersonality,
                    format: AUDIO_FORMAT
                });
                this.logger.debug(`Segment ${i + 1} synthesized successfully.`);
                return audioBuffer;
 
            });
        });
        return Promise.all(audioBufferPromises);
    }
}