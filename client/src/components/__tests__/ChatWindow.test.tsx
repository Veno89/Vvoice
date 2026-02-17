import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWindow } from '../ChatWindow';
import { ActiveUser, Channel, ChatMessage } from '../../types/voice';

describe('ChatWindow', () => {
    const mockMessages: ChatMessage[] = [
        { actor: 1, message: 'Hello world', timestamp: 1234567890, session: 1, channel_id: [1] },
        { actor: 2, message: 'Hi there', timestamp: 1234567891, session: 2, channel_id: [1] }
    ];

    const mockUsers: ActiveUser[] = [
        { session: 1, peerId: 'p1', name: 'Alice', channel_id: 1, isMuted: false, isDeafened: false, avatar_url: null, isSpeaking: false },
        { session: 2, peerId: 'p2', name: 'Bob', channel_id: 1, isMuted: false, isDeafened: false, avatar_url: null, isSpeaking: false }
    ];

    const mockChannels: Channel[] = [
        { channel_id: 1, name: 'General', parent_id: 0, description: '', temporary: false, position: 0, links: [] }
    ];

    const defaultProps = {
        messages: mockMessages,
        activeUsers: mockUsers,
        channels: mockChannels,
        currentUsername: 'Alice',
        inputMessage: '',
        onInputChange: vi.fn(),
        onSendMessage: vi.fn().mockResolvedValue(undefined)
    };

    it('renders messages correctly', () => {
        render(<ChatWindow {...defaultProps} />);

        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
        // Alice matches "me", so it should render "Alice" (or handle "me" styling, logic in component verifies name)
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('shows empty state when no messages', () => {
        render(<ChatWindow {...defaultProps} messages={[]} />);
        expect(screen.getByText(/Welcome to #General/i)).toBeInTheDocument();
    });

    it('handles input changes', async () => {
        const onInputChange = vi.fn();
        render(<ChatWindow {...defaultProps} onInputChange={onInputChange} />);

        const input = screen.getByPlaceholderText(/Message #General/i);
        await userEvent.type(input, 'New message');

        expect(onInputChange).toHaveBeenCalled();
    });

    it('submits message', async () => {
        const onSendMessage = vi.fn().mockResolvedValue(undefined);
        const onInputChange = vi.fn();

        render(<ChatWindow
            {...defaultProps}
            inputMessage="Test message"
            onSendMessage={onSendMessage}
            onInputChange={onInputChange}
        />);

        const form = screen.getByRole('button').closest('form');
        fireEvent.submit(form!);

        expect(onSendMessage).toHaveBeenCalledWith('Test message');
        expect(onInputChange).toHaveBeenCalledWith('');
    });
});
