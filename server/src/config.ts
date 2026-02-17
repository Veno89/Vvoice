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
  // Database
  dbPath: string;
  // TURN relay
  turnEnabled: boolean;
  turnHost: string;
  turnPort: number;
  turnSecret: string;
  turnTtlSeconds: number;
}

function getJwtSecret(): string {
  const secret = process.env.WEBRTC_DEV_JWT_SECRET;
  const isDev = (process.env.NODE_ENV ?? 'development') === 'development';

  if (secret) return secret;

  if (isDev) {
    console.warn('[config] ⚠ No WEBRTC_DEV_JWT_SECRET set — using insecure dev fallback.');
    return 'vvoice-webrtc-dev-secret-DO-NOT-USE-IN-PROD';
  }

  console.error('[config] FATAL: WEBRTC_DEV_JWT_SECRET env var is required in production.');
  process.exit(1);
}

export const config: ServerConfig = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: getJwtSecret(),
  protocolVersion: '1.0.0',
  maxRoomParticipants: Number(process.env.MAX_ROOM_PARTICIPANTS ?? 8),
  maxRoomsPerConnection: Number(process.env.MAX_ROOMS_PER_CONNECTION ?? 2),
  wsMessageBurst: Number(process.env.WS_MESSAGE_BURST ?? 60),
  wsMessageWindowMs: Number(process.env.WS_MESSAGE_WINDOW_MS ?? 10_000),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map(s => s.trim()),
  dbPath: process.env.DB_PATH ?? 'data/vvoice.db',
  turnEnabled: !!process.env.TURN_HOST,
  turnHost: process.env.TURN_HOST ?? 'localhost',
  turnPort: Number(process.env.TURN_PORT ?? 3478),
  turnSecret: process.env.TURN_SECRET ?? 'dev-turn-secret-change-me',
  turnTtlSeconds: Number(process.env.TURN_TTL ?? 86400),
};

