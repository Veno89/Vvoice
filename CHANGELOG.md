# Changelog

All notable changes to this project will be documented in this file.

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
- New Node.js `webrtc/signaling-server` for WebSocket-based signaling and simple auth.
- Chat support via WebRTC signaling protocol (`chat_message` type).
