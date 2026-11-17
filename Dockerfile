# StockPilot Primary Backend Service
# Production container for Node.js Express & static web frontend

FROM node:20-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Install wget for health monitoring probe
RUN apk add --no-cache wget

# Run as non-privileged service user
RUN addgroup -S stockpilot && adduser -S stockpilot -G stockpilot

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY sql/ ./sql/

RUN chown -R stockpilot:stockpilot /app

USER stockpilot

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
