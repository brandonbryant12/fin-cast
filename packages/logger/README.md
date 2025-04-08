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

```bash
# In the consuming app (e.g., apps/server)
pnpm add -D pino-pretty
# or
yarn add -D pino-pretty
# or
npm install -D pino-pretty
```

## Usage

**1. Configure and Create Logger (in consuming app, e.g., `apps/server/src/config/logger.ts`)**

```typescript
import { createLogger, AppLogger, LoggerConfig } from "@repo/logger";
import { env } from "../env"; // Assuming env validation happens here

const loggerConfig: LoggerConfig = {
  level: env.LOG_LEVEL, // Assuming LOG_LEVEL is validated in env.ts (e.g., 'debug', 'info')
  prettyPrint: env.NODE_ENV === "development", // Enable in dev, disable in prod/test
  serviceName: "my-server-app",
};

export const logger: AppLogger = createLogger(loggerConfig);
```

**2. Use the Logger**

```typescript
import { logger } from "./config/logger"; // Import the configured instance

logger.info("Server started successfully.");

function processRequest(requestId: string, userId: string) {
  logger.debug({ requestId, userId }, "Processing request");
  try {
    // ... processing logic ...
    const someCondition = Math.random() > 0.8;
    if (someCondition) {
      logger.warn({ requestId, userId, reason: "Condition met" }, "Potential issue detected");
    }
    logger.info({ requestId, userId }, "Request processed successfully");
  } catch (error: unknown) {
    logger.error(
      {
        requestId,
        userId,
        // Log the error object directly if possible, otherwise its string representation
        err: error instanceof Error ? error : String(error),
      },
      "Failed to process request"
    );
  }
}

processRequest("req-123", "user-456");
```

## Configuration Options (`LoggerConfig`)

- `level`: (Optional) Minimum log level (`'fatal'`, `'error'`, `'warn'`, `'info'`, `'debug'`, `'trace'`, `'silent'`). Default: `'info'`.
- `prettyPrint`: (Optional) Enable pretty printing for development. Default: `false`. **Requires `pino-pretty` dev dependency in the consuming app.**
- `serviceName`: (Optional) String identifier for the service emitting the logs (e.g., `'web'`, `'api'`). 