import pino from "pino";
import type { LoggerConfig, AppLogger, LogLevel } from "./types";

const DEFAULT_LOG_LEVEL: LogLevel = "info";
const DEFAULT_PRETTY_PRINT = false;

/**
 * Creates a new logger instance based on the provided configuration.
 *
 * @param config Logger configuration options provided by the consuming application.
 * @returns An AppLogger instance.
 */
export function createLogger(config: LoggerConfig = {}): AppLogger {
  const logLevel = config.level ?? DEFAULT_LOG_LEVEL;
  const serviceName = config.serviceName; // Can be undefined
  const enablePrettyPrint = config.prettyPrint ?? DEFAULT_PRETTY_PRINT;

  const options: pino.LoggerOptions = {
    level: logLevel,
    ...(serviceName && { name: serviceName }),
    ...(enablePrettyPrint && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    }),
  };

  const logger = pino(options);

  // Cast to AppLogger to allow for potential future extensions
  return logger as AppLogger;
} 