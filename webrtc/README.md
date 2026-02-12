# Vvoice WebRTC Parallel Engine

This directory contains an isolated WebRTC voice engine built in parallel to the existing desktop/Mumble integration.

## Scope guardrails
- No changes to existing desktop voice path
- No changes to Mumble/Murmur integration
- All new work isolated under `/webrtc`

## Structure
- `signaling-server/` — Fastify + WS signaling backend (Milestone 1 complete)
- `client-web-demo/` — browser demo client scaffold (Milestone 2 pending)
- `infra/coturn/` — TURN server compose and config
- `docs/` — architecture, protocol, threat model, testing, replacement plan

## Quick start (Milestone 1)
1. Start TURN:
   ```bash
   cd webrtc/infra/coturn && docker compose up -d
   ```
2. Start signaling server:
   ```bash
   cd webrtc/signaling-server && npm install && npm run dev
   ```

## Milestones
- ✅ Milestone 1: signaling skeleton, protocol validation, auth dev endpoint, room model
- ⏳ Milestone 2: full browser audio demo with peer connections
