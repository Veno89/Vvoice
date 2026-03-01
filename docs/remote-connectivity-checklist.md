# Vvoice Remote Connectivity Checklist (Different Networks)

Use this checklist to make Vvoice work between users on different networks (different homes/offices, cellular, etc.).

## What is already handled by the code vs what you must set up

### Already implemented in this repository (no extra coding required)

- Signaling server binds to `0.0.0.0` by default when `HOST` is set accordingly.
- CORS is supported through `CORS_ORIGINS`.
- The server generates TURN credentials dynamically (HMAC) when `TURN_HOST`/`TURN_SECRET` are configured.
- The client consumes `iceServers` from the `room_joined` signaling event.
- Secure scheme selection is supported from the login/server address input (`http/ws` vs `https/wss`).

### You must provide / operate manually (deployment & infrastructure)

- A publicly reachable server (VM/container host) and DNS/public IP.
- Firewall/security-group and router port-forwarding rules.
- A running coturn instance reachable from the public internet.
- TLS certificates and HTTPS/WSS termination for production.
- Production secrets (`WEBRTC_DEV_JWT_SECRET`, `TURN_SECRET`) and environment configuration.

### Practical split (rough estimate)

- **In-code work already done:** ~70%
  - signaling, auth flow, ICE server handoff, and client protocol wiring.
- **Manual ops/deployment work you still need:** ~30%
  - networking, public hosting, TURN operation, certificates, and DNS.

## 1) Host the signaling server on a public/reachable address

The signaling server must be reachable from all clients.

- Run server with:
  - `HOST=0.0.0.0`
  - `PORT=3000` (or another open port)
- Verify from another machine:
  - `http://<public-ip-or-domain>:3000/health`
- Do **not** use `localhost`/`127.0.0.1` for remote users.

## 2) Expose/forward the signaling port

If you host from home/office behind NAT:

- Forward external TCP port `3000` to the server machine.
- Allow TCP `3000` in firewall/security group.
- If using cloud VM, open the same port in cloud firewall rules.

## 3) Configure CORS for your real client origins

Set `CORS_ORIGINS` to the exact app origins in production.

Example:

```bash
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

(Use `*` only for dev/testing.)

## 4) Configure TURN (required for reliable cross-network voice)

STUN-only often fails for symmetric NAT and strict enterprise networks. TURN is required for reliability.

Set these server env vars:

```bash
TURN_HOST=turn.example.com
TURN_PORT=3478
TURN_SECRET=<same-secret-as-coturn-static-auth-secret>
TURN_TTL=86400
```

And run coturn with matching secret + open ports:

- TCP/UDP `3478` (TURN/STUN)
- (Optional TLS) TCP/UDP `5349` for `turns:`
- Relay UDP range `49160-49200` (or your configured range)

## 5) Use TLS/WSS in production

For internet deployment, terminate TLS and use:

- API: `https://...`
- WebSocket: `wss://.../ws`

Client supports secure scheme if user enters `https://...` or `wss://...` in server address.

## 6) Client address format to share with users

Tell users to enter one of:

- `voice.example.com:3000`
- `https://voice.example.com`
- `wss://voice.example.com`

Avoid private LAN IPs if users are outside that LAN.

## 7) Validate end-to-end quickly

1. User A and B log in from different networks.
2. Both join same channel.
3. Check browser/desktop logs for ICE state:
   - should become `connected`/`completed`.
4. If stuck at `checking` or `failed`, TURN/ports are usually misconfigured.

## 8) Production hardening

- Set strong secrets:
  - `WEBRTC_DEV_JWT_SECRET`
  - `TURN_SECRET`
- Restrict CORS.
- Prefer DNS domain + TLS certs.
- Monitor server logs and rate-limit events.

## Minimal production env template

```bash
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
WEBRTC_DEV_JWT_SECRET=<strong-random-secret>
DB_PATH=data/vvoice.db
CORS_ORIGINS=https://app.example.com
TURN_HOST=turn.example.com
TURN_PORT=3478
TURN_SECRET=<same-as-coturn>
TURN_TTL=86400
```

## Systematic steps you can run right now (automated)

From this repository you can now run an automated readiness check:

```bash
cd server
npm run check:remote
```

What it validates automatically:

- required env variables are present
- TURN host resolves in DNS
- TURN TCP endpoint is reachable

What it cannot validate automatically:

- your public router/NAT forwarding correctness
- cloud/provider firewall policy outside the machine
- certificate trust chain for external clients
- real two-party voice media path from separate networks

## Manual fix guide (easy mode)

1. **Pick where to host**
   - cloud VM is easiest; home-hosted requires router port forwarding.

2. **Set server env**
   - configure `HOST`, `PORT`, `WEBRTC_DEV_JWT_SECRET`, `CORS_ORIGINS`,
     `TURN_HOST`, `TURN_PORT`, `TURN_SECRET`, `TURN_TTL`.

3. **Start signaling + coturn**
   - from repo root: `docker compose up -d`.

4. **Open required ports**
   - signaling TCP: `3000`
   - TURN: TCP/UDP `3478`, optional `5349`
   - TURN relay UDP range: `49160-49200`

5. **Run automated checker**
   - `cd server && npm run check:remote`

6. **Verify from outside your network**
   - `http://<public-host>:3000/health` must respond.
   - Have two users on different networks join same channel.

7. **If audio still fails**
   - 90% of failures are TURN host/secret mismatch or blocked UDP relay ports.

