import { useState, useEffect } from 'react';
import { User, Key, Server, Radio, CheckSquare, Square } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettingsStore } from '../store/settingsStore';

interface LoginModalProps {
    onConnect: (username: string, password: string, serverAddress: string) => void;
    onRegister: (username: string, password: string, serverAddress: string) => void;
    isConnecting: boolean;
}

export function LoginModal({ onConnect, onRegister, isConnecting }: LoginModalProps) {
    const { savedUsername, savedPassword, savedServerAddress, rememberMe, setCredentials } = useSettingsStore();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [serverAddress, setServerAddress] = useState('127.0.0.1');
    const [remember, setRemember] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        if (rememberMe && savedUsername) {
            setUsername(savedUsername);
            setPassword(savedPassword || '');
            setServerAddress(savedServerAddress || '127.0.0.1');
            setRemember(true);
        }
    }, [rememberMe, savedUsername, savedPassword, savedServerAddress]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (username && password && serverAddress) {
            await setCredentials(username, password, serverAddress, remember);
            if (isRegistering) {
                onRegister(username, password, serverAddress);
            } else {
                onConnect(username, password, serverAddress);
            }
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="login-modal"
        >
            <div className="login-header">
                <Server size={32} className="login-icon" />
                <h2>{isRegistering ? 'Create Account' : 'Connect to Server'}</h2>
                <p>{isRegistering ? 'Register to join the voice server.' : 'Enter your credentials to join.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
                <div className="input-group">
                    <Server size={18} className="input-icon" />
                    <input
                        type="text"
                        placeholder="Server Address"
                        value={serverAddress}
                        onChange={(e) => setServerAddress(e.target.value)}
                        disabled={isConnecting}
                        required
                    />
                </div>

                <div className="input-group">
                    <User size={18} className="input-icon" />
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isConnecting}
                        autoFocus
                        required
                    />
                </div>

                <div className="input-group">
                    <Key size={18} className="input-icon" />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isConnecting}
                        required
                    />
                </div>

                <div
                    className="remember-me"
                    onClick={() => setRemember(!remember)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        color: 'var(--text-dim)',
                        fontSize: '0.9rem',
                        alignSelf: 'flex-start',
                        paddingLeft: 4
                    }}
                >
                    {remember ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} />}
                    <span>Remember me</span>
                </div>

                <button
                    type="submit"
                    className={`btn-large ${isConnecting ? 'loading' : ''}`}
                    disabled={!username || !password || !serverAddress || isConnecting}
                >
                    {isConnecting ? 'Please wait...' : (isRegistering ? 'Register' : 'Connect')}
                    {!isConnecting && <Radio size={18} style={{ marginLeft: 8 }} />}
                </button>

                <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setIsRegistering(!isRegistering)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontSize: '0.9rem'
                        }}
                    >
                        {isRegistering ? 'Already have an account? Login' : 'New user? Create an account'}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}
