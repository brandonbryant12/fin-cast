import type { pino } from "pino";

/**
 * Defines standard log levels.
 */
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

/**
 * Configuration options for creating a logger instance.
 * This should be passed from the consuming application.
 */
export interface LoggerConfig {
  /**
   * The minimum log level to output.
   * @default 'info'
   */
  level?: LogLevel;

  /**
   * Enable human-readable pretty printing. Recommended for development only.
   * The consuming application should set this explicitly based on its environment (e.g., NODE_ENV).
   * Requires 'pino-pretty' to be installed as a dev dependency in the consuming app.
   * @default false
   */
  prettyPrint?: boolean;

  /**
   * Optional service name to include in logs. Helps identify the source.
   * @example 'web-server', 'api-service'
   */
  serviceName?: string;

  // Future considerations:
  // destination?: string | WritableStream; // Output destination
  // redact?: string[] | pino.RedactionOptions; // Paths to redact
}

/**
 * Interface for the logger instance returned by createLogger.
 * Extends pino's logger interface for familiarity.
 */
export interface AppLogger extends pino.Logger {
  // We can add custom methods here later if needed,
  // but for now, inheriting pino's methods is sufficient.
  // e.g., audit(details: object, message: string): void;
} 