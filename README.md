# Vvoice

A modern, high-performance voice chat application built with **WebRTC** (Voice) and **Rust/Tauri** (Desktop Client).

## Features

-   **High Quality Voice:** WebRTC-based audio with Opus codec, echo cancellation, and noise suppression.
-   **Low Latency:** Direct peer-to-peer or server-relayed streams via SFU/Signaling.
-   **Secure:** WSS (WebSocket Secure) and DTLS-SRTP encryption.
-   **Cross-Platform:** Runs on Windows, Linux, and macOS.
-   **Modern Stack:** React + TypeScript Frontend, Node.js Signaling Server, lightweight Rust Host.

## Project Structure

-   **`client/`**: The Vvoice Desktop Client.
    -   **Frontend (`src/`)**: React + TypeScript + Zustand + WebRTC logic.
    -   **Backend (`src-tauri/`)**: Lightweight Rust shell for OS integration (Global PTT, Tray, etc).
-   **`webrtc/signaling-server/`**: The Node.js Signaling Server.
    -   Handles WebSocket connections, room management, and signaling exchange.

## Getting Started

### Prerequisites

-   **Node.js:** v18+ and `npm`.
-   **Rust:** Latest stable toolchain (`rustup`) - for building Desktop client.

### 1. Signaling Server Setup

```bash
cd webrtc/signaling-server
npm install
npm run dev
# Server runs on localhost:3000
```

### 2. Client Setup

**Browser Mode (Recommended for dev):**
```bash
cd client
npm install
npm run dev
# Open http://localhost:1420
```

**Desktop Mode:**
```bash
cd client
npm run tauri dev
```

## License

MIT
