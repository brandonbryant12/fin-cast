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
   * @default 'info' (Handled in createLogger if not provided)
   */
  level?: LogLevel;

  /**
   * Enable human-readable pretty printing. Recommended for development only.
   * Requires 'pino-pretty' to be installed as a dev dependency in the consuming app.
   * @default false (Handled in createLogger if not provided)
   */
  prettyPrint?: boolean;

  /**
   * Optional service name to include in logs. Helps identify the source.
   * @example 'web-server', 'api-service'
   */
  serviceName?: string;
}

/**
 * Interface for the logger instance returned by createLogger.
 * Extends pino's logger interface for familiarity.
 */
export interface AppLogger extends pino.Logger {
} 