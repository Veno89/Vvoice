# Vvoice: Technical Audit & The Grand Plan 🚀

**Date:** 2026-02-10
**Status:** Draft / RFC

This document outlines the findings from the initial architectural audit and proposes a comprehensive roadmap to evolve Vvoice from a Proof-of-Concept (PoC) into a production-grade application.

---

## 1. Technical Audit 🧐

### 1.1 Architecture Analysis
**Current State:**
-   **Backend:** Monolithic Rust application (`main.rs`). Handles TCP/TLS, Protocol Parsing, State Management, and Audio Routing in a single file.
-   **Client:** Hybrid Tauri app (Rust + React).
    -   *Frontend:* React for UI, communicating via Tauri Events (`emit`/`listen`) and Commands (`invoke`).
    -   *Rust Core:* Managed by `mumble.rs`, running a threaded `tokio` runtime for the connection and a native thread for `cpal` audio capture.
-   **Protocol:** Standard Mumble Protocol (Protobuf + TCP Control / UDP Voice).

**Strengths:**
-   **Performance:** Rust + Tokio provides excellent concurrency for handling multiple voice streams.
-   **Latency:** UDP (Tunneling) approach for voice is industry standard.
-   **UI Stack:** React + Tauri allows for rapid UI iteration compared to native toolkits.

### 1.2 Codebase Health
-   **Backend (`main.rs`):** High Technical Debt. The file acts as a "God Object", handling too many responsibilities. It needs urgent modularization.
-   **State Management:** Currently in-memory (`HashMap` in `SharedState`). Restarting the server wipes all data. `sqlx` is present but underutilized.
-   **Security:**
    -   TLS Verification is disabled (`NoVerifier`). This is acceptable for dev/localhost but a major risk for production.
    -   Authentication is non-existent (claiming a username grants access).

### 1.3 Feature Gaps
-   **Voice Quality:** No noise suppression, echo cancellation, or gain control.
-   **Privacy:** No server-side enforcement of channel permissions (users can join any channel).
-   **Settings:** Hardcoded input/output devices.

---

## 2. The Grand Plan (Roadmap) 🗺️

We will execute this roadmap in **3 Strategic Phases**.

### Phase 1: Foundation & Refactoring (Immediate Priority)
*Goal: stabilize the codebase and prepare for scalability.*

#### 1.1 Backend Modularization
-   Extract **Protocol Layer**: Separate packet parsing/serialization.
-   Extract **State Layer**: Create `state.rs` to manage Peers/Channels safely.
-   Extract **Handlers**: Create `handlers/` directory for `voice.rs`, `chat.rs`, `auth.rs`.

#### 1.2 Data Persistence (PostgreSQL)
-   **Schema Design:**
    -   `users` (id, username, password_hash, created_at)
    -   `channels` (id, name, parent_id, permission_bitmask)
-   **Integration:** Update Backend to load Channels from DB on startup and authenticate Users against DB.

#### 1.3 Client Architecture
-   **Error Handling:** replace `console.error` with a proper Toast/Notification system.
-   **Context:** Move Tauri Logic out of `App.tsx` into a `VoiceContext` provider.

---

### Phase 2: Core Feature Completeness
*Goal: Reach feature parity with standard voice apps.*

#### 2.1 Advanced Audio Engine
-   **VAD (Voice Activity Detection):** Implement `rnnoise` or WebAudio VAD to stop transmitting silence.
-   **Device Selection:** UI Settings to choose specific Mic/Speaker.
-   **Volume Control:** Per-user volume sliders (client-side attenuation).

#### 2.2 Permissions & Roles
-   **Role System:** Implement `Role` struct (Admin, Mod, User).
-   **Channel Permissions:** Restrict access based on Role.
-   **Moderation:** Kick/Ban/Mute functionality.

#### 2.3 Text Chat Enhancements
-   **Basic Chat:** Ensure robust channel-based text chat first.
-   **History (Future):** Persist last N messages.
-   **Rich Text (Future):** Markdown implementation.

---

### Phase 3: Polish & "Wow" Factors
*Goal: Create a premium user experience.*

#### 3.1 UI/UX Polish
-   **Reactive Visuals:** Avatars that glow/pulse with voice intensity.
-   **Themes:** User-selectable themes (Midnight, Cyberpunk, Minimal).
-   **Micro-interactions:** Smooth Framer Motion transitions for all list updates.

#### 3.2 Rich Presence
-   **Integrations:** Discord/Steam status integration.

---

## 3. Next Steps 🏃

**Recommendation:** Proceed immediately with **Phase 1.1: Backend Modularization**.
1.  Create `backend/src/state.rs`.
2.  Create `backend/src/handler.rs`.
3.  Refactor `main.rs` to use these modules.
