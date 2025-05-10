# Logger Package (`@repo/logger`)

Provides a centralized, structured logging solution for the monorepo based on Pino.

## Features

- Structured JSON logging by default.
- Configurable log levels.
- Optional pretty-printing for development (`pino-pretty` transport).
- Type-safe configuration and usage.
- Strictly prevents direct `process.env` access within the package.

## Installation

This package is part of the monorepo. Ensure `pino` is installed in the root or relevant app. If using `prettyPrint`, ensure `pino-pretty` is installed as a dev dependency in the **consuming application's** `package.json`.


## Usage

**1. Configure and Create Logger (in consuming app, e.g., `apps/server/src/config/logger.ts`)**

```typescript
import { createLogger, AppLogger, LoggerConfig } from "@repo/logger";
import { env } from "../env";

const loggerConfig: LoggerConfig = {
  level: env.LOG_LEVEL,
  prettyPrint: env.NODE_ENV === "development",
  serviceName: "my-server-app",
};

export const logger: AppLogger = createLogger(loggerConfig);
```

## Configuration Options (`LoggerConfig`)

- `level`: (Optional) Minimum log level (`'fatal'`, `'error'`, `'warn'`, `'info'`, `'debug'`, `'trace'`, `'silent'`). Default: `'info'`.
- `prettyPrint`: (Optional) Enable pretty printing for development. Default: `false`. **Requires `pino-pretty` dev dependency in the consuming app.**
- `serviceName`: (Optional) String identifier for the service emitting the logs (e.g., `'web'`, `'api'`). 