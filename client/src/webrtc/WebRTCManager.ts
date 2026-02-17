import { SignalingClient } from './SignalingClient';
import { ServerMessage } from './protocol';

interface PeerConnection {
    pc: RTCPeerConnection;
    peerId: string;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
};

export class WebRTCManager {
    private signaling: SignalingClient;
    private localStream: MediaStream | null = null;
    private peers: Map<string, PeerConnection> = new Map();
    private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;

    public onRemoteStream?: (peerId: string, stream: MediaStream) => void;
    public onPeerLeft?: (peerId: string) => void;

    constructor(signaling: SignalingClient) {
        this.signaling = signaling;
        this.setupDeviceListeners();
    }

    /**
     * Update ICE servers at runtime (called when server sends TURN credentials).
     */
    public setIceServers(servers: RTCIceServer[]): void {
        this.iceServers = servers.length > 0 ? servers : DEFAULT_ICE_SERVERS;
    }

    private setupDeviceListeners() {
        navigator.mediaDevices.addEventListener('devicechange', async () => {
            // In a real app, checking if the current device is gone is better.
            // For now, we re-acquire to ensure we are on the system default match.
            await this.handleDeviceChange();
        });
    }

    private async handleDeviceChange() {
        if (!this.localStream) return;

        const oldTracks = this.localStream.getAudioTracks();
        if (oldTracks.length === 0) return;

        try {
            // Re-acquire microphone (system default or sticky ID)
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: AUDIO_CONSTRAINTS,
                video: false
            });

            const newTrack = newStream.getAudioTracks()[0];
            if (newTrack) {
                await this.replaceAudioTrack(newTrack);
                oldTracks.forEach(t => t.stop());
                this.localStream = newStream;
            }
        } catch (e) {
            console.error('[RTC] Device swap failed', e);
        }
    }

    private async replaceAudioTrack(newTrack: MediaStreamTrack) {
        for (const peer of this.peers.values()) {
            const senders = peer.pc.getSenders();
            const audioSender = senders.find(s => s.track?.kind === 'audio');
            if (audioSender) {
                try {
                    await audioSender.replaceTrack(newTrack);
                } catch (e) {
                    // If replaceTrack fails, we might need renegotiation, but usually it works for same-kind tracks
                    console.error(`[RTC] Failed to replace track for ${peer.peerId}`, e);
                }
            }
        }
    }

    public async getLocalAudio() {
        if (this.localStream) return this.localStream;
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: AUDIO_CONSTRAINTS,
                video: false
            });
            return this.localStream;
        } catch (e) {
            console.error('Failed to get media', e);
            throw e;
        }
    }

    public async handleMessage(msg: ServerMessage) {
        switch (msg.type) {
            case 'room_joined':
                // Existing peers in the room. We initiate connections to them.
                for (const p of msg.participants) {
                    if (p.peerId !== msg.selfPeerId) {
                        await this.initiateConnection(p.peerId);
                    }
                }
                break;

            case 'participant_joined':
                // New peer joined. They will initiate connection to us (as per convention in room_joined).
                // So I do NOTHING here, wait for Offer.
                break;

            case 'participant_left':
                this.closePeer(msg.peerId);
                break;

            case 'webrtc_offer':
                try {
                    await this.handleOffer(msg.fromPeerId, JSON.parse(msg.sdp));
                } catch (e) {
                    console.error('[RTC] Failed to process offer from', msg.fromPeerId, e);
                }
                break;

            case 'webrtc_answer':
                try {
                    await this.handleAnswer(msg.fromPeerId, JSON.parse(msg.sdp));
                } catch (e) {
                    console.error('[RTC] Failed to process answer from', msg.fromPeerId, e);
                }
                break;

            case 'webrtc_ice_candidate':
                try {
                    await this.handleCandidate(msg.fromPeerId, JSON.parse(msg.candidate));
                } catch (e) {
                    console.error('[RTC] Failed to process ICE candidate from', msg.fromPeerId, e);
                }
                break;
        }
    }

    private createPeerConnection(peerId: string): RTCPeerConnection {
        if (this.peers.has(peerId)) return this.peers.get(peerId)!.pc;

        const pc = new RTCPeerConnection({
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.sendCandidate(peerId, event.candidate);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'failed' || state === 'disconnected') {
                console.warn(`[RTC] Connection ${state}, restarting ICE...`);
                this.restartIce(peerId);
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                this.onRemoteStream?.(peerId, event.streams[0]);
            }
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        this.peers.set(peerId, { pc, peerId });
        return pc;
    }

    public async restartIce(peerId: string) {
        const peer = this.peers.get(peerId);
        if (!peer) return;

        try {
            const offer = await peer.pc.createOffer({ iceRestart: true });
            if (offer.sdp) offer.sdp = this.mungeSDP(offer.sdp);
            await peer.pc.setLocalDescription(offer);
            this.signaling.sendOffer(peerId, offer);
        } catch (e) {
            console.error('[RTC] Failed to restart ICE', e);
        }
    }

    private async initiateConnection(peerId: string) {
        const pc = this.createPeerConnection(peerId);
        const offer = await pc.createOffer();
        if (offer.sdp) {
            offer.sdp = this.mungeSDP(offer.sdp);
        }
        await pc.setLocalDescription(offer);
        this.signaling.sendOffer(peerId, offer);
    }

    private async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit) {
        const pc = this.createPeerConnection(peerId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        if (answer.sdp) {
            answer.sdp = this.mungeSDP(answer.sdp);
        }
        await pc.setLocalDescription(answer);
        this.signaling.sendAnswer(peerId, answer);
    }

    private async handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit) {
        const peer = this.peers.get(peerId);
        if (peer) {
            await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    }

    private async handleCandidate(peerId: string, candidate: RTCIceCandidateInit) {
        const peer = this.peers.get(peerId);
        if (peer) {
            try {
                await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('[RTC] Failed to add candidate', e);
            }
        } else {
            console.warn('[RTC] Got candidate for unknown peer', peerId);
        }
    }

    private closePeer(peerId: string) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.pc.close();
            this.peers.delete(peerId);
            this.onPeerLeft?.(peerId);
        }
    }

    public setMute(muted: boolean) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
    }

    public setDeaf(deafened: boolean) {
        this.peers.forEach(peer => {
            peer.pc.getReceivers().forEach(receiver => {
                if (receiver.track.kind === 'audio') {
                    receiver.track.enabled = !deafened;
                }
            });
        });
    }

    public async startEchoTest(audioElement: HTMLAudioElement) {
        try {
            const stream = await this.getLocalAudio();
            audioElement.srcObject = stream;
            audioElement.muted = false; // Ensure it's not muted locally
            await audioElement.play();
        } catch (e) {
            console.error("Failed to start echo test:", e);
        }
    }

    public stopEchoTest(audioElement: HTMLAudioElement) {
        audioElement.srcObject = null;
    }

    public setupAudioAnalysis(callback: (volume: number) => void): () => void {
        if (!this.localStream) return () => { };

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(this.localStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animationId: number;

        const update = () => {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((bs, b) => bs + b, 0);
            const average = sum / dataArray.length;
            // Normalize somewhat (0-255 -> 0-100)
            const normalized = Math.min(100, (average / 128) * 100);
            callback(normalized);
            animationId = requestAnimationFrame(update);
        };

        update();

        return () => {
            cancelAnimationFrame(animationId);
            source.disconnect();
            analyser.disconnect();
            audioContext.close();
        };
    }

    public cleanup() {
        this.localStream?.getTracks().forEach(t => t.stop());
        this.peers.forEach(p => p.pc.close());
        this.peers.clear();
    }

    private mungeSDP(sdp: string): string {
        const lines = sdp.split('\r\n');
        let opusPayloadType: string | null = null;

        for (const line of lines) {
            const match = line.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
            if (match) {
                opusPayloadType = match[1];
                break;
            }
        }

        if (!opusPayloadType) return sdp;

        const opusParams = 'minptime=10;useinbandfec=1;usedtx=1;maxaveragebitrate=32000';

        return lines.map(line => {
            if (line.startsWith(`a=fmtp:${opusPayloadType} `)) {
                return `${line};${opusParams}`;
            }
            return line;
        }).join('\r\n');
    }
}
