import { createLogger, type AppLogger, type LoggerConfig, type LogLevel } from "@repo/logger";

const logLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
const isDevelopment = process.env.NODE_ENV === "development";

const loggerConfig: LoggerConfig = {
  level: logLevel,
  prettyPrint: isDevelopment,
  serviceName: "api-package",
};

export const logger: AppLogger = createLogger(loggerConfig); 