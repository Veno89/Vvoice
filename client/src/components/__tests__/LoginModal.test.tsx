import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginModal } from '../LoginModal';

// Mock settings store to avoid persistence side effects
vi.mock('../store/settingsStore', () => ({
    useSettingsStore: () => ({
        savedUsername: '',
        savedPassword: '',
        savedServerAddress: '',
        rememberMe: false,
        setCredentials: vi.fn(),
    })
}));

describe('LoginModal', () => {
    it('renders correctly', () => {
        render(<LoginModal onConnect={vi.fn()} onRegister={vi.fn()} isConnecting={false} />);

        expect(screen.getByText('Connect to Server')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Server Address')).toHaveValue('127.0.0.1'); // Default
    });

    it('validates input before submit', async () => {
        const onConnect = vi.fn();
        render(<LoginModal onConnect={onConnect} onRegister={vi.fn()} isConnecting={false} />);

        const submitBtn = screen.getByRole('button', { name: /Connect/i });

        // Initially disabled (except address has default)
        // Username/Pass empty
        expect(submitBtn).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'Alice' } });
        fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });

        expect(submitBtn).not.toBeDisabled();

        fireEvent.click(submitBtn);
        expect(onConnect).toHaveBeenCalledWith('Alice', 'secret', '127.0.0.1');
    });

    it('shows loading state', () => {
        render(<LoginModal onConnect={vi.fn()} onRegister={vi.fn()} isConnecting={true} />);
        expect(screen.getByText('Please wait...')).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
