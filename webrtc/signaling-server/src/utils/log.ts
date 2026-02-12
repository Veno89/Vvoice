import pino from 'pino';

const redactPaths = ['msg.sdp', 'msg.candidate', 'payload.sdp', 'payload.candidate'];

export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: redactPaths,
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});
