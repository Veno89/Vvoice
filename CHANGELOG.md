# Changelog

All notable changes to the Vvoice project will be documented in this file.

## [Unreleased] - 2026-02-10

### Added

-   **Backend Server:** Full rewrite of `backend` from a bot client to a dedicated Rust TCP Server.
    -   Implements Mumble Protocol Handshake (Version, Authenticate, ServerSync).
    -   Supports multiple concurrent client connections.
    -   **TLS Encryption:** Secure communication using `rustls` and self-signed certificates.
    -   **PostgreSQL Integration:** `sqlx` setup for user authentication (currently placeholder) and data persistence.
    -   **Voice Routing:** Server now forwards Opus voice packets between connected clients.
    -   **Echo Mode:** Implemented `/echo` command for loopback testing.

-   **Client (Tauri):**
    -   **Audio Engine:** Integrated `cpal` for audio input/output and `opus` for encoding/decoding.
    -   **Voice Playback:** Implemented jitter buffer and playback thread to hear other users.
    -   **Echo Test:** Added UI button to toggle server-side loopback.
    -   **Real-time State:** `App.tsx` now listens for `user_update` and `user_remove` events from the backend to update the UI grid dynamically.

### Changed

-   Refactored `client/src-tauri/src/mumble.rs` to handle full duplex voice (Capture -> Encode -> Send -> Receive -> Decode -> Playback).
-   Fixed race condition in client startup where audio stream blocked handshake.
-   Updated `task.md` to reflect progress on Backend MVP and Client Voice features.

### Fixed

-   Resolved `cpal` buffer underflow/overflow issues by implementing a simple `VecDeque` jitter buffer.
-   Fixed `String` vs `Option<String>` type mismatch in Protobuf handling.
