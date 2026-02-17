import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { useVoiceStore } from '../store/useVoiceStore';
import { useSettingsStore } from '../store/settingsStore';

// Mock child components to isolate App testing
vi.mock('../components/LoginModal', () => ({
    LoginModal: () => <div data-testid="login-modal">Login Modal</div>
}));
vi.mock('../components/ChatWindow', () => ({
    ChatWindow: () => <div data-testid="chat-window">Chat Window</div>
}));
vi.mock('../components/SettingsModal', () => ({
    SettingsModal: () => <div data-testid="settings-modal">Settings Modal</div>
}));
vi.mock('../components/AudioRenderer', () => ({
    AudioRenderer: () => <div data-testid="audio-renderer" />
}));

// Mock stores
vi.mock('../store/useVoiceStore', () => ({
    useVoiceStore: vi.fn()
}));
vi.mock('../store/settingsStore');

describe('App Component', () => {
    const mockConnect = vi.fn();
    const mockDisconnect = vi.fn();
    const mockToggleMute = vi.fn();
    const mockToggleDeaf = vi.fn();
    const mockSetupListeners = vi.fn().mockReturnValue(() => { });

    beforeEach(() => {
        vi.clearAllMocks();

        (useSettingsStore as any).mockReturnValue({
            inputDevice: 'default',
            vadThreshold: 0.5,
            loadSettings: vi.fn(),
        });
    });

    it('renders login modal when not connected', () => {
        (useVoiceStore as any).mockReturnValue({
            isConnected: false,
            isConnecting: false,
            activeUsers: [],
            channels: [],
            setupListeners: mockSetupListeners,
            loadSettings: vi.fn(),
            connect: mockConnect
        });

        render(<App />);
        expect(screen.getByTestId('login-modal')).toBeInTheDocument();
        expect(screen.queryByTestId('chat-window')).not.toBeInTheDocument();
    });

    it('renders main layout when connected', () => {
        (useVoiceStore as any).mockReturnValue({
            isConnected: true,
            isConnecting: false,
            isMuted: false,
            isDeafened: false,
            currentUsername: 'Alice',
            currentUserRole: 'User',
            activeUsers: [
                { session: 1, name: 'Alice', channel_id: 1, isMuted: false, isDeafened: false },
                { session: 2, name: 'Bob', channel_id: 1, isMuted: true, isDeafened: false }
            ],
            channels: [
                { channel_id: 1, name: 'Lobby' },
                { channel_id: 2, name: 'Gaming' }
            ],
            messages: [],
            setupListeners: mockSetupListeners,
            disconnect: mockDisconnect,
            toggleMute: mockToggleMute,
            toggleDeaf: mockToggleDeaf
        });

        render(<App />);
        screen.debug();

        // Chat window should be visible (confirms connected state)
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();

        // Sidebar channels
        expect(screen.getByText('Lobby')).toBeInTheDocument();
        expect(screen.getByText('Gaming')).toBeInTheDocument();

        // Users in channel (Alice in Lobby)
        expect(screen.getByText('Alice')).toBeInTheDocument();
        // Bob is also in Lobby (channel 1)
        expect(screen.getByText('Bob')).toBeInTheDocument();

        // Chat window should be visible
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    });

    it('toggles mute', () => {
        (useVoiceStore as any).mockReturnValue({
            isConnected: true,
            isMuted: false, // Initial state
            activeUsers: [],
            channels: [],
            setupListeners: mockSetupListeners,
            toggleMute: mockToggleMute
        });

        render(<App />);

        const muteBtn = screen.getByTitle('Mute');
        fireEvent.click(muteBtn);

        expect(mockToggleMute).toHaveBeenCalled();
    });
});
