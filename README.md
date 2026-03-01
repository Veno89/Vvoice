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
-   **`server/`**: The Node.js Signaling Server.
    -   Handles WebSocket connections, room management, and signaling exchange.
-   **`examples/`**: Demo applications (e.g., Web Client Demo).
-   **`docs/`**: Project documentation.

## Getting Started

### Prerequisites

-   **Node.js:** v18+ and `npm`.
-   **Rust:** Latest stable toolchain (`rustup`) - for building Desktop client.

### 1. Signaling + TURN (Docker, cross-network ready)

```bash
docker compose up -d
# Starts signaling server (:3000) + coturn (:3478/:5349)
```

### 2. Signaling Server Setup (Local dev only)

```bash
cd server
npm install
npm run dev
# Server runs on localhost:3000
```

### 3. Client Setup

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

## Internet / Cross-Network Setup

If users are connecting from different networks (not the same LAN), follow:

- `docs/remote-connectivity-checklist.md`

This covers public server hosting, port forwarding/firewalls, TURN/coturn, and HTTPS/WSS requirements.

You can also run an automated readiness check:

```bash
cd server
npm install
npm run check:remote
```

## License

MIT
