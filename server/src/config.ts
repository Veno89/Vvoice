export interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
  protocolVersion: string;
  maxRoomParticipants: number;
  maxRoomsPerConnection: number;
  wsMessageBurst: number;
  wsMessageWindowMs: number;
  corsOrigins: string[];
  nodeEnv: string;
  isDevelopment: boolean;
  allowDevAuth: boolean;
  // Database
  dbPath: string;
  // TURN relay
  turnEnabled: boolean;
  turnHost: string;
  turnPort: number;
  turnSecret: string;
  turnTtlSeconds: number;
}

function getNodeEnv(): string {
  return process.env.NODE_ENV ?? 'development';
}

function getJwtSecret(nodeEnv: string): string {
  const secret = process.env.WEBRTC_DEV_JWT_SECRET;
  const isDevelopment = nodeEnv === 'development';

  if (secret) return secret;

  if (isDevelopment) {
    console.warn('[config] ⚠ No WEBRTC_DEV_JWT_SECRET set — using insecure dev fallback.');
    return 'vvoice-webrtc-dev-secret-DO-NOT-USE-IN-PROD';
  }

  console.error('[config] FATAL: WEBRTC_DEV_JWT_SECRET env var is required outside development.');
  process.exit(1);
}

function getTurnSecret(nodeEnv: string, turnEnabled: boolean): string {
  const secret = process.env.TURN_SECRET;
  const fallback = 'dev-turn-secret-change-me';

  if (!turnEnabled) return secret ?? fallback;
  if (secret) return secret;

  if (nodeEnv === 'development') {
    console.warn('[config] ⚠ TURN is enabled but TURN_SECRET is not set — using insecure dev fallback.');
    return fallback;
  }

  console.error('[config] FATAL: TURN_SECRET must be set when TURN is enabled outside development.');
  process.exit(1);
}

const nodeEnv = getNodeEnv();
const isDevelopment = nodeEnv === 'development';
const turnEnabled = !!process.env.TURN_HOST;

export const config: ServerConfig = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: getJwtSecret(nodeEnv),
  protocolVersion: '1.0.0',
  maxRoomParticipants: Number(process.env.MAX_ROOM_PARTICIPANTS ?? 8),
  maxRoomsPerConnection: Number(process.env.MAX_ROOMS_PER_CONNECTION ?? 2),
  wsMessageBurst: Number(process.env.WS_MESSAGE_BURST ?? 60),
  wsMessageWindowMs: Number(process.env.WS_MESSAGE_WINDOW_MS ?? 10_000),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map(s => s.trim()),
  nodeEnv,
  isDevelopment,
  allowDevAuth: process.env.ENABLE_DEV_AUTH === 'true',
  dbPath: process.env.DB_PATH ?? 'data/vvoice.db',
  turnEnabled,
  turnHost: process.env.TURN_HOST ?? 'localhost',
  turnPort: Number(process.env.TURN_PORT ?? 3478),
  turnSecret: getTurnSecret(nodeEnv, turnEnabled),
  turnTtlSeconds: Number(process.env.TURN_TTL ?? 86400),
};
