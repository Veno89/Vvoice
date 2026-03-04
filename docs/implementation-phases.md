# Vvoice Improvement Implementation Phases

This plan turns the prior deep-analysis recommendations into executable phases, ordered by risk-reduction and delivery impact.

## Phase 1 — Protocol & Test Reliability (Immediate)

**Goal:** Eliminate handshake/protocol drift and restore trust in integration tests.

### Scope
- Align WebSocket `client_hello` expectations between client and server:
  - Ensure client sends `clientId`.
  - Require `authToken` at schema level if runtime requires it.
- Fix server integration test bootstrap to pass required dependencies into `registerWebSocketServer`.

### Success criteria
- Server integration tests execute without runtime bootstrap errors.
- Client/server protocol contract for `client_hello` is internally consistent.

---

## Phase 2 — Identity & Room Correctness

**Goal:** Ensure user identity is deterministic and room-safe in multi-room scenarios.

### Scope
- Replace "first peer ID in set" routing with room-scoped peer mapping in server message handling.
- Move client state identity from hash-derived session IDs toward canonical `peerId`.

### Success criteria
- Chat and signaling sender identity are correct for multi-room participants.
- Client removes hash-based identity dependence in critical paths.

---

## Phase 3 — Security Hardening

**Goal:** Prevent accidental insecure deployments.

### Scope
- Enforce environment-gated secrets (JWT, TURN) with production-safe startup checks.
- Make dev-only auth routes explicit and impossible to enable accidentally in production.

### Success criteria
- Startup fails fast when required secure env vars are absent in production-like environments.
- Dev auth is unavailable outside explicitly declared local/development modes.

---

## Phase 4 — Runtime Performance & Architecture

**Goal:** Improve scalability and maintainability of real-time paths.

### Scope
- Reduce synchronous DB work in message hot paths (cache/queue or async persistence strategy).
- Decompose `useVoiceStore` into connection/RTC/chat slices.
- Move UI DOM interactions (echo test element management) out of state store into component layer.

### Success criteria
- Lower p95 signaling latency under load.
- Clear separation of concerns between transport, media, and UI state.

---

## Phase 5 — Product Improvements

**Goal:** Deliver higher user value after core stability.

### Scope
- Speaking indicators, presence states, improved reconnect UX.
- Chat scalability improvements (virtualization).
- Admin/ops improvements as needed.

### Success criteria
- Better in-call awareness and smoother UX at higher participant/message volume.

