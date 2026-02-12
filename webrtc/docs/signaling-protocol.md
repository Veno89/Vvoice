# Signaling Protocol v1.0.0

All inbound client messages are JSON and validated using Zod discriminated unions.

## Client messages
- `client_hello { protocolVersion, clientId, authToken? }`
- `join_room { roomId, displayName }`
- `leave_room { roomId }`
- `webrtc_offer { toPeerId, sdp }`
- `webrtc_answer { toPeerId, sdp }`
- `webrtc_ice_candidate { toPeerId, candidate }`
- `set_mute { roomId, muted }`
- `ping {}`

## Server events
- `room_joined { roomId, selfPeerId, participants[] }`
- `participant_joined { roomId, peerId, displayName, muted }`
- `participant_left { roomId, peerId }`
- `participant_muted { roomId, peerId, muted }`
- `webrtc_offer|webrtc_answer|webrtc_ice_candidate` (forwarded)
- `signal_error { code, message }`
- `server_notice { message }`
- `pong { ts }`

## Security constraints
- Protocol mismatch rejected
- Unauthenticated messages rejected until `client_hello`
- WS rate limits enforced
- SDP/candidate values redacted in logs
