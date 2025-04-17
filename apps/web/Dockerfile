# Updated Dockerfile for web app
# ----------------------------------------------------------------------------
# 1. Base stage – install pnpm and common ENV vars
# ----------------------------------------------------------------------------
  FROM node:22-alpine AS base

  WORKDIR /app
  
  ENV NODE_ENV=production \
      TURBO_TELEMETRY_DISABLED=1 \
      PNPM_HOME="/pnpm" \
      PATH="$PNPM_HOME:$PATH" \
      CI=1
  
  RUN corepack enable pnpm
  
  # ----------------------------------------------------------------------------
  # 2. Builder stage – runs turbo prune (needs source + PUBLIC_SERVER_URL)
  # ----------------------------------------------------------------------------
  FROM base AS builder
  
  # ---- New lines -------------------------------------------------------------
  # Accept backend url at *build* time too, so TS builds that read process.env
  # don’t fail when the variable is undefined.
  ARG PUBLIC_SERVER_URL
  ENV PUBLIC_SERVER_URL=${PUBLIC_SERVER_URL}
  # ---------------------------------------------------------------------------
  
  RUN pnpm install --global turbo@^2
  
  COPY . .
  # https://turbo.build/repo/docs/guides/tools/docker#the-solution
  RUN turbo prune web --docker
  
  # ----------------------------------------------------------------------------
  # 3. Installer stage – install deps & build final assets
  # ----------------------------------------------------------------------------
  FROM base AS installer
  
  ARG PUBLIC_SERVER_URL
  ENV PUBLIC_SERVER_URL=${PUBLIC_SERVER_URL}
  
  COPY --from=builder /app/out/json/ .
  RUN pnpm install --frozen-lockfile
  
  COPY --from=builder /app/out/full/ .
  RUN pnpm build
  
  # ----------------------------------------------------------------------------
  # 4. Production stage – Nginx serving static files
  # ----------------------------------------------------------------------------
  FROM nginx:stable-alpine AS production
  
  WORKDIR /app
  
  COPY apps/web/nginx.conf /etc/nginx/nginx.conf
  COPY --from=installer /app/apps/web/dist /usr/share/nginx/html
  
  HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl --fail --silent http://0.0.0.0:80/healthcheck || exit 1
  
  CMD ["nginx", "-g", "daemon off;"]
  