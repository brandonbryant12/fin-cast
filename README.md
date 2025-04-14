# RT Stack

A modern & lightweight [turborepo](https://turbo.build/repo/docs) template for fullstack projects with modular components, shared configs, containerised deployments and 100% type-safety.

## Table of Contents

- [About](#about)
  - [Stack Overview](#stack-overview)
  - [Base Functionalities](#base-functionalities)
  - [Inspirations & Goals](#inspirations--goals)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Using an External Database](#using-an-external-database)
- [Developing](#developing)
  - [Working with a Single Package](#working-with-a-single-package)
  - [Adding New Shadcn Components](#adding-new-shadcn-components)
  - [Adding New Better-Auth Plugins](#adding-new-better-auth-plugins)
  - [Tooling Scripts](#tooling-scripts)
- [Containerisation (Docker/Podman)](#containerisation-dockerpodman)
- [Deployment](#deployment)
  - [Using Containers](#using-containers)
  - [Deploying to a Single VM with Docker Compose and Caddy](#deploying-to-a-single-vm-with-docker-compose-and-caddy)
  - [Using Major Platforms](#using-major-platforms)
- [Other Notes](#other-notes)
  - [Tanstack Router](#tanstack-router)
  - [Server API Artificial Delays](#server-api-artificial-delays)
  - [Environment Variables](#environment-variables)

## About

### Stack Overview

The project structure is organized as follows:

```
apps
├─ web
|   ├─ react (vite)
|   ├─ tanstack (router, query, form)
|   └─ tailwindcss
├─ server
|   └─ hono (wrapper for api & auth)
packages
├─ api
|   └─ trpc with valibot
├─ auth
|   └─ better-auth
├─ db
|   └─ drizzle-orm (postgres database)
├─ ui
|   ├─ tailwindcss
|   └─ shadcn & radix ui
tools
├─ eslint
├─ prettier
├─ tailwind
└─ typescript
```

View all catalog dependencies in [pnpm-workspace.yaml](pnpm-workspace.yaml).

### Base Functionalities

The template provides out-of-the-box features:

- Login/register using better-auth email/password credentials provider
- Themes (dark/light mode using next-themes)
- Web/server integration with trpc API (example for creating/listing posts)

A live demo is available at [https://rtstack.nktnet.uk](https://rtstack.nktnet.uk).

### Inspirations & Goals

The RT Stack is inspired by [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo), with key differences:

- Uses Tanstack Router (web) + Hono (server) instead of NextJS
- Implements Better Auth instead of Auth.js
- Uses Valibot for input validation instead of Zod
- Employs Tanstack Form instead of React Hook Form
- Follows Turborepo's recommendations for environment variables

The project aims to consistently adopt the latest releases of dependencies:

- React v19
- Tailwind CSS v4 & Shadcn-UI (canary)
- tRPC v11
- ESLint v9
- pnpm v10

## Quick Start

### Prerequisites

Ensure you have:

1. Node.js (version 22+)
2. pnpm (version 10+)
3. Postgres database (can be run via Docker, Podman, or Supabase)

### Setup

```bash
# Create a repository using the rt-stack template
pnpm dlx create-turbo@latest -m pnpm -e https://github.com/nktnet1/rt-stack YOUR_PROJECT

# Enter the directory
cd YOUR_PROJECT

# Install dependencies
pnpm install

# Copy .env.example to .env for all applications and packages
pnpm env:copy-example

# Start a local postgres instance (e.g., using docker)
docker compose up db --detach

# Push the drizzle schema to your database
pnpm db:push

# Start all applications
pnpm dev
```

Default URLs:
- Web application: http://localhost:8085
- Backend server: http://localhost:3035

### Using an External Database

For external Postgres databases (e.g., Supabase):

1. Modify `SERVER_POSTGRES_URL` in `apps/server/.env`
2. Modify `DB_POSTGRES_URL` in `packages/db/.env`

## Developing

### Working with a Single Package

Use `pnpm --filter=<name>` for package-specific commands:

```bash
# Install a package for the web application
pnpm --filter=web install nuqs

# Format only the UI package
pnpm --filter=@repo/ui format
```

### Adding New Shadcn Components

```bash
# Install a single component (e.g., button)
pnpm ui-add button

# Open interactive component selection
pnpm ui-add
```

### Adding New Better-Auth Plugins

1. Modify auth package server and client files
2. Run schema generation:
   ```bash
   pnpm auth:schema:generate
   ```
3. Format and fix linting
   ```bash
   pnpm format:fix
   pnpm lint:fix
   ```
4. Push new schema to database
   ```bash
   pnpm db:push
   ```

### Tooling Scripts

```bash
pnpm clean                  # Remove all caches and build artifacts
pnpm typecheck              # Report TypeScript issues
pnpm format                 # Report Prettier issues
pnpm format:fix             # Auto-fix Prettier issues
pnpm lint                   # Report ESLint issues
pnpm lint:fix               # Auto-fix ESLint issues
```

## Containerisation (Docker/Podman)

```bash
# Start all applications
docker compose up --build

# Push database schema (in a separate terminal)
docker compose run --build --rm drizzle
pnpm db:push
```

## Deployment

### Using Containers

Deployment options:
- Docker-supported services
- Docker Compose (with reverse proxies)
- Container orchestration platforms
- Self-hostable PaaS like Coolify or Dokploy

### Deploying to a Single VM with Docker Compose and Caddy

The template includes a GitHub Actions workflow for deploying to a single VM using Docker Compose and Caddy.

Key steps:
1. Prepare server with Docker, Git, and Caddy
2. Configure DNS records
3. Set up Caddy configuration
4. Configure GitHub Actions secrets

## Other Notes

### Tanstack Router

Configured in `vite.config.ts` to enable layout-based routing similar to NextJS.

### Server API Artificial Delays

An artificial delay is added in development mode. Can be disabled by removing `timingMiddleware` in `./packages/api/src/server/trpc.ts`.

### Environment Variables

Best practices:
- Each application has a local `.env` file
- Packages are pure and use factory methods
- Environment variables are prefixed (e.g., `SERVER_AUTH_SECRET`)

```bash
# Create .env files from .env.example
pnpm env:copy-example

# Reset .env files
pnpm env:remove
pnpm env:copy-example
```

## Recommended Deployment Approach

Host frontend and backend on the same root domain or subdomains to simplify authentication, especially for browsers like Safari that don't support third-party cookies.