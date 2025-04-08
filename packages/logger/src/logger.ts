import pino from "pino";
import type { LoggerConfig, AppLogger, LogLevel } from "./types";

const DEFAULT_LOG_LEVEL: LogLevel = "info";

/**
 * Creates a new logger instance based on the provided configuration.
 *
 * @param config Logger configuration options.
 * @returns An AppLogger instance.
 */
export function createLogger(config: LoggerConfig = {}): AppLogger {
  const logLevel = config.level ?? DEFAULT_LOG_LEVEL;
  const serviceName = config.serviceName;
  const enablePrettyPrint = config.prettyPrint === true;

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

  return logger as AppLogger;
} 