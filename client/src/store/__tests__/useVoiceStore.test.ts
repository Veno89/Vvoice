import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useVoiceStore } from '../useVoiceStore';
import { SignalingClient } from '../../webrtc/SignalingClient';
import { WebRTCManager } from '../../webrtc/WebRTCManager';

// Mock dependencies
vi.mock('../../webrtc/SignalingClient');
vi.mock('../../webrtc/WebRTCManager');

describe('useVoiceStore', () => {
    // Reset store before each test
    beforeEach(() => {
        useVoiceStore.setState(useVoiceStore.getInitialState ? useVoiceStore.getInitialState() : {
            isConnected: false,
            isConnecting: false,
            currentUsername: "AllowedUser",
            currentUserRole: "User",
            currentChannelId: null,
            isMuted: false,
            isDeafened: false,
            audioSettings: { device: null, vad: 0.005 },
            channels: [], // Simplified default
            activeUsers: [],
            messages: [],
            remoteStreams: new Map(),
        });

        // Mock global fetch
        // Mock global fetch
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ token: 'mock-token' })
        }));

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // const { disconnect } = useVoiceStore.getState();
        // disconnect();
    });

    it('connects successfully', async () => {
        const { connect } = useVoiceStore.getState();
        await connect('Alice', 'password', 'localhost:3000', { device: 'default', vad: 0.5 });



        // isConnected is set to true inside signaling.onOpen callback in the store
        // We need to simulate that callback

        const mockSignalingInstance = (SignalingClient as any).mock.instances[0];
        expect(mockSignalingInstance).toBeDefined();

        // Trigger onOpen
        mockSignalingInstance.onOpen();

        const updatedState = useVoiceStore.getState();
        expect(updatedState.isConnected).toBe(true);
        expect(updatedState.currentUsername).toBe('Alice');
        expect(updatedState.currentChannelId).toBe(1); // Auto-joins lobby (id 1)
    });

    it('handles connection failure', async () => {
        const { connect } = useVoiceStore.getState();

        // Mock fetch failure
        // Mock fetch failure
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401
        }));

        // Mock alert to prevent jsdom error
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('console', { error: vi.fn(), log: vi.fn() }); // Silence error logs

        await connect('Alice', 'pass', 'host', { device: null, vad: 0 });

        const state = useVoiceStore.getState();
        expect(state.isConnected).toBe(false);
        expect(state.isConnecting).toBe(false);
    });

    it('updates state on participant_joined', async () => {
        const { connect } = useVoiceStore.getState();
        await connect('Alice', 'pass', 'host', { device: null, vad: 0 });

        const mockSignaling = (SignalingClient as any).mock.instances[0];
        mockSignaling.onOpen(); // Connect

        // Simulate incoming message
        const msg = {
            type: 'participant_joined',
            roomId: '1',
            peerId: 'peer-bob',
            displayName: 'Bob',
            muted: false
        };

        mockSignaling.onMessage(msg);

        const state = useVoiceStore.getState();
        expect(state.activeUsers).toHaveLength(1);
        expect(state.activeUsers[0].name).toBe('Bob');
    });

    it('sends chat message', async () => {
        const { connect, sendMessage } = useVoiceStore.getState();
        await connect('Alice', 'p', 'h', { device: null, vad: 0 });
        const mockSignaling = (SignalingClient as any).mock.instances[0];
        mockSignaling.onOpen();

        await sendMessage('Hello World');

        expect(mockSignaling.sendChatMessage).toHaveBeenCalledWith('1', 'Hello World'); // default channel 1
    });

    it('toggles mute', async () => {
        const { connect, toggleMute } = useVoiceStore.getState();
        await connect('Alice', 'p', 'h', { device: null, vad: 0 });
        const mockSignaling = (SignalingClient as any).mock.instances[0];
        const mockRTC = (WebRTCManager as any).mock.instances[0];

        mockSignaling.onOpen();

        await toggleMute(); // Mute

        expect(useVoiceStore.getState().isMuted).toBe(true);
        expect(mockRTC.setMute).toHaveBeenCalledWith(true);
        expect(mockSignaling.setMute).toHaveBeenCalledWith('1', true);

        await toggleMute(); // Unmute
        expect(useVoiceStore.getState().isMuted).toBe(false);
    });
});
