// Define the common interface for Text-to-Speech services

/**
 * Options for TTS synthesis.
 * Specific providers might extend this with their own options.
 */
export interface TtsOptions {
  /**
   * The voice model to use (provider-specific).
   */
  voice?: string;
  /**
   * The desired output format (e.g., 'mp3', 'opus', 'aac', 'flac').
   * Defaults typically to 'mp3'.
   */
  format?: 'mp3' | 'opus' | 'aac' | 'flac';
  /**
   * The speed of the speech (e.g., 0.25 to 4.0). 
   * 1.0 is the default speed.
   */
  speed?: number;
}

/**
 * Represents information about an available TTS voice.
 */
export interface VoiceInfo {
  /**
   * Unique identifier for the voice (provider-specific).
   */
  id: string;
  /**
   * Human-readable name for the voice.
   */
  name: string;
  // Potentially add other fields like gender, language, description later
}

/**
 * Interface for a Text-to-Speech service.
 */
export interface ITtsService {
  /**
   * Synthesizes text into speech.
   *
   * @param text The text content to synthesize.
   * @param options Optional configuration for the synthesis.
   * @returns A Promise resolving to a Buffer containing the audio data.
   */
  synthesize(text: string, options?: TtsOptions): Promise<Buffer>;

  /**
   * Retrieves a list of available voices for the provider.
   *
   * @returns A Promise resolving to an array of VoiceInfo objects.
   */
  getVoices(): Promise<VoiceInfo[]>;
}

/**
 * Configuration for creating a TTS service instance.
 */
export interface TtsFactoryConfig {
  /**
   * The desired TTS provider.
   * Currently only 'openai' is supported.
   */
  provider: 'openai' // Add other providers like | 'google' | 'aws' later

  /**
   * Provider-specific options.
   * For OpenAI, this could include apiKey, model, etc.
   * TODO: Define a more specific type that maps provider names to their option types.
   */
  providerOptions?: Record<string, any>;
} 