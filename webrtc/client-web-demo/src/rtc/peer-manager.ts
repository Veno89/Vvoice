export interface PeerManagerOptions {
  onIceCandidate: (toPeerId: string, candidate: string) => void;
  onOffer: (toPeerId: string, sdp: string) => void;
  onAnswer: (toPeerId: string, sdp: string) => void;
  onConnectionState: (peerId: string, state: RTCPeerConnectionState) => void;
  onRemoteTrack: (peerId: string, stream: MediaStream) => void;
  iceServers: RTCIceServer[];
}

export class PeerManager {
  private readonly peers = new Map<string, RTCPeerConnection>();
  private localStream?: MediaStream;

  constructor(private readonly options: PeerManagerOptions) {}

  async setupLocalAudio(deviceId?: string): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
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

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  async ensurePeer(peerId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

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
        pc.addTrack(track, this.localStream as MediaStream);
      });
    }

    this.peers.set(peerId, pc);
    return pc;
  }

  async createOffer(peerId: string): Promise<void> {
    const pc = await this.ensurePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.options.onOffer(peerId, offer.sdp ?? '');
  }

  async handleOffer(fromPeerId: string, sdp: string): Promise<void> {
    const pc = await this.ensurePeer(fromPeerId);
    await pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.options.onAnswer(fromPeerId, answer.sdp ?? '');
  }

  async handleAnswer(fromPeerId: string, sdp: string): Promise<void> {
    const pc = await this.ensurePeer(fromPeerId);
    await pc.setRemoteDescription({ type: 'answer', sdp });
  }

  async handleIceCandidate(fromPeerId: string, candidate: string): Promise<void> {
    const pc = await this.ensurePeer(fromPeerId);
    await pc.addIceCandidate({ candidate });
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
    }
  }

  closeAll(): void {
    for (const [peerId] of this.peers) {
      this.removePeer(peerId);
    }
  }
}
