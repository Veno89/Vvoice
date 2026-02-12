# Vvoice WebRTC Parallel Engine

This directory contains an isolated WebRTC voice engine built in parallel to the existing desktop/Mumble integration.

## Scope guardrails
- No changes to existing desktop voice path
- No changes to Mumble/Murmur integration
- All new work isolated under `/webrtc`

## Structure
- `signaling-server/` — Fastify + WS signaling backend
- `client-web-demo/` — browser audio demo client
- `infra/coturn/` — TURN server compose and config
- `docs/` — architecture, protocol, threat model, testing, replacement plan

## Quick start
1. Start TURN:
   ```bash
   cd webrtc/infra/coturn && docker compose up -d
   ```
2. Start signaling server:
   ```bash
   cd webrtc/signaling-server && npm install && npm run dev
   ```
3. Start web demo:
   ```bash
   cd webrtc/client-web-demo && npm install && npm run dev
   ```
4. Open two browser tabs, join the same room with different names.

## Milestones
- ✅ Milestone 1: signaling skeleton, protocol validation, auth dev endpoint, room model
- ✅ Milestone 2: browser demo with room join, signaling, audio, reconnect/rejoin
