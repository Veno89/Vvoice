# Vvoice

A modern, high-performance voice chat application built with Rust (Backend) and Tauri/React (Frontend).

## Features

-   **Low Latency Voice:** Uses UDP for real-time voice transmission (Mumble Protocol compatible).
-   **Secure:** TLS encryption for control channel.
-   **Audio Engine:** High-quality Opus codec, jitter buffer for smooth playback.
-   **Cross-Platform:** Runs on Windows, Linux, and macOS (Client).
-   **Scalable Backend:** Rust `tokio` based server handling thousands of concurrent connections.

## Project Structure

-   `backend/`: The Vvoice Server (Rust). Handles authentication, channel management, and voice routing.
-   `client/`: The Vvoice Desktop Client (Tauri + React + Rust). Handles UI and audio capture/playback.
-   `murmur/`: (Legacy) Scripts for running a standard Murmur server for comparison/testing.

## Getting Started

### Prerequisites

-   **Rust:** Latest stable toolchain (`rustup`).
-   **Node.js:** v18+ and `npm`.
-   **PostgreSQL:** Database server running locally throughout development.

### 1. Backend Server Setup

1.  Navigate to `backend`:
    ```bash
    cd backend
    ```
2.  Set up environment variables:
    Create a `.env` file with your database URL:
    ```env
    DATABASE_URL=postgres://user:password@localhost/vvoice_db
    RUST_LOG=info
    ```
3.  Run the server:
    ```bash
    cargo run
    ```
    The server will automatically create the database and run migrations on first start.
    It listens on `0.0.0.0:64738` (TCP/UDP).

### 2. Client Setup

1.  Navigate to `client`:
    ```bash
    cd client
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run in Development Mode:
    ```bash
    npm run tauri dev
    ```
    This launches the frontend with hot-reloading and compiles the Rust backend logic.

### 3. Build for Release

To create a standalone executable:
```bash
cd client
npm run tauri build
```
The output exe will be in `client/src-tauri/target/release`.

## Usage

1.  Start the Server.
2.  Launch one or more Clients.
3.  Click "Connect" (defaults to `localhost`).
4.  **Talking:** Voice activates automatically (VAD/PTT settings pending).
5.  **Echo Test:** Click "Echo Test" in the header to hear yourself (Loopback test).

## License

MIT
