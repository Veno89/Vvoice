# WebRTC Parallel Architecture

## Components
- **Signaling server** (`webrtc/signaling-server`)
  - Fastify REST + WebSocket endpoint
  - Zod message validation
  - Domain room manager (transport-agnostic)
- **Web demo client** (`webrtc/client-web-demo`)
  - Browser-native WebRTC wrapper (planned in Milestone 2)
- **TURN infrastructure** (`webrtc/infra/coturn`)
  - Dockerized coturn config for NAT traversal

## Boundaries
- Domain logic under `src/domain` contains no WebSocket implementation types.
- Protocol definitions are centralized under `src/types/protocol.ts`.
- Security concerns split into auth and rate-limiter modules.
