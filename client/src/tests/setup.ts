import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Mock Tauri APIs used by stores/components in test environment.
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-store', () => {
    const memory = new Map<string, unknown>();
    return {
        Store: {
            load: vi.fn().mockResolvedValue({
                get: vi.fn(async (key: string) => memory.get(key)),
                set: vi.fn(async (key: string, value: unknown) => {
                    memory.set(key, value);
                }),
                save: vi.fn(async () => undefined),
                delete: vi.fn(async (key: string) => {
                    memory.delete(key);
                }),
            }),
        },
    };
});

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    cleanup();
});

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation(function () {
    return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    };
}));

// Mock WebRTC globals
vi.stubGlobal('RTCSessionDescription', vi.fn().mockImplementation(function (value) { return value; }));
vi.stubGlobal('RTCIceCandidate', vi.fn().mockImplementation(function (value) { return value; }));

vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function () {
    return {
        createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
        setLocalDescription: vi.fn().mockResolvedValue(undefined),
        setRemoteDescription: vi.fn().mockResolvedValue(undefined),
        addIceCandidate: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onsignalingstatechange: null,
        oniceconnectionstatechange: null,
        onicecandidate: null,
        ontrack: null,
        getSenders: vi.fn().mockReturnValue([]),
        getReceivers: vi.fn().mockReturnValue([]),
        getTransceivers: vi.fn().mockReturnValue([]),
    };
}));

vi.stubGlobal('MediaStream', vi.fn().mockImplementation(function () {
    return {
        getTracks: vi.fn().mockReturnValue([]),
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        getAudioTracks: vi.fn().mockReturnValue([]),
        getVideoTracks: vi.fn().mockReturnValue([]),
        active: true,
        id: 'mock-stream-id'
    };
}));

Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getUserMedia: vi.fn().mockImplementation(() => Promise.resolve(new MediaStream())),
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    },
    writable: true,
});
