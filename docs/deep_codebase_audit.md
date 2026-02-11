# Vvoice Deep Codebase Audit

Date: 2026-02-11

## Executive Summary

**Current grade: C-**

Vvoice has a promising foundation (Rust async backend, SQLx persistence, Tauri + React client), but the implementation is currently **MVP-grade** and has several high-risk issues that block production hardening:

- TLS trust is effectively disabled in the client.
- Core server session handling and protocol logic are concentrated in monolithic handlers.
- The React `App.tsx` acts as a God component (state, networking, event bus, and rendering all in one place).
- There is substantial duplication of protocol and codec logic between backend and client.

If these are addressed with a focused refactor, this can move to a B+/A- architecture quickly.

---

## A) Architecture & Separation of Concerns (SOLID)

### Backend (`backend/src/main.rs`, `handler.rs`, `state.rs`)

#### What is good
- Clear bootstrap sequence in `main.rs` (env, db, tls, listener).
- Shared state model exists and is explicit (`SharedState`, `Peer`).

#### Problems
1. **`main.rs` owns too much orchestration and lifecycle plumbing**
   - DB initialization, channel hydration, networking, and connection task setup are all in one function.
   - Recommend extracting into `bootstrap` and `server` modules (`load_channels`, `run_listener`, `accept_tls`).

2. **`handle_client` violates Single Responsibility heavily**
   - One function handles: authentication, registration, session setup, historical replay, protocol routing, command parsing, state mutation, voice routing, and cleanup.
   - This is difficult to reason about and risky to modify.

3. **`SharedState` abstraction exists but is bypassed**
   - `add_peer`/`remove_peer` methods are never used; direct `HashMap` mutation dominates.
   - Indicates either dead abstraction or incomplete encapsulation.

#### Recommended backend split
- `auth_service.rs`: Authenticate/register users, return `AuthResult`.
- `session_service.rs`: Session ID assignment, peer join/leave lifecycle.
- `voice_router.rs`: Channel/echo routing for `UDPTunnel`.
- `chat_service.rs`: Command parsing (`/echo`) + chat persistence.
- `packet_dispatch.rs`: `match MumblePacket` entrypoint that calls services.

This keeps protocol framing (`codec`) separate from business domain rules.

### Frontend (`client/src/App.tsx`)

#### Current state
`App.tsx` is 375 LOC and combines:
- connection lifecycle,
- event listener registration,
- reducer-like merge logic for users/channels,
- audio/chat/voice control commands,
- all major page layout and rendering.

This is a classic **God component** trend.

#### Suggested split
- `hooks/useVoiceConnection.ts` (connect/disconnect/mute/deaf/channel/message commands)
- `hooks/useMumbleEvents.ts` (Tauri event listeners + reducers)
- `components/Sidebar/ChannelTree.tsx`
- `components/Sidebar/UserCard.tsx`
- `components/Chat/ChatWindow.tsx`
- `components/Chat/ChatInput.tsx`

This also enables unit testing pure reducer logic.

---

## B) Code Health & Quality (DRY / KISS)

### DRY violations
1. **Mumble codec duplicated in backend and Tauri client**
   - `backend/src/codec.rs` and `client/src-tauri/src/mumble.rs` both implement packet type maps, decode and encode logic.
   - High divergence risk and bug multiplier.

2. **Proto files duplicated in two locations**
   - `backend/proto/Mumble.proto` and `client/src-tauri/proto/Mumble.proto` are copies.
   - Should come from one shared source with workspace-level build generation.

### KISS violations
1. **`handle_client` command loop too dense**
   - High nesting and state lock interaction make changes risky.

2. **Complex inline merge logic in React event handlers**
   - Hand-written partial merge logic inside `listen('user_update')` should be extracted into named reducers to reduce accidental regressions.

3. **Manual UDP tunnel parser in client receive path**
   - Parser and audio decode are deeply inlined in match arms; move to dedicated parser/decoder helpers.

### Dead / stale code opportunities
- Unused `SharedState::add_peer` and `SharedState::remove_peer` methods.
- `motion` import appears unused in `App.tsx`.
- Hardcoded `currentUser.status` is currently not used in UI rendering.

---

## C) Safety & Performance

### Critical safety issues
1. **TLS certificate verification disabled in client**
   - Custom `NoVerifier` accepts any server certificate.
   - This permits MITM interception and credential theft.

2. **Multiple production panic vectors via `unwrap`/`expect`**
   - Environment and parse assumptions use panic paths in server and client startup/runtime.

### Concurrency/performance concerns
1. **Nested `tokio::spawn` per accepted connection**
   - Listener spawns one task for TLS accept, then another for client handler.
   - Adds unnecessary complexity and supervision gaps.

2. **Global mutex lock contention in hot paths**
   - `state.lock().await` is taken across message routing operations and loops.
   - Will become bottleneck with concurrent users and voice traffic.

3. **Unbounded channels for peer tx queues**
   - `mpsc::unbounded_channel` can allow unbounded memory growth under slow consumers.

4. **Blocking `std::sync::Mutex` in real-time audio callbacks**
   - Lock poisoning + callback timing jitter risk.
   - Consider lock-free ring buffer or dedicated audio worker channels.

### Error handling quality
- `anyhow::Result` is convenient but overused as public boundary.
- Move protocol/auth/domain failures to typed enums (`thiserror`) and map to wire-level errors explicitly.

---

## Critical Issues (Fix First)

1. Replace `NoVerifier` with actual trust model (pinning, local CA, or TOFU with persisted fingerprints).
2. Split `handle_client` into domain services and packet dispatcher.
3. Remove panic paths in startup/runtime (`expect`/`unwrap`) where recoverable.
4. Introduce bounded channels with explicit backpressure policy.
5. Convert global state mutex into finer-grained state or actor model.

---

## Refactoring Roadmap (SOLID/DRY)

### Phase 1: Security & correctness (1-2 days)
- TLS verification policy implementation.
- Replace panicking startup calls with structured errors.
- Add integration test for rejected invalid cert and invalid password handling.

### Phase 2: Protocol and core architecture (3-5 days)
- Extract shared workspace crate:
  - `crates/mumble-proto` (prost generated models)
  - `crates/mumble-codec` (single encoder/decoder implementation)
- Remove duplicated proto + codec in backend/client.

### Phase 3: Backend service decomposition (3-6 days)
- Introduce `AuthService`, `SessionService`, `ChatService`, `VoiceRouter`.
- Replace monolithic packet loop with command dispatcher.
- Add typed errors and central mapping to Mumble `Reject`/protocol responses.

### Phase 4: Frontend decomposition (2-4 days)
- Move chat logic from `App.tsx` to `components/ChatWindow.tsx` and `hooks/useChatState.ts`.
- Move connection + command invocations to `hooks/useVoiceConnection.ts`.
- Move Tauri event listeners to `hooks/useMumbleEvents.ts`.

### Phase 5: Performance hardening (ongoing)
- Bounded per-peer queues with drop strategy for voice packets.
- `DashMap`/actor partitioning for peer/channel state.
- Telemetry: queue depths, lock wait times, packet latency.

---

## Code Cleanup Checklist

- [ ] `client/src-tauri/src/mumble.rs`: remove insecure `NoVerifier` and associated dangerous rustls config.
- [ ] `client/src-tauri/src/mumble.rs`: replace `unwrap` on host fallback and mutex locks.
- [ ] `backend/src/main.rs`: replace `expect("DATABASE_URL must be set")` with typed startup error.
- [ ] `backend/src/main.rs`: remove `channel_id.unwrap()` during channel bootstrapping.
- [ ] `backend/src/state.rs`: either use `add_peer/remove_peer` everywhere or delete methods.
- [ ] `client/src/App.tsx`: remove unused `motion` import.
- [ ] `client/src/App.tsx`: replace `any[]` UI state with typed models.
- [ ] `backend/src/handler.rs`: extract `/echo` command and chat persistence into `ChatService`.
- [ ] `backend/src/handler.rs`: shorten lock scope around broadcast loops.
- [ ] `backend/proto/Mumble.proto` + `client/src-tauri/proto/Mumble.proto`: collapse into single shared proto source.

---

## Final Assessment

The project is currently **functional but not hardened**. The architecture is close to a strong base, but security and separation-of-concern refactors should be treated as mandatory before scale or external exposure.
