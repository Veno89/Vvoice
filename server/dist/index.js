import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { registerApiRoutes } from './api/routes.js';
import { registerProfileRoutes } from './api/profile-routes.js';
import { applyHttpRateLimit } from './security/http-rate-limit.js';
import { registerWebSocketServer } from './ws/server.js';
import { log } from './utils/log.js';
import { initDatabase, closeDatabase } from './db/database.js';
import { RoomManager } from './domain/room-manager.js';
import { ChannelManager } from './domain/channel-manager.js';
async function main() {
    // Initialize database (runs migrations)
    initDatabase(config.dbPath);
    log.info({ dbPath: config.dbPath }, 'Database initialized');
    // Initialize Managers & State
    const roomManager = new RoomManager(config.maxRoomParticipants, config.maxRoomsPerConnection);
    const channelManager = new ChannelManager();
    const connections = new Map();
    const byPeerId = new Map();
    const app = Fastify({ logger: true });
    // CORS
    await app.register(cors, {
        origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
        methods: ['GET', 'POST', 'PATCH'],
    });
    app.addHook('onRequest', applyHttpRateLimit);
    await registerApiRoutes(app, config, connections);
    await registerProfileRoutes(app, config);
    registerWebSocketServer(app, config, roomManager, channelManager, connections, byPeerId);
    await app.listen({ port: config.port, host: config.host });
    console.log(`Signaling server running at http://${config.host}:${config.port}`);
    // Graceful shutdown
    const shutdown = async (signal) => {
        log.info(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        closeDatabase();
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
main().catch((error) => {
    console.error('Failed to start signaling server:', error);
    process.exit(1);
});
