export class PeerManager {
    options;
    peers = new Map();
    localStream;
    constructor(options) {
        this.options = options;
    }
    async setupLocalAudio(deviceId) {
        const constraints = {
            audio: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return this.localStream;
    }
    setMuted(muted) {
        this.localStream?.getAudioTracks().forEach((track) => {
            track.enabled = !muted;
        });
    }
    async ensurePeer(peerId) {
        const existing = this.peers.get(peerId);
        if (existing)
            return existing;
        const pc = new RTCPeerConnection({ iceServers: this.options.iceServers });
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.options.onIceCandidate(peerId, event.candidate.candidate);
            }
        };
        pc.onconnectionstatechange = () => {
            this.options.onConnectionState(peerId, pc.connectionState);
        };
        pc.ontrack = (event) => {
            const [stream] = event.streams;
            if (stream) {
                this.options.onRemoteTrack(peerId, stream);
            }
        };
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                pc.addTrack(track, this.localStream);
            });
        }
        this.peers.set(peerId, pc);
        return pc;
    }
    async createOffer(peerId) {
        const pc = await this.ensurePeer(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.options.onOffer(peerId, offer.sdp ?? '');
    }
    async handleOffer(fromPeerId, sdp) {
        const pc = await this.ensurePeer(fromPeerId);
        await pc.setRemoteDescription({ type: 'offer', sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.options.onAnswer(fromPeerId, answer.sdp ?? '');
    }
    async handleAnswer(fromPeerId, sdp) {
        const pc = await this.ensurePeer(fromPeerId);
        await pc.setRemoteDescription({ type: 'answer', sdp });
    }
    async handleIceCandidate(fromPeerId, candidate) {
        const pc = await this.ensurePeer(fromPeerId);
        await pc.addIceCandidate({ candidate });
    }
    removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.close();
            this.peers.delete(peerId);
        }
    }
    closeAll() {
        for (const [peerId] of this.peers) {
            this.removePeer(peerId);
        }
    }
}
