import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ActiveUser, Channel, ChatMessage } from "../types/voice";

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

    // Audio State
    isMuted: boolean;
    isDeafened: boolean;
    audioSettings: AudioSettings;

    // Data State
    channels: Channel[];
    activeUsers: ActiveUser[];
    messages: ChatMessage[];

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
    isMuted: false,
    isDeafened: false,
    audioSettings: { device: null, vad: 0.005 },
    channels: [],
    activeUsers: [],
    messages: [],

    // Actions
    connect: async (username, password, serverAddress, settings) => {
        set({ isConnecting: true });
        try {
            get().reset(); // Clear previous state
            await invoke("connect_voice", {
                username,
                password,
                inputDevice: settings.device,
                vadThreshold: settings.vad,
                serverAddress: serverAddress || "127.0.0.1",
            });
            set({
                isConnected: true,
                currentUsername: username,
                audioSettings: settings
            });
        } catch (e) {
            console.error("Connection failed:", e);
            alert(`Connection failed: ${e}`);
        } finally {
            set({ isConnecting: false });
        }
    },

    disconnect: async () => {
        try {
            await invoke("disconnect_voice");
            set({
                isConnected: false,
                isMuted: false,
                isDeafened: false
            });
            get().reset();
        } catch (e) {
            console.error("Disconnect failed:", e);
        }
    },

    joinChannel: async (channelId) => {
        try {
            set({ messages: [] });
            await invoke("join_channel", { channelId });
        } catch (e) {
            console.error("Invoke join_channel error:", e);
        }
    },

    sendMessage: async (message) => {
        try {
            await invoke("send_message", { message });
        } catch (e) {
            console.error("Failed to send message:", e);
        }
    },

    toggleMute: async () => {
        const { isMuted } = get();
        const next = !isMuted;
        set({ isMuted: next });
        try {
            await invoke("set_mute", { mute: next });
        } catch (e) {
            console.error("Failed to set mute:", e);
            set({ isMuted: !next }); // Revert on error
        }
    },

    toggleDeaf: async () => {
        const { isDeafened } = get();
        const next = !isDeafened;
        set({ isDeafened: next });
        try {
            await invoke("set_deaf", { deaf: next });
            if (next) {
                set({ isMuted: true });
            }
        } catch (e) {
            console.error("Failed to set deaf:", e);
            set({ isDeafened: !next }); // Revert
        }
    },

    toggleEcho: async () => {
        await get().sendMessage("/echo");
    },

    setProfile: async (avatarUrl, bio) => {
        try {
            await invoke("set_profile", { avatarUrl: avatarUrl || null, bio: bio || null });
        } catch (e) {
            console.error("Failed to set profile:", e);
        }
    },

    reset: () => {
        set({
            channels: [],
            activeUsers: [],
            messages: []
        });
    },

    setupListeners: async () => {
        const unlistenUpdate = await listen<Partial<ActiveUser> & { session: number }>("user_update", (event) => {
            const user = event.payload;
            set((state) => {
                const exists = state.activeUsers.find((u) => u.session === user.session);
                if (exists) {
                    const merged = { ...exists };
                    // Only merge fields that are NOT null/undefined in the update
                    Object.keys(user).forEach((key) => {
                        const k = key as keyof typeof user;
                        if (user[k] !== undefined && user[k] !== null) {
                            // @ts-ignore
                            merged[k] = user[k];
                        }
                    });

                    return {
                        activeUsers: state.activeUsers.map((u) => (u.session === user.session ? merged : u))
                    };
                }
                return { activeUsers: [...state.activeUsers, { ...user, isSpeaking: false } as ActiveUser] };
            });
        });

        const unlistenRemove = await listen<{ session: number }>("user_remove", (event) => {
            const { session } = event.payload;
            set((state) => ({
                activeUsers: state.activeUsers.filter((u) => u.session !== session)
            }));
        });

        const unlistenUpdateChannel = await listen<Channel>("channel_update", (event) => {
            const channel = event.payload;
            set((state) => {
                const exists = state.channels.find((c) => c.channel_id === channel.channel_id);
                if (exists) {
                    return {
                        channels: state.channels.map((c) => (c.channel_id === channel.channel_id ? { ...c, ...channel } : c))
                    };
                }
                return { channels: [...state.channels, channel] };
            });
        });

        const unlistenRemoveChannel = await listen<{ channel_id: number }>("channel_remove", (event) => {
            const { channel_id } = event.payload;
            set((state) => ({
                channels: state.channels.filter((c) => c.channel_id !== channel_id)
            }));
        });

        const unlistenTextMessage = await listen<ChatMessage>("text_message", (event) => {
            set((state) => ({
                messages: [...state.messages, event.payload]
            }));
        });

        return () => {
            unlistenUpdate();
            unlistenRemove();
            unlistenUpdateChannel();
            unlistenRemoveChannel();
            unlistenTextMessage();
        };
    }
}));
