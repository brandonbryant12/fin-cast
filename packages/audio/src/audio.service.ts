import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import type { AppLogger } from '@repo/logger';

export const AUDIO_FORMAT = 'mp3';
const FFMPEG_PATH = '/usr/bin/ffmpeg';
const FFPROBE_PATH = '/usr/bin/ffprobe';

export interface AudioServiceDependencies {
    logger: AppLogger;
    isRunningInDocker: boolean;
}

export class AudioService {
    private readonly logger: AppLogger;
    private isRunningInDocker = false;


    constructor({ logger, isRunningInDocker }: AudioServiceDependencies) {
        this.logger = logger.child({ service: 'AudioService' });

        this.logger.info(`AudioService initialized. Docker environment flag: ${isRunningInDocker}`);

        if (isRunningInDocker) {
            this.isRunningInDocker = true;
            this.logger.info('Docker flag is true, setting explicit ffmpeg paths:', { FFMPEG_PATH, FFPROBE_PATH });
        } else {
            this.logger.info('Docker flag is false, relying on default ffmpeg path discovery.');
        }
    }

    /**
     * Stitches multiple audio buffers into a single audio file.
     * @param audioBuffers An array of audio Buffers (null or undefined entries are ignored).
     * @param processId An identifier for temporary file naming (e.g., podcastId).
     * @returns A promise resolving to the Buffer of the concatenated audio file.
     * @throws If stitching fails or no valid buffers are provided.
     */
    async stitchAudio(audioBuffers: (Buffer | null | undefined)[], processId: string): Promise<Buffer> {
        const logger = this.logger.child({ method: 'stitchAudio', processId });
        const validBuffers = audioBuffers.filter((buffer): buffer is Buffer => Buffer.isBuffer(buffer));

        if (validBuffers.length === 0) {
            logger.error('No valid audio buffers provided for stitching.');
            throw new Error('Cannot stitch audio: No valid audio buffers available.');
        }
        logger.info(`Stitching ${validBuffers.length} audio segments.`);

        const tempAudioFiles: string[] = [];
        const finalOutputFileName = `audio-${processId}-final-${crypto.randomBytes(4).toString('hex')}.${AUDIO_FORMAT}`;
        const finalOutputPath = path.join(os.tmpdir(), finalOutputFileName);

        try {
            let i = 0;
            for (const buffer of validBuffers) {
                const tempFileName = `audio-${processId}-segment-${i}-${crypto.randomBytes(4).toString('hex')}.${AUDIO_FORMAT}`;
                const tempFilePath = path.join(os.tmpdir(), tempFileName);
                await fs.writeFile(tempFilePath, buffer);
                tempAudioFiles.push(tempFilePath);
                logger.debug(`Written temporary audio file: ${tempFilePath}`);
                i++;
            }
            logger.info(`Created ${tempAudioFiles.length} temporary audio files for stitching.`);

            await new Promise<void>((resolve, reject) => {
                const command = ffmpeg();
                if(this.isRunningInDocker) {
                    command.setFfmpegPath(FFMPEG_PATH);
                    command.setFfprobePath(FFPROBE_PATH);
                }
                tempAudioFiles.forEach(file => {
                    command.input(file);
                });

                command
                    .on('start', (commandLine: string) => { logger.info(`ffmpeg merge process started: ${commandLine}`); })
                    .on('error', (err: Error, stdout: string, stderr: string) => {
                        logger.error({ err: err.message, ffmpeg_stdout: stdout, ffmpeg_stderr: stderr }, 'ffmpeg merge failed.');
                        reject(new Error(`ffmpeg merge failed: ${err.message}`));
                    })
                    .on('end', (stdout: string, stderr: string) => {
                        logger.info({ ffmpeg_stdout: stdout, ffmpeg_stderr: stderr }, 'ffmpeg merge finished successfully.');
                        resolve();
                    })
                    .mergeToFile(finalOutputPath);
            });
            logger.info(`Successfully merged audio segments to ${finalOutputPath}`);

            const finalAudioBuffer = await fs.readFile(finalOutputPath);
            logger.info(`Read final merged audio file (${finalAudioBuffer.length} bytes).`);
            tempAudioFiles.push(finalOutputPath);
            return finalAudioBuffer;

        } catch (error) {
            logger.error({ err: error }, 'Audio stitching process failed.');
            if (!tempAudioFiles.includes(finalOutputPath)) {
                 try {
                     await fs.access(finalOutputPath);
                     tempAudioFiles.push(finalOutputPath);
                 } catch { /* File doesn't exist, no need to add */ }
            }
            throw error; // Re-throw the error after attempting to mark for cleanup
        } finally {
            if (tempAudioFiles.length > 0) {
                logger.info(`Cleaning up ${tempAudioFiles.length} temporary/output audio files...`);
                await Promise.all(tempAudioFiles.map(async (tempFile) => {
                    try {
                        await fs.unlink(tempFile);
                        logger.debug(`Deleted temporary/output file: ${tempFile}`);
                    } catch (cleanupError: any) {
                        // Don't log error if file simply doesn't exist (e.g., merge failed before creation)
                        if (cleanupError?.code !== 'ENOENT') {
                            logger.error({ err: cleanupError, file: tempFile }, 'Failed to delete temporary/output audio file during cleanup.');
                        }
                    }
                }));
                logger.info('Temporary/output file cleanup finished.');
            }
        }
    }

     /**
      * Gets the duration of an audio file using ffprobe.
      * @param audioBuffer The audio content as a Buffer.
      * @returns A promise resolving to the duration in seconds (rounded), or 0 if detection fails.
      */
     async getAudioDuration(audioBuffer: Buffer): Promise<number> {
         const logger = this.logger.child({ method: 'getAudioDuration' });
         const tempFileName = `duration-probe-${crypto.randomUUID()}.${AUDIO_FORMAT}`;
         const tempFilePath = path.join(os.tmpdir(), tempFileName);

         try {
             await fs.writeFile(tempFilePath, audioBuffer);
             logger.debug(`Wrote temporary file for duration probe: ${tempFilePath}`);

             const duration = await new Promise<number>((resolveProbe, rejectProbe) => {
                 ffmpeg(tempFilePath).ffprobe((err: Error | null, metadata?: ffmpeg.FfprobeData) => { // Make Error nullable
                     if (err) {
                         logger.warn({ err: err.message, file: tempFilePath }, 'ffprobe failed to get audio duration.');
                         resolveProbe(0);
                         return;
                     }
                     const durationValue = metadata?.format?.duration;
                     if (typeof durationValue === 'number') {
                         logger.info({ duration: durationValue }, `Got duration from ffprobe: ${durationValue} seconds.`);
                         resolveProbe(Math.round(durationValue));
                     } else {
                         logger.warn({ metadata }, 'Could not find duration in ffprobe metadata.');
                         resolveProbe(0);
                     }
                 });
             });
             return duration;
         } catch (error) {
             logger.error({ err: error, file: tempFilePath }, 'Error during ffprobe setup/file write for duration.');
             return 0; // Return 0 on unexpected errors during setup
         } finally {
             try {
                 await fs.unlink(tempFilePath);
                 logger.debug(`Deleted temporary duration probe file: ${tempFilePath}`);
             } catch (cleanupError: any) {
                 if (cleanupError?.code !== 'ENOENT') {
                     logger.error({ err: cleanupError, file: tempFilePath }, 'Failed to delete temporary duration probe file.');
                 }
             }
         }
     }


    /**
     * Encodes an audio buffer to a base64 data URI string.
     * @param buffer The audio buffer.
     * @returns The base64 encoded data URI string.
     */
    encodeToBase64(buffer: Buffer): string {
        const base64String = buffer.toString('base64');
        const dataUri = `data:audio/${AUDIO_FORMAT};base64,${base64String}`;
        this.logger.info(`Encoded audio buffer to base64 data URI (length: ${dataUri.length}).`);
        return dataUri;
    }
}

export function createAudioService(dependencies: AudioServiceDependencies): AudioService {
    return new AudioService(dependencies);
}