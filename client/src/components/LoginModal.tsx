import { useState } from 'react';
import { User, Key, Server, Radio } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoginModalProps {
    onConnect: (username: string, password: string) => void; // host/port omitted for MVP (localhost)
    isConnecting: boolean;
}

export function LoginModal({ onConnect, isConnecting }: LoginModalProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    // const [host, setHost] = useState('127.0.0.1');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username && password) {
            onConnect(username, password);
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
                <h2>Connect to Server</h2>
                <p>Enter your credentials to join.</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
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

                {/* 
        <div className="input-group">
          <Globe size={18} className="input-icon" />
          <input 
            type="text" 
            placeholder="Server Address (IP:Port)" 
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={isConnecting}
          />
        </div> 
        */}

                <button
                    type="submit"
                    className={`btn-large ${isConnecting ? 'loading' : ''}`}
                    disabled={!username || !password || isConnecting}
                >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                    {!isConnecting && <Radio size={18} style={{ marginLeft: 8 }} />}
                </button>
            </form>
        </motion.div>
    );
}
