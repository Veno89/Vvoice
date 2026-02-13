# Threat Model (MVP)

## Primary risks
- Signal flooding / abuse
- Identity spoofing
- Sensitive SDP leakage in logs
- Unauthorized room access

## Mitigations in Milestone 1
- HTTP + WS rate limiting
- JWT verification for identity derivation
- No trust in client-provided user identity
- Structured logs with redaction of SDP and ICE payloads
- Room and participant caps to limit blast radius

## Future hardening
- OAuth/JWKS auth
- Per-room authorization policies
- WAF/DDOS controls
- Metrics + anomaly detection
