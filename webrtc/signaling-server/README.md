# WebRTC Signaling Server (Milestone 1)

Parallel WebRTC signaling service for Vvoice. This service is isolated under `/webrtc` and does not modify the existing desktop/Mumble voice path.

## Features (MVP milestone 1)
- Fastify REST API
  - `GET /health`
  - `POST /auth/dev` -> issues dev JWT
- WebSocket signaling endpoint at `/ws`
- Zod validation for all inbound signaling messages
- Room join/leave and participant presence broadcasting
- Offer/answer/ICE relay between peers
- Basic abuse controls
  - HTTP rate limiting
  - WS message burst limiting
  - max rooms per connection
  - max participants per room
- Structured logging (pino) with SDP/candidate redaction

## Run
```bash
npm install
npm run dev
```

Server env vars:
- `PORT` (default: `8080`)
- `WEBRTC_DEV_JWT_SECRET` (default dev secret)
- `MAX_ROOM_PARTICIPANTS` (default: `8`)
- `MAX_ROOMS_PER_CONNECTION` (default: `2`)

## Protocol messages
Client -> server:
- `client_hello`
- `join_room`
- `leave_room`
- `webrtc_offer`
- `webrtc_answer`
- `webrtc_ice_candidate`
- `set_mute`
- `ping`

Server -> client:
- `room_joined`
- `participant_joined`
- `participant_left`
- `participant_muted`
- `webrtc_offer`
- `webrtc_answer`
- `webrtc_ice_candidate`
- `signal_error`
- `server_notice`
- `pong`

See `/webrtc/docs/signaling-protocol.md` for full schema details.
