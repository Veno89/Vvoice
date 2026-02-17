# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-17

### Added
- **Administration:**
    - New Role-Based Access Control (RBAC): Users are now 'member' or 'admin'.
    - Admin API endpoints: `POST /api/admin/kick` and `POST /api/admin/ban`.
    - Persistent Bans: Banned users are flagged in the database and blocked from logging in.
- **Chat Persistence:**
    - Chat history is now saved to the SQLite database.
    - Users receive the last 50 messages upon joining a room.
- **DevOps:**
    - Docker support: Added multi-stage `Dockerfile` and `docker-compose.yml`.
    - Environment Configuration: Centralized config using `.env` (via `dotenv`).

### Changed
- **Protocol:** Updated Handshake and `ParticipantView` to include user roles.
- **UI:** Added Administrator badges to user tooltips.

## [Unreleased] - 2026-02-13

### Changed
- Migrated voice communication from legacy Mumble protocol to WebRTC.
- Refactored `client` to use `SignalingClient` and `WebRTCManager` for voice/chat.
- Updated `useVoiceStore` to fully manage state via WebRTC signaling.
- Replaced Rust backend audio engine with WebRTC browser APIs.
- Implemented global Push-to-Talk (PTT) using Tauri events in a lightweight Rust shell.
- **Project Structure**: Renamed `webrtc/signaling-server` to `server/`, moved docs to `docs/webrtc`, and demos to `examples/`.

### Removed
- Legacy Rust backend (`backend/` directory) including Mumble server logic and database migrations.
- Legacy Protocol Buffers (`proto/` directory).
- Legacy Murmur server (`murmur/` directory).
- `cpal`, `opus`, and `prost` dependencies from `client/src-tauri`.
- Unused `mumble.ts` type definitions.

### Added
- New Node.js `server` (Signaling Server) for WebSocket-based signaling and simple auth.
- Chat support via WebRTC signaling protocol (`chat_message` type).

---

## [Legacy Alpha] - 2026-02-10

### Added
- **Backend Server:** Full rewrite of `backend` from a bot client to a dedicated Rust TCP Server.
    - Implements Mumble Protocol Handshake (Version, Authenticate, ServerSync).
    - Supports multiple concurrent client connections.
    - **TLS Encryption:** Secure communication using `rustls` and self-signed certificates.
    - **PostgreSQL Integration:** `sqlx` setup for user authentication (currently placeholder) and data persistence.
    - **Voice Routing:** Server now forwards Opus voice packets between connected clients.
    - **Echo Mode:** Implemented `/echo` command for loopback testing.

- **Client (Tauri):**
    - **Audio Engine:** Integrated `cpal` for audio input/output and `opus` for encoding/decoding.
    - **Voice Playback:** Implemented jitter buffer and playback thread to hear other users.
    - **Echo Test:** Added UI button to toggle server-side loopback.
    - **Real-time State:** `App.tsx` now listens for `user_update` and `user_remove` events from the backend to update the UI grid dynamically.

### Changed
- Refactored `client/src-tauri/src/mumble.rs` to handle full duplex voice (Capture -> Encode -> Send -> Receive -> Decode -> Playback).
- Fixed race condition in client startup where audio stream blocked handshake.
- Updated `task.md` to reflect progress on Backend MVP and Client Voice features.

### Fixed
- Resolved `cpal` buffer underflow/overflow issues by implementing a simple `VecDeque` jitter buffer.
- Fixed `String` vs `Option<String>` type mismatch in Protobuf handling.
