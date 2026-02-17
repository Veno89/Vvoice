import { create } from "zustand";
// import { invoke } from "@tauri-apps/api/core"; // Removed
// import { listen } from "@tauri-apps/api/event"; // Removed
import type { ActiveUser, Channel, ChatMessage } from "../types/voice";
import { SignalingClient } from "../webrtc/SignalingClient";
import { WebRTCManager } from "../webrtc/WebRTCManager";

// Module-level singletons for WebRTC engine
let signaling: SignalingClient | null = null;
let rtc: WebRTCManager | null = null;



function resolveProtocol(serverAddress: string): { httpUrl: string; wsUrl: string } {
    let host = serverAddress.trim();
    let useSecure = false;

    // Strip explicit protocol prefixes
    if (host.startsWith('wss://') || host.startsWith('https://')) {
        useSecure = true;
        host = host.replace(/^(wss|https):\/\//, '');
    } else if (host.startsWith('ws://') || host.startsWith('http://')) {
        useSecure = false;
        host = host.replace(/^(ws|http):\/\//, '');
    } else {
        // Auto-detect: port 443 or no port (could be domain)
        const portMatch = host.match(/:([0-9]+)$/);
        if (portMatch && portMatch[1] === '443') {
            useSecure = true;
        }
    }

    const httpScheme = useSecure ? 'https' : 'http';
    const wsScheme = useSecure ? 'wss' : 'ws';

    return {
        httpUrl: `${httpScheme}://${host}`,
        wsUrl: `${wsScheme}://${host}/ws`,
    };
}

interface AudioSettings {
    device: string | null;
    vad: number;
}

interface VoiceState {
    // Connection State
    isConnected: boolean;
    isConnecting: boolean;
    isReconnecting: boolean;
    currentUsername: string;
    currentUserRole: string;
    currentChannelId: number | null;

    // Audio State
    isMuted: boolean;
    isDeafened: boolean;
    isEchoTesting: boolean;
    audioSettings: AudioSettings;

    // Data State
    channels: Channel[];
    activeUsers: ActiveUser[];
    messages: ChatMessage[];
    remoteStreams: Map<string, MediaStream>;
    token: string | null;
    serverAddress: string | null;

    // Error State
    connectionError: string | null;

    // Actions
    connect: (username: string, password: string, serverAddress: string, settings: AudioSettings) => Promise<void>;
    disconnect: () => Promise<void>;
    joinChannel: (channelId: number) => Promise<void>;
    sendMessage: (message: string) => Promise<void>;
    toggleMute: () => Promise<void>;
    toggleDeaf: () => Promise<void>;
    toggleEcho: () => Promise<void>;
    setProfile: (avatarUrl: string, bio: string) => Promise<void>;
    startAudioAnalysis: (callback: (volume: number) => void) => () => void;
    register: (username: string, password: string, serverAddress: string) => Promise<void>;
    clearConnectionError: () => void;
    createChannel: (name: string, description?: string) => void;
    deleteChannel: (channelId: number) => void;

    // Internal/Setup
    setupListeners: () => Promise<() => void>;
    reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
    // Initial State
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    currentUsername: "AllowedUser",
    currentUserRole: "User",
    currentChannelId: null,
    isMuted: false,
    isDeafened: false,
    isEchoTesting: false,
    audioSettings: { device: null, vad: 0.005 },
    channels: [], // Populated from server
    activeUsers: [],
    messages: [],
    remoteStreams: new Map(),
    token: null,
    serverAddress: null,
    connectionError: null,

    // Actions
    connect: async (username, _password, serverAddress, settings) => {
        set({ isConnecting: true });
        try {
            get().reset();

            // 1. Authenticate with Signaling Server (HTTP)
            const host = serverAddress || "localhost:3000";
            const { httpUrl, wsUrl } = resolveProtocol(host);
            const res = await fetch(`${httpUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: _password })
            });

            if (!res.ok) throw new Error('Signaling Auth Failed');
            const { token, user } = await res.json();
            set({ token, currentUsername: user?.username || username, currentUserRole: user?.role || 'member' });

            // 2. Initialize WebRTC Engine
            signaling = new SignalingClient(wsUrl, token);
            rtc = new WebRTCManager(signaling);

            // 3. Setup Engine Listeners
            signaling.onOpen = () => {
                console.log("[VoiceStore] Signaling Connected");
                const state = get();
                set({
                    isConnected: true,
                    isReconnecting: false,
                    audioSettings: settings,
                    serverAddress: host
                });
                // If reconnecting with a previous channel, auto-rejoin
                if (state.isReconnecting && state.currentChannelId !== null) {
                    console.log(`[VoiceStore] Reconnected — rejoining channel ${state.currentChannelId}`);
                    signaling!.joinRoom(String(state.currentChannelId), username);
                } else {
                    // First connect: auto-join Lobby
                    get().joinChannel(1);
                }
            };

            signaling.onClose = () => {
                console.log("[VoiceStore] Signaling Disconnected");
                // Preserve currentChannelId & username for session restore
                set({ isConnected: false, isReconnecting: true, activeUsers: [], remoteStreams: new Map() });
            };

            rtc.onRemoteStream = (peerId, stream) => {
                console.log(`[VoiceStore] Got remote stream from ${peerId}`);
                set(state => {
                    const newMap = new Map(state.remoteStreams);
                    newMap.set(peerId, stream);
                    return { remoteStreams: newMap };
                });
            };

            rtc.onPeerLeft = (peerId) => {
                set(state => {
                    const newMap = new Map(state.remoteStreams);
                    newMap.delete(peerId);
                    return { remoteStreams: newMap };
                });
            };

            signaling.onMessage = (msg) => {
                if (!rtc) return;
                rtc.handleMessage(msg);

                switch (msg.type) {
                    case 'room_joined':
                        set({ currentChannelId: parseInt(msg.roomId) });
                        // Pass server-provided ICE servers (STUN + TURN) to WebRTC
                        if (msg.iceServers && rtc) {
                            rtc.setIceServers(msg.iceServers as RTCIceServer[]);
                        }
                        // Replace active users list
                        const users: ActiveUser[] = msg.participants.map(p => ({
                            session: hashCode(p.peerId),
                            name: p.displayName,
                            channel_id: parseInt(msg.roomId),
                            isMuted: p.muted,
                            isDeafened: false,
                            isSpeaking: false,
                            avatar_url: p.avatarUrl || null,
                            bio: p.bio,
                            peerId: p.peerId
                        }));
                        set({ activeUsers: users });
                        break;

                    case 'participant_joined':
                        set(state => {
                            const newUser: ActiveUser = {
                                session: hashCode(msg.peerId),
                                name: msg.displayName,
                                channel_id: state.currentChannelId || 1,
                                isMuted: msg.muted || false,
                                isDeafened: false,
                                isSpeaking: false,
                                avatar_url: msg.avatarUrl || null,
                                bio: msg.bio,
                                peerId: msg.peerId
                            };
                            return { activeUsers: [...state.activeUsers, newUser] };
                        });
                        break;

                    case 'participant_left':
                        set(state => ({
                            activeUsers: state.activeUsers.filter(u => hashCode(msg.peerId) !== u.session)
                        }));
                        break;

                    case 'participant_muted':
                        set(state => ({
                            activeUsers: state.activeUsers.map(u =>
                                hashCode(msg.peerId) === u.session ? { ...u, isMuted: msg.muted } : u
                            )
                        }));
                        break;

                    case 'chat_message':
                        set(state => ({
                            messages: [...state.messages, {
                                actor: hashCode(msg.senderId),
                                channel_id: [parseInt(msg.roomId)],
                                message: msg.content,
                                session: hashCode(msg.senderId),
                                timestamp: msg.timestamp
                            }]
                        }));
                        break;

                    case 'channel_list':
                        set({
                            channels: msg.channels.map(ch => ({
                                channel_id: parseInt(ch.id),
                                name: ch.name,
                                parent_id: 0,
                                description: ch.description,
                                temporary: false,
                                position: ch.position,
                                links: []
                            }))
                        });
                        break;

                    case 'signal_error': {
                        const friendlyMessages: Record<string, string> = {
                            permission_denied: 'You don\u2019t have permission to do that.',
                            rate_limited: 'You\u2019re sending messages too fast.',
                            room_full: 'This channel is full.',
                            not_in_room: 'You need to join a channel first.',
                            peer_not_found: 'The other user disconnected.',
                            protocol_mismatch: 'Client is outdated. Please update.',
                        };
                        const text = friendlyMessages[msg.code] || msg.message || 'An error occurred.';
                        set({ connectionError: text });
                        break;
                    }
                }
            };

            // 4. Connect
            signaling.connect();

            // REMOVED RUST INVOKE

        } catch (e) {
            console.error("Connection failed:", e);
            set({ connectionError: `Connection failed: ${e instanceof Error ? e.message : String(e)}` });
        } finally {
            set({ isConnecting: false });
        }
    },

    disconnect: async () => {
        try {
            signaling?.disconnect();
            rtc?.cleanup();
            signaling = null;
            rtc = null;

            // REMOVED RUST INVOKE

            set({
                isConnected: false,
                isMuted: false,
                isDeafened: false,
                activeUsers: []
            });
            get().reset();
        } catch (e) {
            console.error("Disconnect failed:", e);
        }
    },

    register: async (username: string, password: string, serverAddress: string) => {
        set({ isConnecting: true });
        try {
            const host = serverAddress || "localhost:3000";
            const { httpUrl } = resolveProtocol(host);

            const res = await fetch(`${httpUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Registration Failed');
            }

            // After register, auto-connect
            await get().connect(username, password, serverAddress, get().audioSettings);
        } catch (e) {
            console.error("Registration failed:", e);
            set({
                isConnecting: false,
                connectionError: `Registration failed: ${e instanceof Error ? e.message : String(e)}`
            });
        }
    },

    joinChannel: async (channelId) => {
        try {
            set({ messages: [] });
            // WebRTC Join
            if (signaling && get().isConnected) {
                // Audio Init
                await rtc?.getLocalAudio();
                signaling.joinRoom(channelId.toString(), get().currentUsername);
                set({ currentChannelId: channelId });
            }
        } catch (e) {
            console.error("Join channel error:", e);
        }
    },

    sendMessage: async (message) => {
        try {
            const { currentChannelId } = get();
            if (signaling && get().isConnected && currentChannelId) {
                signaling.sendChatMessage(currentChannelId.toString(), message);
            }
        } catch (e) {
            console.error("Failed to send message:", e);
        }
    },

    toggleMute: async () => {
        const { isMuted, currentChannelId } = get();
        const next = !isMuted;

        rtc?.setMute(next);
        if (signaling && currentChannelId) {
            signaling.setMute(currentChannelId.toString(), next);
        }

        set({ isMuted: next });
    },

    toggleDeaf: async () => {
        const { isDeafened } = get();
        const next = !isDeafened;

        rtc?.setDeaf(next);
        set({ isDeafened: next });

        if (next) {
            get().toggleMute();
        }
    },

    toggleEcho: async () => {
        const { isEchoTesting } = get();
        if (isEchoTesting) {
            // Stop
            const audioEl = document.getElementById('echo-audio') as HTMLAudioElement;
            if (audioEl) rtc?.stopEchoTest(audioEl);
            set({ isEchoTesting: false });
        } else {
            // Start
            // We need a dedicated audio element for echo test. 
            // For now, we'll try to find one or rely on the UI to provide one.
            // Actually, best pattern is to just set state and let UI component handle the ref.
            // But here we are inside the store. 
            // Let's assume there is an <audio id="echo-test-audio" /> in the app or AudioRenderer.
            const audioEl = document.getElementById('echo-audio') as HTMLAudioElement;
            if (audioEl) {
                await rtc?.startEchoTest(audioEl);
                set({ isEchoTesting: true });
            } else {
                console.error("Echo audio element not found");
            }
        }
    },

    clearConnectionError: () => {
        set({ connectionError: null });
    },

    setProfile: async (avatarUrl, bio) => {
        try {
            const { token, currentUsername, activeUsers, serverAddress } = get();
            if (!token) throw new Error("Not authenticated");

            // 1. Call API
            const host = serverAddress || "localhost:3000";
            const { httpUrl } = resolveProtocol(host);
            const res = await fetch(`${httpUrl}/api/profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ avatarUrl, bio })
            });

            if (!res.ok) throw new Error("Failed to update profile");

            // 2. Optimistic Update
            const updatedUsers = activeUsers.map(u =>
                u.name === currentUsername
                    ? { ...u, avatar_url: avatarUrl || null, bio }
                    : u
            );
            set({ activeUsers: updatedUsers });

        } catch (e) {
            console.error("Profile update failed:", e);
        }
    },

    startAudioAnalysis: (callback) => {
        if (rtc) {
            return rtc.setupAudioAnalysis(callback);
        }
        return () => { };
    },

    createChannel: (name, description) => {
        signaling?.createChannel(name, description);
    },

    deleteChannel: (channelId) => {
        signaling?.deleteChannel(String(channelId));
    },

    reset: () => {
        set({
            channels: [],
            activeUsers: [],
            messages: []
        });
    },

    setupListeners: async () => {
        // No external listeners needed for purely WebRTC setup
        // Channels and Messages now come via Signaling
        return () => { };
    }
}));

// Helper to generate a number hash from string (for temporary session ID compatibility)
function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/** Derived selector: current user from active users list. */
export const useCurrentUser = () =>
    useVoiceStore(state =>
        state.activeUsers.find(u => u.name === state.currentUsername) ?? null
    );

