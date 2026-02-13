import { create } from "zustand";
// import { invoke } from "@tauri-apps/api/core"; // Removed
// import { listen } from "@tauri-apps/api/event"; // Removed
import type { ActiveUser, Channel, ChatMessage } from "../types/voice";
import { SignalingClient } from "../webrtc/SignalingClient";
import { WebRTCManager } from "../webrtc/WebRTCManager";

// Module-level singletons for WebRTC engine
let signaling: SignalingClient | null = null;
let rtc: WebRTCManager | null = null;

const DEFAULT_CHANNELS: Channel[] = [
    { channel_id: 1, name: "Lobby", parent_id: 0, description: "Default Room", temporary: false, position: 0, links: [] },
    { channel_id: 2, name: "General", parent_id: 0, description: "General Chat", temporary: false, position: 1, links: [] },
    { channel_id: 3, name: "Gaming", parent_id: 0, description: "Gaming Room", temporary: false, position: 2, links: [] }
];

interface AudioSettings {
    device: string | null;
    vad: number;
}

interface VoiceState {
    // Connection State
    isConnected: boolean;
    isConnecting: boolean;
    currentUsername: string;
    currentUserRole: string;
    currentChannelId: number | null; // Added

    // Audio State
    isMuted: boolean;
    isDeafened: boolean;
    audioSettings: AudioSettings;

    // Data State
    channels: Channel[];
    activeUsers: ActiveUser[];
    messages: ChatMessage[];
    remoteStreams: Map<string, MediaStream>;

    // Actions
    connect: (username: string, password: string, serverAddress: string, settings: AudioSettings) => Promise<void>;
    disconnect: () => Promise<void>;
    joinChannel: (channelId: number) => Promise<void>;
    sendMessage: (message: string) => Promise<void>;
    toggleMute: () => Promise<void>;
    toggleDeaf: () => Promise<void>;
    toggleEcho: () => Promise<void>;
    setProfile: (avatarUrl: string, bio: string) => Promise<void>;

    // Internal/Setup
    setupListeners: () => Promise<() => void>;
    reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
    // Initial State
    isConnected: false,
    isConnecting: false,
    currentUsername: "AllowedUser",
    currentUserRole: "User",
    currentChannelId: null,
    isMuted: false,
    isDeafened: false,
    audioSettings: { device: null, vad: 0.005 },
    channels: DEFAULT_CHANNELS, // Static channels
    activeUsers: [],
    messages: [],
    remoteStreams: new Map(),

    // Actions
    connect: async (username, _password, serverAddress, settings) => {
        set({ isConnecting: true });
        try {
            get().reset();

            // 1. Authenticate with Signaling Server (HTTP)
            const host = serverAddress || "localhost:3000";
            const res = await fetch(`http://${host}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            if (!res.ok) throw new Error('Signaling Auth Failed');
            const { token } = await res.json();

            // 2. Initialize WebRTC Engine
            signaling = new SignalingClient(`ws://${host}/ws`, token);
            rtc = new WebRTCManager(signaling);

            // 3. Setup Engine Listeners
            signaling.onOpen = () => {
                console.log("[VoiceStore] Signaling Connected");
                set({ isConnected: true, currentUsername: username, audioSettings: settings, channels: DEFAULT_CHANNELS });
                // Auto-join Lobby
                get().joinChannel(1);
            };

            signaling.onClose = () => {
                console.log("[VoiceStore] Signaling Disconnected");
                set({ isConnected: false, activeUsers: [], remoteStreams: new Map() });
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
                        // Replace active users list
                        const users: ActiveUser[] = msg.participants.map(p => ({
                            session: hashCode(p.peerId),
                            name: p.displayName,
                            channel_id: parseInt(msg.roomId),
                            isMuted: p.muted,
                            isDeafened: false,
                            isSpeaking: false,
                            avatar_url: null,
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
                                avatar_url: null,
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
                }
            };

            // 4. Connect
            signaling.connect();

            // REMOVED RUST INVOKE

        } catch (e) {
            console.error("Connection failed:", e);
            alert(`Connection failed: ${e}`);
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
        set({ isDeafened: next });
        if (next) {
            get().toggleMute();
        }
    },

    toggleEcho: async () => {
        console.log("Echo test not implemented for WebRTC yet");
    },

    setProfile: async (_avatarUrl, _bio) => {
        console.log("Profile update not implemented for WebRTC yet");
    },

    reset: () => {
        set({
            channels: DEFAULT_CHANNELS,
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
