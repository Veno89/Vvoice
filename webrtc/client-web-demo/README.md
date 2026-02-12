# WebRTC Client Web Demo (Milestone 2)

Browser demo that connects to the isolated WebRTC signaling server and establishes peer-to-peer audio between participants in the same room.

## Features
- Join/leave room
- Microphone selection
- Mute/unmute local track
- Participant list and mute state updates
- WebRTC offer/answer/ICE signaling via WebSocket
- Reconnect + automatic rejoin
- Connection status and debug logs

## Run
```bash
npm install
npm run dev
```

Defaults:
- API base URL: `http://localhost:8080`
- WS URL: `ws://localhost:8080/ws`

Open two tabs, use different display names, join same room, and verify two-way audio.

## ICE server notes
- Client includes default public STUN server for local testing.
- TURN example URL is included and should be aligned with your coturn credentials for relay tests.
