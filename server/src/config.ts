export interface ServerConfig {
  port: number;
  host: string;
  jwtSecret: string;
  protocolVersion: string;
  maxRoomParticipants: number;
  maxRoomsPerConnection: number;
  wsMessageBurst: number;
  wsMessageWindowMs: number;
}

export const config: ServerConfig = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.WEBRTC_DEV_JWT_SECRET ?? 'vvoice-webrtc-dev-secret-change-me',
  protocolVersion: '1.0.0',
  maxRoomParticipants: Number(process.env.MAX_ROOM_PARTICIPANTS ?? 8),
  maxRoomsPerConnection: Number(process.env.MAX_ROOMS_PER_CONNECTION ?? 2),
  wsMessageBurst: Number(process.env.WS_MESSAGE_BURST ?? 60),
  wsMessageWindowMs: Number(process.env.WS_MESSAGE_WINDOW_MS ?? 10_000)
};
