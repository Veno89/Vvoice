import Fastify from 'fastify';
import { config } from './config.js';
import { registerApiRoutes } from './api/routes.js';
import { applyHttpRateLimit } from './security/http-rate-limit.js';
import { registerWebSocketServer } from './ws/server.js';
import { log } from './utils/log.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: log });

  app.addHook('onRequest', applyHttpRateLimit);

  await registerApiRoutes(app, config);
  registerWebSocketServer(app, config);

  await app.listen({ port: config.port, host: config.host });
  log.info({ port: config.port }, 'webrtc signaling server started');
}

main().catch((error) => {
  log.error({ err: error }, 'failed to start signaling server');
  process.exit(1);
});
