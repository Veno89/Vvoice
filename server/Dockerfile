FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Copy migrations to build output
COPY src/db/migrations ./dist/db/migrations

FROM node:20-alpine AS runner

WORKDIR /app

# Copy built code and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p data

EXPOSE 3000

CMD ["node", "dist/index.js"]
