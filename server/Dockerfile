FROM node:20-alpine AS builder

WORKDIR /app

COPY server/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

COPY server/. .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

# Copy built code and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p data && chown -R 1000:1000 /app

EXPOSE 3000

CMD ["node", "dist/index.js"]
