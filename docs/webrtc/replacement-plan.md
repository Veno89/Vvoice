# Desktop Voice Replacement Plan (Future, Not Executed)

1. **Dual-stack phase**
   - Keep Mumble as default
   - Add feature flag for WebRTC transport in desktop app
2. **Protocol adapter**
   - Introduce desktop signaling client compatible with `/webrtc/signaling-server`
3. **Media integration**
   - Add native WebRTC audio pipeline for desktop runtime
4. **Controlled rollout**
   - Canary users, telemetry, fallback to Mumble
5. **Cutover**
   - Switch default to WebRTC after parity on reliability and quality

No replacement actions are performed in Milestone 1.
