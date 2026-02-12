# coturn (TURN/STUN) configuration

## Run locally
```bash
docker compose up -d
```

## Notes
- UDP/TCP `3478` exposed for STUN/TURN.
- `5349` reserved for TLS TURN (`turns:`) in production.
- Relay UDP port range `49160-49200`.
- Uses `use-auth-secret` and static secret in dev config.

In production:
1. set `external-ip`
2. replace static secret
3. enable TLS cert/key and use `turns:` URLs
