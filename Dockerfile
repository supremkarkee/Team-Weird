# ==========================================
# Hardened Multi-Stage Container Image
# CMP-X306 Secure Software Development
# ==========================================

FROM node:20-alpine

# Set non-root environment & production settings
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install security patches & curl for healthcheck
RUN apk --no-cache upgrade && \
    apk --no-cache add curl

# Copy dependency manifests first for cached layer installation
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source code
COPY --chown=node:node . .

# Switch to unprivileged 'node' user (Principle of Least Privilege - PoLP)
USER node

# Expose only application port
EXPOSE 3000

# Docker healthcheck probe against the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default execution entrypoint
CMD ["node", "index.js"]
