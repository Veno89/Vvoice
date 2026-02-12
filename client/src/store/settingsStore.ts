import { create } from 'zustand';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

interface SettingsState {
    inputDevice: string | null;
    outputDevice: string | null;
    vadThreshold: number;
    pttEnabled: boolean;
    pttKey: string | null;

    // Credentials
    savedUsername?: string;
    savedPassword?: string;
    savedServerAddress?: string;
    rememberMe: boolean;

    // Actions
    setInputDevice: (device: string | null) => void;
    setOutputDevice: (device: string | null) => void;
    setVadThreshold: (threshold: number) => void;
    setPttEnabled: (enabled: boolean) => void;
    setPttKey: (key: string | null) => void;
    setCredentials: (username: string, password: string, serverAddress: string, remember: boolean) => Promise<void>;
    loadSettings: () => Promise<void>;
}

const storePromise = Store.load('settings.bin');

export const useSettingsStore = create<SettingsState>((set, get) => ({
    inputDevice: null,
    outputDevice: null,
    vadThreshold: 0.01,
    pttEnabled: false,
    pttKey: 'F12',
    savedUsername: '',
    savedPassword: '',
    savedServerAddress: '127.0.0.1',
    rememberMe: false,

    setInputDevice: async (device) => {
        set({ inputDevice: device });
        const store = await storePromise;
        await store.set('input_device', device);
        await store.save();
    },
    setOutputDevice: async (device) => {
        set({ outputDevice: device });
        const store = await storePromise;
        await store.set('output_device', device);
        await store.save();
    },
    setVadThreshold: async (threshold) => {
        set({ vadThreshold: threshold });
        const store = await storePromise;
        await store.set('vad_threshold', threshold);
        await store.save();
        invoke('set_vad_threshold', { threshold }).catch(console.error);
    },
    setPttEnabled: async (enabled) => {
        set({ pttEnabled: enabled });
        const store = await storePromise;
        await store.set('ptt_enabled', enabled);
        await store.save();
        invoke('set_ptt_config', { enabled, key: get().pttKey }).catch(console.error);
    },
    setPttKey: async (key) => {
        set({ pttKey: key });
        const store = await storePromise;
        await store.set('ptt_key', key);
        await store.save();
        invoke('set_ptt_config', { enabled: get().pttEnabled, key }).catch(console.error);
    },
    setCredentials: async (username, password, serverAddress, remember) => {
        set({ savedUsername: username, savedPassword: password, savedServerAddress: serverAddress, rememberMe: remember });
        const store = await storePromise;
        if (remember) {
            await store.set('saved_username', username);
            await store.set('saved_password', password);
            await store.set('saved_server_address', serverAddress);
            await store.set('remember_me', true);
        } else {
            await store.delete('saved_username');
            await store.delete('saved_password');
            await store.delete('saved_server_address');
            await store.set('remember_me', false);
        }
        await store.save();
    },
    loadSettings: async () => {
        try {
            const store = await storePromise;
            const inputDevice = await store.get<string | null>('input_device');
            const vadThreshold = await store.get<number>('vad_threshold');
            const pttEnabled = await store.get<boolean>('ptt_enabled');
            const pttKey = await store.get<string>('ptt_key');

            if (inputDevice !== undefined) set({ inputDevice });
            if (vadThreshold !== undefined) set({ vadThreshold });
            if (pttEnabled !== undefined) set({ pttEnabled });
            if (pttKey !== undefined) set({ pttKey });

            const rememberMe = await store.get<boolean>('remember_me');
            if (rememberMe) {
                const savedUsername = await store.get<string>('saved_username');
                const savedPassword = await store.get<string>('saved_password');
                const savedServerAddress = await store.get<string>('saved_server_address');
                set({
                    rememberMe: true,
                    savedUsername: savedUsername || '',
                    savedPassword: savedPassword || '',
                    savedServerAddress: savedServerAddress || '127.0.0.1'
                });
            }

            console.log("Settings loaded", { inputDevice, vadThreshold, pttEnabled });

            // Sync with backend
            const state = get();
            invoke('set_vad_threshold', { threshold: state.vadThreshold }).catch(() => { });
            invoke('set_ptt_config', { enabled: state.pttEnabled, key: state.pttKey }).catch(() => { });

        } catch (e) {
            console.error("Failed to load settings", e);
        }
    }
}));
