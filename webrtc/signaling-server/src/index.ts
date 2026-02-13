import Fastify from 'fastify';
import { config } from './config.js';
import { registerApiRoutes } from './api/routes.js';
import { applyHttpRateLimit } from './security/http-rate-limit.js';
import { registerWebSocketServer } from './ws/server.js';
import { log } from './utils/log.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: log });
  // const app = Fastify();

  app.addHook('onRequest', applyHttpRateLimit);

  await registerApiRoutes(app, config);
  registerWebSocketServer(app, config);

  await app.listen({ port: config.port, host: config.host });
  console.log(`Signaling server running at http://${config.host}:${config.port}`);
}

main().catch((error) => {
  console.error('Failed to start signaling server:', error);
  process.exit(1);
});
