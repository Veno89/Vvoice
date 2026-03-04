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
    const mockToggleEcho = vi.fn();
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
            connect: mockConnect,
            register: vi.fn(),
            sendMessage: vi.fn(),
            toggleEcho: mockToggleEcho,
            clearConnectionError: vi.fn(),
            connectionError: null,
            isReconnecting: false,
            currentUsername: 'Alice',
            messages: []
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
                { peerId: 'p1', name: 'Alice', channel_id: 1, isMuted: false, isDeafened: false, isSpeaking: false, avatar_url: null },
                { peerId: 'p2', name: 'Bob', channel_id: 1, isMuted: true, isDeafened: false, isSpeaking: false, avatar_url: null }
            ],
            channels: [
                { channel_id: 1, name: 'Lobby', parent_id: 0, description: '', temporary: false, position: 0, links: [] },
                { channel_id: 2, name: 'Gaming', parent_id: 0, description: '', temporary: false, position: 1, links: [] }
            ],
            messages: [],
            setupListeners: mockSetupListeners,
            register: vi.fn(),
            connect: mockConnect,
            sendMessage: vi.fn(),
            toggleEcho: mockToggleEcho,
            clearConnectionError: vi.fn(),
            connectionError: null,
            isReconnecting: false
        });

        render(<App />);

        // Chat window should be visible (confirms connected state)
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();

        // Sidebar channels
        expect(screen.getAllByText('Lobby').length).toBeGreaterThan(0);
        expect(screen.getByText('Gaming')).toBeInTheDocument();

        // Users in channel (Alice in Lobby)
        expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
        // Bob is also in Lobby (channel 1)
        expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);

        // Chat window should be visible
        expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    });

    it('triggers echo test action', () => {
        (useVoiceStore as any).mockReturnValue({
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            currentUsername: 'Alice',
            activeUsers: [{ peerId: 'p1', name: 'Alice', channel_id: 1, isMuted: false, isDeafened: false, isSpeaking: false, avatar_url: null }],
            channels: [{ channel_id: 1, name: 'Lobby', parent_id: 0, description: '', temporary: false, position: 0, links: [] }],
            messages: [],
            setupListeners: mockSetupListeners,
            connect: mockConnect,
            register: vi.fn(),
            sendMessage: vi.fn(),
            toggleEcho: mockToggleEcho,
            clearConnectionError: vi.fn(),
            connectionError: null
        });

        render(<App />);

        const echoBtn = screen.getByTitle('Toggle Loopback Test');
        fireEvent.click(echoBtn);

        expect(mockToggleEcho).toHaveBeenCalled();
    });
});
