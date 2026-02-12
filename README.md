# Vvoice

A modern, high-performance voice chat application built with Rust (Backend) and Tauri/React (Frontend).

## Features

-   **Low Latency Voice:** Uses UDP for real-time voice transmission (Mumble Protocol compatible).
-   **Secure:** TLS encryption for control channel.
-   **Audio Engine:** High-quality Opus codec, jitter buffer, and VAD (Voice Activity Detection).
-   **Cross-Platform:** Runs on Windows, Linux, and macOS.
-   **Scalable Backend:** Rust `tokio` based server handling thousands of concurrent connections.

## Project Structure (A+ Architecture)

This project follows SOLID principles and Clean Architecture:

-   **`backend/`**: The Vvoice Server (Rust).
    -   `codec.rs`: Shared protobuf codec logic.
    -   `handler.rs`: Connection lifecycle management.
    -   `voice_service.rs` / `chat_service.rs`: Domain logic.
-   **`client/`**: The Vvoice Desktop Client.
    -   **Frontend (`src/`)**: React + TypeScript + Zustand (State Management).
    -   **Backend (`src-tauri/`)**: Rust core.
        -   `audio.rs`: Dedicated audio engine (CPAL + Opus) running on separate threads.
        -   `mumble.rs`: Network protocol handler.
        -   `lib.rs`: Tauri command interface.

## Getting Started

### Prerequisites

-   **Rust:** Latest stable toolchain (`rustup`).
-   **Node.js:** v18+ and `npm`.
-   **PostgreSQL:** Database server running locally.

### 1. Backend Server Setup

```bash
cd backend
# Create .env with DATABASE_URL=postgres://user:password@localhost/vvoice_db
cargo run
```

### 2. Client Setup

```bash
cd client
npm install
npm run tauri dev
```

### 3. Build for Release

```bash
cd client
npm run tauri build
```

## License

MIT
