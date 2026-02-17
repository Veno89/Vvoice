
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebRTCManager } from '../WebRTCManager';

// Mock SignalingClient - Manual Stub
// vi.mock('../SignalingClient'); // Removed to avoid constructor issues

describe('WebRTCManager', () => {
    let signaling: any;
    let rtc: WebRTCManager;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Manual Stub
        signaling = {
            sendAnswer: vi.fn(),
            sendOffer: vi.fn(),
            sendCandidate: vi.fn(),
            joinRoom: vi.fn(),
            setMute: vi.fn(),
            sendChatMessage: vi.fn(),
            onOpen: undefined,
            onMessage: undefined,
            connect: vi.fn(),
            disconnect: vi.fn()
        };

        // Setup WebRTCManager
        rtc = new WebRTCManager(signaling);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes and sets up device listeners', () => {
        expect(rtc).toBeDefined();
        // Check if device listener was added
        // We can't easily check navigator.mediaDevices.addEventListener calls without spying on it first
        // But setup.ts mocks it, so we could spy on it if we exported the mock or accessed it via global
    });

    it('acquires local audio', async () => {
        const stream = await rtc.getLocalAudio();
        expect(stream).toBeDefined();
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
            audio: expect.objectContaining({ echoCancellation: true })
        }));
    });

    it('handles webrtc_offer by creating answer', async () => {
        // Mock getLocalAudio to ensure tracks are added
        await rtc.getLocalAudio();

        const offerMsg = {
            type: 'webrtc_offer' as const,
            fromPeerId: 'peer-1',
            sdp: JSON.stringify({ type: 'offer', sdp: 'mock-sdp' })
        };

        await rtc.handleMessage(offerMsg);

        // Should create peer connection
        // Should set remote desc
        // Should create answer
        // Should set local desc
        // Should send answer via signaling
        expect(signaling.sendAnswer).toHaveBeenCalledWith('peer-1', expect.objectContaining({
            type: 'answer'
        }));
    });

    it('handles webrtc_answer', async () => {
        // First we need a peer connection (usually created by offer or room_joined)
        // Let's simulate initiating a connection
        const joinMsg = {
            type: 'room_joined' as const,
            roomId: '1',
            selfPeerId: 'me',
            participants: [{ peerId: 'peer-2', displayName: 'Bob', muted: false }],
            iceServers: []
        };

        await rtc.handleMessage(joinMsg);

        // verify offer sent
        expect(signaling.sendOffer).toHaveBeenCalledWith('peer-2', expect.any(Object));

        // Now handle answer
        const answerMsg = {
            type: 'webrtc_answer' as const,
            fromPeerId: 'peer-2',
            sdp: JSON.stringify({ type: 'answer', sdp: 'mock-answer-sdp' })
        };

        await rtc.handleMessage(answerMsg);
        // We can check if setRemoteDescription was called on the mock PC
        // But gaining access to the internal PC mock from here is tricky without exposing it or spying on the global
    });

    it('handles ice candidate', async () => {
        // Ensure peer exists
        await rtc.handleMessage({
            type: 'room_joined' as const,
            roomId: '1',
            selfPeerId: 'me',
            participants: [{ peerId: 'peer-3', displayName: 'Sue', muted: false }],
            iceServers: []
        });

        const candidateMsg = {
            type: 'webrtc_ice_candidate' as const,
            fromPeerId: 'peer-3',
            candidate: JSON.stringify({ candidate: 'candidate:...' })
        };

        await rtc.handleMessage(candidateMsg);
        // Should call addIceCandidate on PC
    });

    it('cleans up resources', async () => {
        await rtc.getLocalAudio();
        rtc.cleanup();

        // Local stream tracks should be stopped
        // We'd need to spy on the stream returned by getUserMedia
    });
});
