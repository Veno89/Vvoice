import fastify from 'fastify';
import { registerWebSocketServer } from '../src/ws/server';
import { ServerConfig } from '../src/config';
import { signToken } from '../src/security/auth';

export async function createTestServer() {
    const app = fastify();

    // Mock config
    const config: ServerConfig = {
        host: '0.0.0.0',
        protocolVersion: '1.0.0',
        port: 0, // Random port
        jwtSecret: 'test-secret',
        maxRoomParticipants: 10,
        maxRoomsPerConnection: 5,
        wsMessageBurst: 10,
        wsMessageWindowMs: 1000,
        corsOrigins: ['*'],
        dbPath: ':memory:', // Use in-memory DB for integration tests
        turnEnabled: false,
        turnHost: 'localhost',
        turnPort: 3478,
        turnSecret: 'secret',
        turnTtlSeconds: 86400
    };

    registerWebSocketServer(app, config);

    await app.listen({ port: 0 });
    const address = app.server.address();
    const port = typeof address === 'string' ? 0 : address?.port;

    return {
        app,
        port,
        makeToken: (name: string) => signToken(config.jwtSecret, `test-user-${name}`, name),
        close: async () => await app.close()
    };
}
